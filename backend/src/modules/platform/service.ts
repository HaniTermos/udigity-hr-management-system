/**
 * MOD-platform — service. Owner: BE5. Implements the shared contracts:
 * - shared/outbox.ts  OutboxWriter (emit in the caller's tx) + J-03 relay (per-consumer idempotency, backoff, dead)
 * - shared/platform.ts JobQueue (enqueue), job runner (claim/lease/retry/dead), scheduler tick, IdempotencyStore
 * - J-09 heartbeat
 * All time comes from `clock.now()` (test clock, QA-2).
 */
import os from 'os';
import type pg from 'pg';
import { pool, withTransaction, type Queryable } from '../../db/pool.js';
import { OUTBOX_EVENTS, getOutboxConsumers, type OutboxEvent, type OutboxWriter, type DeliveredEvent } from '../../shared/outbox.js';
import { getJobHandlers, type IdempotencyStore, type JobHandler, type JobKind, type JobQueue } from '../../shared/platform.js';
import type { CommandContext } from '../../shared/tx.js';
import { flags } from '../../shared/flags.js';
import { getSetting } from '../admin/service.js';
import { raiseOpsAlert } from '../../shared/opsAlert.js';
import { clock } from './clock.js';
import * as repo from './repo.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Short, log-safe error summary (class + first 300 chars). Never includes stacks. */
export function errorSummary(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 300);
  return 'Error: non-error thrown';
}

/** Exponential backoff in seconds: base * 2^(attempt-1), capped. */
export function backoffSeconds(attempt: number, baseSeconds: number, capSeconds: number): number {
  const n = Math.max(1, attempt);
  return Math.min(capSeconds, baseSeconds * 2 ** (n - 1));
}

function systemContext(tx: pg.PoolClient, job: string): CommandContext {
  return { tx, actor: { kind: 'system', job }, requestId: null, clientIp: null, now: clock.now() };
}

/** Run a system command in one transaction with the platform clock as ctx.now. */
export function runSystemTx<T>(job: string, fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  return withTransaction((tx) => fn(systemContext(tx, job)));
}

/** Run with a pooled client in autocommit mode (no transaction): for handlers that do external I/O. */
async function runSystemNoTx<T>(job: string, fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(systemContext(client, job));
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Outbox writer
// ---------------------------------------------------------------------------

const OUTBOX_NAME_SET = new Set<string>(OUTBOX_EVENTS);
const MAX_PAYLOAD_KEYS = 20;
const MAX_PAYLOAD_STRING = 200;

export function validateOutboxEvent(event: OutboxEvent): Record<string, string | number | boolean | null> {
  if (!OUTBOX_NAME_SET.has(event.name)) throw new Error(`Unknown outbox event: ${String(event.name)}`);
  if (!event.aggregateType || event.aggregateType.length > 60) throw new Error('Outbox aggregateType invalid');
  if (!event.aggregateId || event.aggregateId.length > 64) throw new Error('Outbox aggregateId invalid');
  const payload = event.payload ?? {};
  const keys = Object.keys(payload);
  if (keys.length > MAX_PAYLOAD_KEYS) throw new Error('Outbox payload has too many keys');
  for (const k of keys) {
    const v = payload[k];
    const ok =
      v === null ||
      typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v)) ||
      (typeof v === 'string' && v.length <= MAX_PAYLOAD_STRING);
    if (!ok) throw new Error(`Outbox payload value for "${k}" must be an id or small scalar`);
  }
  return payload;
}

export const outboxWriter: OutboxWriter = {
  async emit(tx, event) {
    const payload = validateOutboxEvent(event);
    return repo.insertOutboxEvent(tx, { ...event, payload }, clock.now());
  },
};

// ---------------------------------------------------------------------------
// J-03 outbox relay
// ---------------------------------------------------------------------------

export const RELAY = {
  batchSize: 50,
  leaseSeconds: 60,
  maxAttempts: 10,
  backoffBaseSeconds: 5,
  backoffCapSeconds: 3600,
} as const;

export interface RelayResult {
  claimed: number;
  done: number;
  retried: number;
  dead: number;
}

/** Claim committed events and deliver each to its consumers (each in its own transaction). */
export async function relayOutboxOnce(): Promise<RelayResult> {
  const result: RelayResult = { claimed: 0, done: 0, retried: 0, dead: 0 };
  const claimed = await repo.claimOutboxEvents(pool, clock.now(), RELAY.leaseSeconds, RELAY.batchSize);
  result.claimed = claimed.length;

  for (const row of claimed) {
    const event: DeliveredEvent = {
      id: row.id,
      name: row.name as DeliveredEvent['name'],
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      payload: row.payload ?? {},
      createdAt: row.created_at,
      attempt: row.attempts,
    };
    const subscribed = getOutboxConsumers().filter((c) => c.events.includes(event.name));
    const already = await repo.completedConsumers(pool, event.id);
    let failure: string | null = null;

    for (const consumer of subscribed) {
      if (already.has(consumer.name)) continue;
      try {
        await runSystemTx(`outbox:${consumer.name}`, async (ctx) => {
          // Completion row first: if handle() throws, both roll back together.
          const fresh = await repo.markConsumerRun(ctx.tx, event.id, consumer.name);
          if (!fresh) return;
          await consumer.handle(ctx, event);
        });
      } catch (err) {
        failure = `${consumer.name}: ${errorSummary(err)}`;
        // Keep going: other consumers are independent and idempotent.
      }
    }

    const now = clock.now();
    if (failure === null) {
      await repo.markOutboxDone(pool, event.id, now);
      result.done++;
    } else {
      const dead = row.attempts >= RELAY.maxAttempts;
      const next = new Date(now.getTime() + backoffSeconds(row.attempts, RELAY.backoffBaseSeconds, RELAY.backoffCapSeconds) * 1000);
      await repo.markOutboxRetry(pool, event.id, next, failure, dead);
      if (dead) {
        result.dead++;
        console.error(`[outbox] event ${event.id} (${event.name}) dead after ${row.attempts} attempts`);
        await raiseOpsAlert('outbox.dead', `event ${event.name} ${event.id} failed ${row.attempts} times`);
      } else {
        result.retried++;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Job queue + runner + scheduler
// ---------------------------------------------------------------------------

/** Extension used by BE5 handlers that perform external I/O (email): run without a transaction. */
export interface PlatformJobHandler extends JobHandler {
  /** false = ctx.tx is an autocommit client (no BEGIN). Default true. */
  transactional?: boolean;
}

function handlerFor(kind: string): PlatformJobHandler | undefined {
  return getJobHandlers().find((h) => h.kind === kind) as PlatformJobHandler | undefined;
}

export const jobQueue: JobQueue = {
  async enqueue(tx, kind, options) {
    const handler = handlerFor(kind);
    if (!options.dedupeKey || options.dedupeKey.length > 200) throw new Error('Job dedupeKey required (<= 200 chars)');
    await repo.insertJob(tx, {
      kind,
      dedupeKey: options.dedupeKey,
      runAt: options.runAt ?? clock.now(),
      payload: options.payload ?? {},
      maxAttempts: handler?.maxAttempts ?? 5,
    });
  },
};

export const JOB_RETRY = { baseSeconds: 30, capSeconds: 3600 } as const;

async function execute(handler: PlatformJobHandler, job: { id: string; payload: Record<string, unknown>; attempt: number }) {
  const run = (ctx: CommandContext) => handler.run(ctx, job);
  if (handler.transactional === false) return runSystemNoTx(handler.kind, run);
  return runSystemTx(handler.kind, run);
}

export interface JobRunResult {
  ran: number;
  failed: number;
  dead: number;
}

/** Claim and run due job rows (optionally only some kinds). */
export async function runDueJobs(kinds?: JobKind[], limit = 20): Promise<JobRunResult> {
  const registered = getJobHandlers().map((h) => h.kind);
  const wanted = kinds ? registered.filter((k) => kinds.includes(k)) : registered;
  const result: JobRunResult = { ran: 0, failed: 0, dead: 0 };
  const maxLease = Math.max(30, ...getJobHandlers().map((h) => h.leaseSeconds));
  const claimed = await repo.claimJobs(pool, wanted, clock.now(), maxLease, limit);
  for (const row of claimed) {
    const handler = handlerFor(row.kind);
    if (!handler) continue;
    try {
      await execute(handler, { id: row.id, payload: row.payload ?? {}, attempt: row.attempts });
      await repo.markJobDone(pool, row.id, clock.now());
      result.ran++;
    } catch (err) {
      const dead = row.attempts >= row.max_attempts;
      const next = new Date(clock.now().getTime() + backoffSeconds(row.attempts, JOB_RETRY.baseSeconds, JOB_RETRY.capSeconds) * 1000);
      await repo.markJobRetry(pool, row.id, next, errorSummary(err), dead);
      if (dead) {
        result.dead++;
        console.error(`[jobs] ${row.kind} job ${row.id} dead after ${row.attempts} attempts`);
        await raiseOpsAlert(`job.dead:${row.kind}`, `job ${row.kind} ${row.id} failed ${row.attempts} times`);
      } else {
        result.failed++;
      }
    }
  }
  return result;
}

/** Test/ops: run a registered handler right now, outside the queue (plan §8 "tests call handlers directly"). */
export async function runJobNow(kind: JobKind, payload: Record<string, unknown> = {}): Promise<void> {
  const handler = handlerFor(kind);
  if (!handler) throw new Error(`No handler registered for ${kind}`);
  await execute(handler, { id: `manual:${kind}`, payload, attempt: 1 });
}

/** Local date (YYYY-MM-DD) and time (HH:MM) in a timezone. */
function localParts(now: Date, timeZone: string): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * The slot a recurring handler is due for at `now`, or null.
 * `every:N` → slot start floor(now / N). `daily:HH:MM` → the company-local date once its time has
 * passed; needs a company timezone, otherwise "Not configured" (null).
 */
export function slotFor(spec: string, now: Date, timeZone: string): { dedupeKey: string; runAt: Date } | null {
  const every = /^every:(\d+)$/.exec(spec);
  if (every) {
    const n = Number(every[1]);
    if (!(n > 0)) return null;
    const start = Math.floor(now.getTime() / (n * 1000)) * n * 1000;
    const runAt = new Date(start);
    return { dedupeKey: `slot:${runAt.toISOString()}`, runAt };
  }
  const daily = /^daily:(\d{2}):(\d{2})$/.exec(spec);
  if (daily) {
    if (!timeZone) return null;
    let local;
    try {
      local = localParts(now, timeZone);
    } catch {
      return null;
    }
    if (local.time < `${daily[1]}:${daily[2]}`) return null;
    return { dedupeKey: `day:${local.date}`, runAt: now };
  }
  return null;
}

/** Scheduler tick: insert the current (kind, slot) row for each recurring handler. Restart-safe. */
export async function schedulerTick(timeZone = ''): Promise<number> {
  const now = clock.now();
  let inserted = 0;
  for (const h of getJobHandlers()) {
    if (!h.schedule) continue;
    const slot = slotFor(h.schedule.spec, now, timeZone);
    if (!slot) continue;
    const ok = await repo.insertJob(pool, { kind: h.kind, dedupeKey: slot.dedupeKey, runAt: slot.runAt, payload: {}, maxAttempts: h.maxAttempts });
    if (ok) inserted++;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Idempotency store
// ---------------------------------------------------------------------------

export const idempotencyStore: IdempotencyStore = {
  async lookup(db, key) {
    const row = await repo.findIdempotency(db, key, clock.now());
    if (!row || row.status === 0) return null;
    return { requestHash: row.request_hash, status: row.status, body: row.body };
  },
  async save(tx, key, record) {
    const expiresAt = new Date(clock.now().getTime() + flags['retention.idempotencyHours'] * 3600_000);
    await repo.saveIdempotency(tx, key, { request_hash: record.requestHash, status: record.status, body: record.body }, expiresAt);
  },
};

// ---------------------------------------------------------------------------
// J-09 heartbeat + worker health
// ---------------------------------------------------------------------------

export const WORKER_ID = `${os.hostname()}:${process.pid}`.slice(0, 120);
export const HEARTBEAT_STALE_SECONDS = 180;

export async function beat(db: Queryable = pool): Promise<void> {
  await repo.upsertHeartbeat(db, WORKER_ID, process.pid, clock.now());
}

export async function workerHealth(db: Queryable = pool): Promise<{
  status: 'ok' | 'stale' | 'never';
  lastBeatAt: string | null;
  outbox: { pending: number; dead: number };
}> {
  const last = await repo.latestHeartbeat(db);
  const counts = await repo.countOutboxByState(db);
  const outbox = { pending: counts.pending ?? 0, dead: counts.dead ?? 0 };
  if (!last) return { status: 'never', lastBeatAt: null, outbox };
  const age = (clock.now().getTime() - last.getTime()) / 1000;
  return { status: age <= HEARTBEAT_STALE_SECONDS ? 'ok' : 'stale', lastBeatAt: last.toISOString(), outbox };
}

/** Company timezone setting (BE1 setting; '' = Not configured, so daily jobs do not run). */
export async function companyTimezone(db: Queryable = pool): Promise<string> {
  try {
    return (await getSetting(db, 'company.timezone')) || '';
  } catch {
    return '';
  }
}
