/**
 * Review fix FIX-BE-B: C-08 (poison job/outbox/email), D-07 (lease ownership), D-03 (ops alert claim),
 * C-12 (visible characters), E-03 (self-decision), C-19 (break allowance), C-13 (My Day date).
 */
import crypto from 'crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { config } from '../config/index.js';
import { pool, query } from '../db/pool.js';
import { DEV_TOTP_SECRET } from '../db/seed.js';
import * as platformRepo from '../modules/platform/repo.js';
import { RELAY, runDueJobs, relayOutboxOnce } from '../modules/platform/service.js';
import { clock } from '../modules/platform/clock.js';
import { sendOpsAlerts } from '../modules/notifications/opsAlerts.js';
import { createMemoryTransport, mailSink, setEmailTransport } from '../modules/notifications/transport.js';
import { summaryCharCount } from '../modules/attendance/time.js';
import { setAttendanceFlagOverridesForTests } from '../modules/attendance/service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';

describe('C-12 summaryCharCount counts visible characters', () => {
  it('ignores zero-width, filler, BOM and whitespace; an emoji counts once', () => {
    expect(summaryCharCount('​'.repeat(10))).toBe(0);
    expect(summaryCharCount('⠀'.repeat(10) + 'ㅤ'.repeat(10))).toBe(0);
    expect(summaryCharCount('﻿   ⁠ ‍')).toBe(0);
    expect(summaryCharCount('a​b c')).toBe(3);
    expect(summaryCharCount('😀😀')).toBe(2);
    expect(summaryCharCount('Wrote the report')).toBe(14);
  });
});

describe.skipIf(!hasTestDb)('FIX-BE-B platform and notifications', () => {
  afterEach(() => {
    setEmailTransport(null);
    mailSink.clear();
    delete process.env.ALERT_EMAIL_TO;
  });
  afterAll(async () => {
    await query(`DELETE FROM ops_alerts WHERE kind LIKE 'test.%' OR kind LIKE 'job.dead:%' OR kind = 'outbox.dead'`);
  });

  it('C-08: a job that used every attempt without a result goes dead with an alert', async () => {
    const dedupe = `beb-${crypto.randomUUID()}`;
    await query(
      `INSERT INTO background_jobs (kind, dedupe_key, payload, run_at, max_attempts, attempts, lease_until)
       VALUES ('platform.heartbeat', $1, '{}', now() - interval '1 hour', 1, 1, now() - interval '1 minute')`,
      [dedupe]
    );
    const res = await runDueJobs(['platform.heartbeat']);
    expect(res.dead).toBeGreaterThanOrEqual(1);
    const { rows } = await query(`SELECT state FROM background_jobs WHERE dedupe_key = $1`, [dedupe]);
    expect(rows[0].state).toBe('dead');
    expect((await query(`SELECT 1 FROM ops_alerts WHERE kind = 'job.dead:platform.heartbeat'`)).rowCount).toBeGreaterThan(0);
  });

  it('C-08: an outbox event at the attempt cap is dead-ended, not claimed again', async () => {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO outbox_events (name, aggregate_type, aggregate_id, payload, next_attempt_at, attempts, lease_until)
       VALUES ('employee.created', 'employee', $1, '{}', now() - interval '1 hour', $2, now() - interval '1 minute') RETURNING id`,
      [crypto.randomUUID(), RELAY.maxAttempts]
    );
    const r = await relayOutboxOnce();
    expect(r.dead).toBeGreaterThanOrEqual(1);
    expect((await query(`SELECT state FROM outbox_events WHERE id = $1`, [rows[0].id])).rows[0].state).toBe('dead');
    await query(`DELETE FROM outbox_events WHERE id = $1`, [rows[0].id]);
  });

  it('D-07: completion only applies while the claim lease is still ours', async () => {
    const dedupe = `beb-lease-${crypto.randomUUID()}`;
    await query(`INSERT INTO background_jobs (kind, dedupe_key, payload, run_at, max_attempts) VALUES ('platform.heartbeat', $1, '{}', now() - interval '1 hour', 3)`, [dedupe]);
    const now = new Date();
    const [first] = await platformRepo.claimJobs(pool, ['platform.heartbeat'], [30], now, 100).then((r) => r.filter((j) => j.dedupe_key === dedupe));
    expect(first).toBeTruthy();
    // The lease expires and a newer run claims the job.
    const later = new Date(now.getTime() + 60_000);
    const second = (await platformRepo.claimJobs(pool, ['platform.heartbeat'], [30], later, 100)).find((j) => j.dedupe_key === dedupe)!;
    expect(second.lease_until.getTime()).not.toBe(first.lease_until.getTime());
    expect(await platformRepo.markJobDone(pool, first.id, later, first.lease_until)).toBe(false);
    expect(await platformRepo.markJobRetry(pool, first.id, later, 'late', false, first.lease_until)).toBe(false);
    expect((await query(`SELECT state FROM background_jobs WHERE id = $1`, [first.id])).rows[0].state).toBe('queued');
    expect(await platformRepo.markJobDone(pool, second.id, later, second.lease_until)).toBe(true);
  });

  it('D-03: two concurrent dispatchers email each alert once', async () => {
    await query(`UPDATE ops_alerts SET sent_at = now() WHERE sent_at IS NULL`);
    const k = `test.${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) {
      await query(`INSERT INTO ops_alerts (kind, detail, dedupe_key) VALUES ($1, 'x', $2)`, [k, `${k}:${i}`]);
    }
    process.env.ALERT_EMAIL_TO = 'ops@udigity.test';
    setEmailTransport(createMemoryTransport('alerts@udigity.test'));
    mailSink.clear();
    const [a, b] = await Promise.all([sendOpsAlerts(), sendOpsAlerts()]);
    expect(a.sent + b.sent).toBe(3);
    expect(mailSink.messages().length).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------------------

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
}
const cookieFrom = (res: request.Response): string => {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
};
function call(a: Agent, method: 'get' | 'post', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
  return body ? r.send(body) : r;
}

describe.skipIf(!hasTestDb)('FIX-BE-B attendance', () => {
  let owner: Agent;
  let employee: Agent;
  let ownerSessionId: string;

  beforeAll(async () => {
    setAttendanceFlagOverridesForTests({ 'attendance.breaksEnabled': true });
    const OWNER = 'udigity@gmail.com';
    await query(
      `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL
        WHERE employee_id = (SELECT id FROM employees WHERE LOWER(email) = LOWER($1))`,
      [OWNER]
    );
    const s1 = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: OWNER, password: 'Password123!' });
    const s2 = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieFrom(s1))
      .set('X-CSRF-Token', s1.body.csrfToken)
      .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
    expect(s2.status).toBe(200);
    const { rows: o } = await query<{ id: string }>('SELECT id FROM employees WHERE LOWER(email) = LOWER($1)', [OWNER]);
    owner = { cookie: cookieFrom(s2), csrf: s2.body.csrfToken, id: o[0].id };
    await query(
      `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes,
         verification_mode, office_ips, holidays, holidays_confirmed, summary_required, summary_min_length, missing_checkout_flag_hours, reason, created_by)
       VALUES (COALESCE((SELECT MAX(version_no) + 1 FROM attendance_settings_versions), 1), 'Asia/Beirut',
         ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'], '09:00', '18:00', 15, 'ip', ARRAY['127.0.0.1','::1','::ffff:127.0.0.1'],
         '{}'::date[], true, true, 10, 12, 'FIX-BE-B test settings', $1)`,
      [owner.id]
    );
    const email = `beb.${Date.now()}@udigity.demo`;
    const { rows: e } = await query<{ id: string }>(
      `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Beb Tester', 'data_entry', true) RETURNING id`,
      [email]
    );
    await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [e[0].id, await bcrypt.hash('Password123!', 4)]);
    const l = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: 'Password123!' });
    employee = { cookie: cookieFrom(l), csrf: l.body.csrfToken, id: e[0].id };
    const { rows: s } = await query<{ id: string }>(
      `INSERT INTO attendance_sessions (employee_id, state, origin, work_date, check_in_at, check_out_at, effective_check_in_at,
         effective_check_out_at, remote, check_in_verification)
       VALUES ($1, 'closed_provisional', 'check_in', '2026-01-05', '2026-01-05T07:00:00Z', '2026-01-05T15:00:00Z',
         '2026-01-05T07:00:00Z', '2026-01-05T15:00:00Z', false, '{}') RETURNING id`,
      [owner.id]
    );
    ownerSessionId = s[0].id;
  });
  afterEach(() => clock.set(null));
  afterAll(() => setAttendanceFlagOverridesForTests({}));

  it('E-03: the Owner cannot adjust, resolve the review of, or create a retroactive session for themselves', async () => {
    const adj = await call(owner, 'post', `/api/attendance/sessions/${ownerSessionId}/adjust`, { version: 1, reason: 'x', checkOutAt: '2026-01-05T16:00:00Z' });
    expect(adj.status).toBe(403);
    expect(adj.body.details?.reason ?? adj.body.reason).toBe('SELF_DECISION');
    const rev = await call(owner, 'post', `/api/attendance/sessions/${ownerSessionId}/resolve-review`, { version: 1 });
    expect(rev.status).toBe(403);
    const retro = await call(owner, 'post', '/api/attendance/sessions', {
      employeeId: owner.id,
      checkInAt: '2026-01-06T07:00:00Z',
      checkOutAt: '2026-01-06T15:00:00Z',
      reason: 'forgot',
    });
    expect(retro.status).toBe(403);
    // Another employee is still allowed.
    const ok = await call(owner, 'post', '/api/attendance/sessions', {
      employeeId: employee.id,
      checkInAt: '2026-01-06T07:00:00Z',
      checkOutAt: '2026-01-06T15:00:00Z',
      reason: 'forgot to check in',
    });
    expect(ok.status).toBe(201);
  });

  it('C-19: no new break starts once the 60 minute allowance is used up', async () => {
    const t0 = new Date();
    clock.set(t0);
    expect((await call(employee, 'post', '/api/attendance/check-in', {})).status).toBe(201);
    expect((await call(employee, 'post', '/api/attendance/breaks/start', { breakType: 'unpaid' })).status).toBe(201);
    clock.set(new Date(t0.getTime() + 61 * 60_000));
    expect((await call(employee, 'post', '/api/attendance/breaks/end', {})).status).toBe(200);
    const again = await call(employee, 'post', '/api/attendance/breaks/start', { breakType: 'unpaid' });
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.body)).toContain('BREAK_ALLOWANCE_USED');
  });
});
