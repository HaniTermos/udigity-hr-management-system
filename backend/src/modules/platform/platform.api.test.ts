/**
 * MOD-platform DB tests (TEST_DATABASE_URL only): outbox round-trip (emit in tx → J-03 relay →
 * consumer), per-consumer idempotency, retry/backoff/dead, job queue + scheduler + heartbeat,
 * idempotency middleware, test-support clock. Uses the test clock; never deletes data it does not own.
 */
import crypto from 'crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { outbox, registerOutboxConsumer, type DeliveredEvent } from '../../shared/outbox.js';
import { jobs, registerJob } from '../../shared/platform.js';
import { clock } from './clock.js';
import { idempotent } from './idempotency.js';
import { RELAY, relayOutboxOnce, runDueJobs, runJobNow, schedulerTick, workerHealth } from './service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const RUN = crypto.randomUUID();

// Test consumers only act on events of this run (the shared test DB may hold older rows).
const seenA: string[] = [];
const seenB: string[] = [];
let failB = 0;
let failAlways = false;

function mine(e: DeliveredEvent): boolean {
  return e.payload.run === RUN;
}

let jobRuns = 0;
let jobFailures = 0;

afterAll(async () => {
  if (hasTestDb) await pool.end();
});

describe.skipIf(!hasTestDb)('platform against TEST_DATABASE_URL', () => {
  beforeAll(() => {
    registerOutboxConsumer({
      name: 'test.consumer_a',
      events: ['call_outcome.changed'],
      async handle(ctx, e) {
        if (!mine(e)) return;
        expect(ctx.actor.kind).toBe('system');
        seenA.push(e.id);
      },
    });
    registerOutboxConsumer({
      name: 'test.consumer_b',
      events: ['call_outcome.changed', 'password_reset.completed'],
      async handle(_ctx, e) {
        if (!mine(e)) return;
        if (failAlways || failB > 0) {
          failB = Math.max(0, failB - 1);
          throw new Error('consumer b failed');
        }
        seenB.push(e.id);
      },
    });
    registerJob({
      kind: 'reports.daily_snapshot', // J-08 is not in v1 (BE5-owned kind): test-only registration
      maxAttempts: 2,
      leaseSeconds: 30,
      async run(_ctx, job) {
        if (job.payload.run !== RUN) return;
        jobRuns++;
        if (job.payload.fail) {
          jobFailures++;
          throw new Error('job failed');
        }
      },
    });
  });

  afterEach(() => {
    clock.set(null);
    failB = 0;
    failAlways = false;
  });

  async function emit(name: 'call_outcome.changed' | 'password_reset.completed', commit = true): Promise<string> {
    let id = '';
    await withTransaction(async (tx) => {
      id = await outbox.emit(tx, { name, aggregateType: 'test', aggregateId: crypto.randomUUID(), payload: { run: RUN } });
      if (!commit) throw new Error('rollback');
    }).catch((e: Error) => {
      if (commit || e.message !== 'rollback') throw e;
    });
    return id;
  }

  /**
   * Relay until nothing is due (BE1-R5): other suites may leave more than one batch of pending
   * events in the shared DB, which would push this run's event out of a single relay batch.
   */
  async function relayAll(): Promise<void> {
    for (let i = 0; i < 500; i++) {
      if ((await relayOutboxOnce()).claimed === 0) return;
    }
  }

  async function eventRow(id: string) {
    const { rows } = await query<{ state: string; attempts: number; next_attempt_at: Date; last_error: string | null }>(
      'SELECT state, attempts, next_attempt_at, last_error FROM outbox_events WHERE id = $1',
      [id]
    );
    return rows[0];
  }

  it('outbox round-trip: emit in tx → relay → each consumer once → done; relay again is a no-op', async () => {
    const id = await emit('call_outcome.changed');
    expect((await eventRow(id)).state).toBe('pending');
    await relayAll();
    expect(seenA.filter((x) => x === id)).toHaveLength(1);
    expect(seenB.filter((x) => x === id)).toHaveLength(1);
    expect((await eventRow(id)).state).toBe('done');
    const runs = await query('SELECT consumer FROM outbox_consumer_runs WHERE event_id = $1 ORDER BY consumer', [id]);
    expect(runs.rows.map((r) => r.consumer)).toEqual(['test.consumer_a', 'test.consumer_b']);
    await relayAll();
    expect(seenA.filter((x) => x === id)).toHaveLength(1);
  });

  it('a rolled-back command leaves no outbox event', async () => {
    const before = await query(`SELECT count(*)::int AS n FROM outbox_events WHERE payload->>'run' = $1`, [RUN]);
    await emit('call_outcome.changed', false);
    const after = await query(`SELECT count(*)::int AS n FROM outbox_events WHERE payload->>'run' = $1`, [RUN]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('retry with backoff: failing consumer retried later; the succeeded consumer is not re-run', async () => {
    const t0 = new Date(Date.now() + 60_000);
    clock.set(t0);
    const id = await emit('call_outcome.changed');
    failB = 1;
    await relayAll();
    let row = await eventRow(id);
    expect(row.state).toBe('pending');
    expect(row.attempts).toBe(1);
    expect(row.last_error).toContain('test.consumer_b');
    expect(row.next_attempt_at.getTime()).toBe(t0.getTime() + RELAY.backoffBaseSeconds * 1000);
    expect(seenA.filter((x) => x === id)).toHaveLength(1);

    // Not due yet.
    clock.set(new Date(t0.getTime() + 4_000));
    await relayAll();
    expect((await eventRow(id)).attempts).toBe(1);

    clock.set(new Date(t0.getTime() + 5_000));
    await relayAll();
    row = await eventRow(id);
    expect(row.state).toBe('done');
    expect(row.attempts).toBe(2);
    expect(seenA.filter((x) => x === id)).toHaveLength(1); // idempotent per consumer
    expect(seenB.filter((x) => x === id)).toHaveLength(1);
  });

  it('dead after max attempts; backoff doubles', async () => {
    const t0 = new Date(Date.now() + 120_000);
    clock.set(t0);
    const id = await emit('password_reset.completed');
    failAlways = true;
    await relayAll();
    const r1 = await eventRow(id);
    clock.set(r1.next_attempt_at);
    await relayAll();
    const r2 = await eventRow(id);
    expect(r2.next_attempt_at.getTime() - r1.next_attempt_at.getTime()).toBe(2 * RELAY.backoffBaseSeconds * 1000);
    // Jump to the last attempt.
    await query('UPDATE outbox_events SET attempts = $2 WHERE id = $1', [id, RELAY.maxAttempts - 1]);
    clock.set(r2.next_attempt_at);
    await relayAll();
    expect((await eventRow(id)).state).toBe('dead');
    const h = await workerHealth();
    expect(h.outbox.dead).toBeGreaterThanOrEqual(1);
  });

  it('job queue: enqueue is idempotent by dedupe key; runs once; failures back off then go dead', async () => {
    const t0 = new Date(Date.now() + 180_000);
    clock.set(t0);
    const key = `ok:${RUN}`;
    await withTransaction(async (tx) => {
      await jobs.enqueue(tx, 'reports.daily_snapshot', { dedupeKey: key, payload: { run: RUN } });
      await jobs.enqueue(tx, 'reports.daily_snapshot', { dedupeKey: key, payload: { run: RUN } });
    });
    const n = await query('SELECT count(*)::int AS n FROM background_jobs WHERE dedupe_key = $1', [key]);
    expect(n.rows[0].n).toBe(1);
    const before = jobRuns;
    await runDueJobs(['reports.daily_snapshot']);
    expect(jobRuns).toBe(before + 1);
    expect((await query('SELECT state FROM background_jobs WHERE dedupe_key = $1', [key])).rows[0].state).toBe('done');

    const failKey = `fail:${RUN}`;
    await withTransaction((tx) => jobs.enqueue(tx, 'reports.daily_snapshot', { dedupeKey: failKey, payload: { run: RUN, fail: true } }));
    const failuresBefore = jobFailures;
    await runDueJobs(['reports.daily_snapshot']);
    expect(jobFailures).toBe(failuresBefore + 1);
    let row = (await query('SELECT state, attempts, run_at FROM background_jobs WHERE dedupe_key = $1', [failKey])).rows[0];
    expect(row.state).toBe('queued');
    expect(row.attempts).toBe(1);
    expect(new Date(row.run_at).getTime()).toBe(t0.getTime() + 30_000);
    await runDueJobs(['reports.daily_snapshot']); // not due yet
    expect((await query('SELECT attempts FROM background_jobs WHERE dedupe_key = $1', [failKey])).rows[0].attempts).toBe(1);
    clock.set(new Date(t0.getTime() + 30_000));
    await runDueJobs(['reports.daily_snapshot']);
    row = (await query('SELECT state, attempts, last_error FROM background_jobs WHERE dedupe_key = $1', [failKey])).rows[0];
    expect(row.state).toBe('dead');
    expect(row.attempts).toBe(2);
    expect(row.last_error).toContain('job failed');
  });

  it('scheduler: one row per (kind, slot) even when ticked twice; heartbeat feeds /health/worker', async () => {
    const t = new Date(Date.now() + 400 * 86_400_000);
    clock.set(t);
    await schedulerTick('');
    await schedulerTick('');
    const slot = `slot:${new Date(Math.floor(t.getTime() / 60_000) * 60_000).toISOString()}`;
    const hb = await query(`SELECT count(*)::int AS n FROM background_jobs WHERE kind = 'platform.heartbeat' AND dedupe_key = $1`, [slot]);
    expect(hb.rows[0].n).toBe(1);
    await runDueJobs(['platform.heartbeat']);
    const res = await request(app).get('/health/worker');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Object.keys(res.body).sort()).toEqual(['lastBeatAt', 'outbox', 'status']);

    clock.set(new Date('2200-01-01T00:00:00Z'));
    expect((await request(app).get('/health/worker')).status).toBe(503);
  });

  it('runJobNow runs a handler directly (relay)', async () => {
    const id = await emit('call_outcome.changed');
    await runJobNow('platform.outbox_relay');
    expect((await eventRow(id)).state).toBe('done');
  });

  it('test-support: clock endpoints and job runner exist in NODE_ENV=test', async () => {
    const set = await request(app).put('/api/test-support/clock').send({ at: '2030-01-01T00:00:00Z' });
    expect(set.status).toBe(200);
    expect(clock.now().toISOString()).toBe('2030-01-01T00:00:00.000Z');
    const adv = await request(app).put('/api/test-support/clock').send({ advanceSeconds: 60 });
    expect(adv.body.now).toBe('2030-01-01T00:01:00.000Z');
    expect((await request(app).put('/api/test-support/clock').send({ at: 'x', extra: 1 })).status).toBe(400);
    expect((await request(app).post('/api/test-support/jobs/platform.heartbeat/run').send({})).status).toBe(200);
    expect((await request(app).post('/api/test-support/jobs/nope/run').send({})).status).toBe(404);
    expect((await request(app).delete('/api/test-support/clock')).body.overridden).toBe(false);
  });
});

describe.skipIf(!hasTestDb)('idempotent() middleware', () => {
  let actorId = '';
  let calls = 0;
  const mini = express();
  mini.use(express.json());
  mini.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: actorId } as Request['user'];
    next();
  });
  mini.post('/things', idempotent('test.create'), (req, res) => {
    calls++;
    res.status(201).json({ created: req.body.name, n: calls });
  });
  mini.post('/boom', idempotent('test.boom'), (_req, res) => {
    calls++;
    res.status(500).json({ error: 'x' });
  });
  mini.post('/optional', idempotent('test.optional', { required: false }), (_req, res) => {
    res.json({ ok: true });
  });
  mini.use(errorHandler);

  beforeAll(async () => {
    const email = `idem.${RUN}@test.local`;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Idem Test', 'developer', true) RETURNING id`,
      [email]
    );
    actorId = rows[0].id;
  });

  it('replays the stored response for the same key and body', async () => {
    const key = crypto.randomUUID();
    const a = await request(mini).post('/things').set('Idempotency-Key', key).send({ name: 'x', v: 1 });
    const b = await request(mini).post('/things').set('Idempotency-Key', key).send({ v: 1, name: 'x' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(calls).toBe(1);
  });

  it('same key + different body → 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const key = crypto.randomUUID();
    await request(mini).post('/things').set('Idempotency-Key', key).send({ name: 'x' });
    const r = await request(mini).post('/things').set('Idempotency-Key', key).send({ name: 'y' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('missing key → 400 when required; malformed key → 400; optional route passes without', async () => {
    expect((await request(mini).post('/things').send({ name: 'x' })).status).toBe(400);
    expect((await request(mini).post('/things').set('Idempotency-Key', 'not-a-uuid').send({})).body.code).toBe('VALIDATION_ERROR');
    expect((await request(mini).post('/optional').send({})).status).toBe(200);
  });

  it('5xx is not stored: a retry with the same key runs again', async () => {
    const key = crypto.randomUUID();
    const before = calls;
    await request(mini).post('/boom').set('Idempotency-Key', key).send({});
    await request(mini).post('/boom').set('Idempotency-Key', key).send({});
    expect(calls).toBe(before + 2);
  });

  it('expired records are taken over (retention.idempotencyHours)', async () => {
    const key = crypto.randomUUID();
    await request(mini).post('/things').set('Idempotency-Key', key).send({ name: 'x' });
    clock.set(new Date(Date.now() + 49 * 3600_000));
    const before = calls;
    const r = await request(mini).post('/things').set('Idempotency-Key', key).send({ name: 'other' });
    clock.set(null);
    expect(r.status).toBe(201);
    expect(calls).toBe(before + 1);
  });
});
