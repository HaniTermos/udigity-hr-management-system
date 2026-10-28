/**
 * BE1 Increment 3 — attendance API tests (DB). Run only with TEST_DATABASE_URL (BE1: udigity_test_be1).
 * Covers: per-role matrix for every attendance route (4 roles + Owner pending 2FA); check-in/out with
 * the DEC-009 office check incl. X-Forwarded-For spoofing with and without proxy trust; DEC-010 remote
 * exceptions (+ self-request flag both branches); DEC-012 summary (both settings branches); DEC-026
 * failed checkout (all three flag branches); DEC-011 corrections (flag both branches, F-01, N-2,
 * originals kept, audit); timezone/day boundaries and DEC-008 grace; settings versions + validation;
 * J-04; OWN-004 overview; My Attendance; employee list open work; revoke-all sessions; capabilities.
 * Rows are uniquely named and never deleted (FKs RESTRICT, audit append-only).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEMO_LABEL } from '../../shared/flags.js';
import { runSystemCommand } from '../../shared/tx.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { clock } from '../platform/clock.js';
import { relayOutboxOnce } from '../platform/service.js';
import { runExceptionCheck, setAttendanceFlagOverridesForTests } from './service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const SEED_OWNER = 'udigity@gmail.com';
const SOME_ID = '00000000-0000-4000-8000-000000000001';

type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';
interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  email: string;
}

const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

function cookieFrom(res: request.Response): string {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
}

async function login(email: string, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
  return { res, cookie: cookieFrom(res), csrf: res.body.csrfToken as string };
}

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
function call(a: Pick<Agent, 'cookie' | 'csrf'>, method: Method, path: string, body?: object, headers: Record<string, string> = {}) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
  for (const [k, v] of Object.entries(headers)) r.set(k, v);
  return body ? r.send(body) : r;
}

async function employeeId(email: string): Promise<string> {
  const { rows } = await query<{ id: string }>('SELECT id FROM employees WHERE LOWER(email) = LOWER($1)', [email]);
  return rows[0].id;
}

async function ownerAgent(): Promise<Agent> {
  const id = await employeeId(SEED_OWNER);
  await query(
    `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL WHERE employee_id = $1`,
    [id]
  );
  const s = await login(SEED_OWNER);
  const v = await call(s, 'post', '/api/auth/2fa/verify', { token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id, email: SEED_OWNER };
}

async function makeEmployee(role: Role): Promise<{ id: string; email: string }> {
  const email = `att.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `Att ${role} ${uniq()}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}

async function agentFor(role: Exclude<Role, 'owner'>): Promise<Agent> {
  const e = await makeEmployee(role);
  const s = await login(e.email);
  expect(s.res.status).toBe(200);
  return { cookie: s.cookie, csrf: s.csrf, ...e };
}

async function pendingOwner(): Promise<Agent> {
  const s = await login(SEED_OWNER);
  return { cookie: s.cookie, csrf: s.csrf, id: await employeeId(SEED_OWNER), email: SEED_OWNER };
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await query<{ n: string }>(sql, params);
  return Number(rows[0].n);
}
const auditCount = (eventName: string, entityId: string) =>
  count('SELECT COUNT(*)::text AS n FROM audit_events WHERE event_name = $1 AND entity_id = $2', [eventName, entityId]);
const outboxCount = (name: string, aggregateId: string) =>
  count('SELECT COUNT(*)::text AS n FROM outbox_events WHERE name = $1 AND aggregate_id = $2', [name, aggregateId]);

/** Friday 2026-10-23 in Beirut (UTC+3): `at('09:05')` = 06:05Z. */
const at = (hhmm: string, date = '2026-10-23') => new Date(`${date}T${hhmm}:00+03:00`);
const pin = (d: Date) => clock.set(d);

const LOCAL_IPS = ['127.0.0.1', '::1'];
const BASE_SETTINGS = {
  timezone: 'Asia/Beirut',
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  shiftStart: '09:00',
  shiftEnd: '18:00',
  graceMinutes: 10,
  verificationMode: 'ip',
  officeIps: LOCAL_IPS,
  holidays: ['2026-12-25'],
  summaryRequired: true,
  summaryMinLength: 10,
  missingCheckoutFlagHours: 6,
};

describe.skipIf(!hasTestDb)('BE1 Increment 3 — attendance (DB)', () => {
  let owner: Agent;
  let de: Agent;
  let cc: Agent;
  let dv: Agent;

  async function putSettings(patch: Partial<typeof BASE_SETTINGS> = {}) {
    const cur = await call(owner, 'get', '/api/attendance/settings');
    expect(cur.status).toBe(200);
    const res = await call(owner, 'put', '/api/attendance/settings', { ...BASE_SETTINGS, ...patch, version: cur.body.current.versionNo ?? 0 });
    expect(res.status).toBe(200);
    return res;
  }

  beforeAll(async () => {
    owner = await ownerAgent();
    de = await agentFor('data_entry');
    cc = await agentFor('call_center');
    dv = await agentFor('developer');
    await putSettings();
  });

  afterEach(async () => {
    clock.set(null);
    setAttendanceFlagOverridesForTests({});
    app.set('trust proxy', config.trustProxy ? 1 : false);
  });

  afterAll(async () => {
    // Relay the attendance events this suite emitted, so other suites' relay tests start from an
    // empty backlog (events without a consumer are simply marked done).
    for (let i = 0; i < 500; i++) if ((await relayOutboxOnce()).claimed === 0) break;
    // Other suites in this DB expect company.timezone unset (it is a NEEDS VALUE setting).
    await query(`UPDATE company_settings SET "values" = "values" - 'company.timezone' WHERE id = 1`);
    await pool.end();
  });

  // ---------------------------------------------------------------------------------------------
  // Role matrix (authz §4.1): every route × 4 roles + Owner pending 2FA. Allowed calls use bodies that
  // fail validation (or ids that do not exist), so nothing is changed; denied calls are 403.
  // ---------------------------------------------------------------------------------------------
  describe('role matrix', () => {
    const ALL: Role[] = ['owner', 'data_entry', 'call_center', 'developer'];
    const O: Role[] = ['owner'];
    type Row = { method: Method; path: string; allowed: Role[]; body?: object };
    const rows: Row[] = [
      { method: 'get', path: '/api/attendance/me/today', allowed: ALL },
      { method: 'get', path: '/api/attendance/me/sessions', allowed: ALL },
      { method: 'post', path: '/api/attendance/check-in', allowed: ALL, body: { bad: 1 } },
      { method: 'post', path: '/api/attendance/check-out', allowed: ALL, body: { bad: 1 } },
      { method: 'get', path: '/api/attendance/sessions', allowed: ALL },
      { method: 'post', path: '/api/attendance/sessions', allowed: O, body: { bad: 1 } },
      { method: 'get', path: `/api/attendance/sessions/${SOME_ID}`, allowed: ALL },
      { method: 'post', path: `/api/attendance/sessions/${SOME_ID}/adjust`, allowed: O, body: { bad: 1 } },
      { method: 'post', path: `/api/attendance/sessions/${SOME_ID}/resolve-review`, allowed: O, body: { bad: 1 } },
      { method: 'post', path: '/api/attendance/corrections', allowed: ALL, body: { bad: 1 } },
      { method: 'get', path: '/api/attendance/corrections', allowed: ALL },
      { method: 'get', path: `/api/attendance/corrections/${SOME_ID}`, allowed: ALL },
      { method: 'post', path: `/api/attendance/corrections/${SOME_ID}/approve`, allowed: O, body: { bad: 1 } },
      { method: 'post', path: `/api/attendance/corrections/${SOME_ID}/reject`, allowed: O, body: { bad: 1 } },
      { method: 'post', path: `/api/attendance/corrections/${SOME_ID}/withdraw`, allowed: ALL, body: { bad: 1 } },
      { method: 'get', path: '/api/attendance/overview', allowed: O },
      { method: 'get', path: '/api/attendance/settings', allowed: ALL },
      { method: 'put', path: '/api/attendance/settings', allowed: O, body: { bad: 1 } },
      { method: 'post', path: '/api/attendance/settings/test-office-check', allowed: O, body: { bad: 1 } },
      { method: 'get', path: '/api/attendance/remote-exceptions', allowed: ALL },
      { method: 'post', path: '/api/attendance/remote-exceptions', allowed: O, body: { bad: 1 } },
      { method: 'post', path: '/api/attendance/remote-exceptions/requests', allowed: ALL, body: { bad: 1 } },
      { method: 'post', path: `/api/attendance/remote-exceptions/${SOME_ID}/approve`, allowed: O, body: { bad: 1 } },
      { method: 'post', path: `/api/attendance/remote-exceptions/${SOME_ID}/reject`, allowed: O, body: { bad: 1 } },
      { method: 'post', path: `/api/attendance/remote-exceptions/${SOME_ID}/revoke`, allowed: O, body: { bad: 1 } },
      { method: 'post', path: '/api/auth/sessions/revoke-all', allowed: ALL, body: { bad: 1 } },
    ];

    it('every route: allowed roles pass the guard, others get 403; a pending Owner gets 403', async () => {
      const agents: Record<Role, Agent> = { owner, data_entry: de, call_center: cc, developer: dv };
      const pending = await pendingOwner();
      for (const row of rows) {
        for (const role of ALL) {
          const res = await call(agents[role], row.method, row.path, row.body);
          const label = `${row.method.toUpperCase()} ${row.path} as ${role} → ${res.status} ${res.body?.code ?? ''}`;
          if (row.allowed.includes(role)) expect([200, 201, 400, 404], label).toContain(res.status);
          else expect(res.status, label).toBe(403);
        }
        const p = await call(pending, row.method, row.path, row.body);
        expect(p.status, `${row.path} pending Owner`).toBe(403);
      }
    }, 120_000);

    it('review-queue mode of GET /corrections is Owner only (resource-level 403)', async () => {
      expect((await call(cc, 'get', '/api/attendance/corrections?kind=employee_request')).status).toBe(403);
      const ok = await call(owner, 'get', '/api/attendance/corrections?kind=employee_request');
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ counts: expect.any(Object), previews: expect.any(Array) });
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Check-in, punctuality and day boundaries (DEC-007/008/022)
  // ---------------------------------------------------------------------------------------------
  describe('check-in and punctuality', () => {
    it('office IP passes: one open session, server time, on time; second check-in → 409 OPEN_SESSION', async () => {
      const a = await agentFor('call_center');
      pin(at('09:05'));
      const res = await call(a, 'post', '/api/attendance/check-in', {});
      expect(res.status).toBe(201);
      const s = res.body.session;
      expect(s).toMatchObject({
        state: 'open',
        workDate: '2026-10-23',
        punctuality: 'on_time',
        checkInAt: '2026-10-23T06:05:00.000Z',
        verification: { checkIn: { result: 'passed', mode: 'ip' }, checkOut: null },
        durationStatus: 'open',
        remote: false,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/127\.0\.0\.1|::1/); // no IP returned
      expect(await auditCount('attendance.checked_in', s.id)).toBe(1);
      const again = await call(a, 'post', '/api/attendance/check-in', {});
      expect(again.status).toBe(409);
      expect(again.body).toMatchObject({ code: 'STATE_CONFLICT', details: { reason: 'OPEN_SESSION', sessionId: s.id } });
    });

    it('two simultaneous check-ins create exactly one open session (AC-ATT-008)', async () => {
      const a = await agentFor('developer');
      const [r1, r2] = await Promise.all([call(a, 'post', '/api/attendance/check-in', {}), call(a, 'post', '/api/attendance/check-in', {})]);
      expect([r1.status, r2.status].sort()).toEqual([201, 409]);
      expect(await count(`SELECT COUNT(*)::text AS n FROM attendance_sessions WHERE employee_id = $1 AND state = 'open'`, [a.id])).toBe(1);
    });

    it('grace boundary: 09:10:59 on time, 09:11 late (11 min)', async () => {
      const a = await agentFor('data_entry');
      pin(new Date('2026-10-23T06:10:59Z'));
      expect((await call(a, 'post', '/api/attendance/check-in', {})).body.session.punctuality).toBe('on_time');
      const b = await agentFor('data_entry');
      pin(at('09:11'));
      const late = (await call(b, 'post', '/api/attendance/check-in', {})).body.session;
      expect(late).toMatchObject({ punctuality: 'late', lateMinutes: 11 });
    });

    it('company-timezone day boundary: 23:59:59 local is Friday, 00:00 local is Saturday (non-working day)', async () => {
      const a = await agentFor('call_center');
      pin(new Date('2026-10-23T20:59:59Z')); // 23:59:59 Beirut Friday
      const fri = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      expect(fri).toMatchObject({ workDate: '2026-10-23', punctuality: 'late' });
      const b = await agentFor('call_center');
      pin(new Date('2026-10-23T21:00:00Z')); // 00:00 Beirut Saturday, still Friday in UTC
      const sat = (await call(b, 'post', '/api/attendance/check-in', {})).body.session;
      expect(sat).toMatchObject({ workDate: '2026-10-24', punctuality: 'non_working_day' });
    });

    it('holiday → non-working day; Owner checks in under the same office check (F-04)', async () => {
      const a = await agentFor('developer');
      pin(at('09:30', '2026-12-25'));
      expect((await call(a, 'post', '/api/attendance/check-in', {})).body.session.punctuality).toBe('non_working_day');
      // Owner: close any session left by an earlier run, then check in like everyone else.
      await query(`UPDATE attendance_sessions SET state = 'closed', check_out_at = check_in_at, effective_check_out_at = effective_check_in_at WHERE employee_id = $1 AND state = 'open'`, [owner.id]);
      pin(at('08:59', '2026-10-26'));
      const o = await call(owner, 'post', '/api/attendance/check-in', {});
      expect(o.status).toBe(201);
      expect(o.body.session.verification.checkIn.result).toBe('passed');
      pin(at('18:30', '2026-10-26'));
      expect((await call(owner, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Owner day of reviews' } })).status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // DEC-009 office IP + proxy trust + DEC-010 remote exceptions
  // ---------------------------------------------------------------------------------------------
  describe('office IP check, spoofing and remote exceptions', () => {
    afterAll(async () => {
      await putSettings();
    });

    it('a spoofed X-Forwarded-For is ignored without proxy trust; with 1 trusted hop only the proxy-appended entry counts', async () => {
      await putSettings({ officeIps: ['203.0.113.0/24'] });
      const a = await agentFor('call_center');
      pin(at('09:00'));
      // No proxy trust (default): the socket address decides; the header is ignored.
      const spoof = await call(a, 'post', '/api/attendance/check-in', {}, { 'X-Forwarded-For': '203.0.113.5' });
      expect(spoof.status).toBe(422);
      expect(spoof.body).toMatchObject({ code: 'RULE_VIOLATION', details: { reason: 'OFFICE_CHECK_FAILED', mode: 'ip' } });
      expect(await count(`SELECT COUNT(*)::text AS n FROM attendance_sessions WHERE employee_id = $1`, [a.id])).toBe(0);
      // AC-ATT-005: the failed attempt is audited (committed although the request failed).
      expect(await auditCount('attendance.checkin_failed', a.id)).toBe(1);

      app.set('trust proxy', 1);
      // Client-supplied left entry + real client appended by our proxy: the right-most entry wins.
      const leftSpoof = await call(a, 'post', '/api/attendance/check-in', {}, { 'X-Forwarded-For': '203.0.113.5, 192.0.2.10' });
      expect(leftSpoof.status).toBe(422);
      const real = await call(a, 'post', '/api/attendance/check-in', {}, { 'X-Forwarded-For': '192.0.2.10, 203.0.113.5' });
      expect(real.status).toBe(201);
      expect(real.body.session.verification.checkIn.result).toBe('passed');
    });

    it('DEC-010: an Owner-granted remote exception lets the employee check in from outside (session `remote`)', async () => {
      await putSettings({ officeIps: ['203.0.113.0/24'] });
      const a = await agentFor('developer');
      pin(at('09:02'));
      expect((await call(a, 'post', '/api/attendance/check-in', {})).status).toBe(422);
      const g = await call(owner, 'post', '/api/attendance/remote-exceptions', { employeeId: a.id, startDate: '2026-10-23', reason: 'Client site' });
      expect(g.status).toBe(201);
      expect(g.body).toMatchObject({ status: 'granted', startDate: '2026-10-23', endDate: '2026-10-23' });
      const ok = await call(a, 'post', '/api/attendance/check-in', {});
      expect(ok.status).toBe(201);
      expect(ok.body.session).toMatchObject({ remote: true, verification: { checkIn: { result: 'remote' } } });
      // Checkout from outside also passes under the exception.
      pin(at('18:05'));
      const out = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Workshop at the client' } });
      expect(out.body).toMatchObject({ outcome: 'closed', session: { durationMinutes: 543, durationStatus: 'met' } });
      // Revoke (Owner) → state change audited; repeat is a no-op.
      const r1 = await call(owner, 'post', `/api/attendance/remote-exceptions/${g.body.id}/revoke`, { version: g.body.version });
      expect(r1.body.status).toBe('revoked');
      expect((await call(owner, 'post', `/api/attendance/remote-exceptions/${g.body.id}/revoke`, { version: g.body.version })).status).toBe(200);
      // Employee sees only their own exceptions.
      const mine = await call(a, 'get', '/api/attendance/remote-exceptions');
      expect(mine.body.items.every((r: { employeeId: string }) => r.employeeId === a.id)).toBe(true);
      const others = await call(de, 'get', '/api/attendance/remote-exceptions');
      expect(others.body.items.some((r: { employeeId: string }) => r.employeeId === a.id)).toBe(false);
    });

    it('DEC-010 self-request flag: false (default) → 403; true → requested, Owner approves/rejects (reason required)', async () => {
      const a = await agentFor('call_center');
      expect((await call(a, 'post', '/api/attendance/remote-exceptions/requests', { startDate: '2026-10-27', reason: 'Plumber visit' })).status).toBe(403);
      setAttendanceFlagOverridesForTests({ 'attendance.remoteSelfRequest': true });
      const req1 = await call(a, 'post', '/api/attendance/remote-exceptions/requests', { startDate: '2026-10-27', endDate: '2026-10-28', reason: 'Plumber visit' });
      expect(req1.status).toBe(201);
      expect(req1.body.status).toBe('requested');
      const noReason = await call(owner, 'post', `/api/attendance/remote-exceptions/${req1.body.id}/reject`, { version: req1.body.version });
      expect(noReason.status).toBe(400);
      const ap = await call(owner, 'post', `/api/attendance/remote-exceptions/${req1.body.id}/approve`, { version: req1.body.version });
      expect(ap.body.status).toBe('granted');
      const stale = await call(owner, 'post', `/api/attendance/remote-exceptions/${req1.body.id}/revoke`, { version: req1.body.version });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('VERSION_CONFLICT');
      expect((await call(a, 'post', '/api/attendance/remote-exceptions/requests', { startDate: '2026-10-28', endDate: '2026-10-27', reason: 'x' })).status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Checkout: DEC-012 summary (both setting values) and DEC-026 (all three flag branches)
  // ---------------------------------------------------------------------------------------------
  describe('check-out', () => {
    afterAll(async () => {
      await putSettings();
    });

    it('DEC-012 required: short summary → 400 and the session stays open; valid → closed with duration vs 9 h', async () => {
      const a = await agentFor('data_entry');
      pin(at('09:00'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      pin(at('17:00'));
      const short = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'too short' } });
      expect(short.status).toBe(400);
      expect(short.body.details['summary.workCompleted']).toBeDefined();
      expect((await call(a, 'get', '/api/attendance/me/today')).body.session.state).toBe('open');
      const stale = await call(a, 'post', '/api/attendance/check-out', { version: s.version + 5, summary: { workCompleted: 'Entered 40 businesses' } });
      expect(stale.status).toBe(409);
      const ok = await call(a, 'post', '/api/attendance/check-out', {
        version: s.version,
        summary: { workCompleted: 'Entered 40 businesses', blockers: 'None' },
      });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({
        outcome: 'closed',
        session: { state: 'closed', durationMinutes: 480, durationStatus: 'short', summary: { workCompleted: 'Entered 40 businesses', blockers: 'None' } },
      });
      expect(await auditCount('attendance.checked_out', s.id)).toBe(1);
      const none = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Entered 40 businesses' } });
      expect(none.status).toBe(409);
      expect(none.body.details.reason).toBe('NO_OPEN_SESSION');
    });

    it('DEC-012 optional (setting off): empty summary is accepted', async () => {
      await putSettings({ summaryRequired: false });
      const a = await agentFor('developer');
      pin(at('09:00'));
      await call(a, 'post', '/api/attendance/check-in', {});
      pin(at('18:00'));
      const ok = await call(a, 'post', '/api/attendance/check-out', {});
      expect(ok.status).toBe(200);
      expect(ok.body.session).toMatchObject({ state: 'closed', summary: null, durationStatus: 'met' });
      await putSettings();
    });

    async function openThenFailCheckout(): Promise<{ a: Agent; sessionId: string }> {
      const a = await agentFor('call_center');
      pin(at('09:00'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      await putSettings({ officeIps: ['203.0.113.0/24'] }); // the employee left the office network
      pin(at('18:10'));
      return { a, sessionId: s.id };
    }

    it('DEC-026 provisional (default): closed provisionally at the attempted time + review item; next check-in allowed', async () => {
      const { a, sessionId } = await openThenFailCheckout();
      const res = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Called 30 businesses' } });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        outcome: 'closed_provisional',
        session: { state: 'closed_provisional', checkoutFailureReason: 'office_check_failed', reviewPending: true, summary: { workCompleted: 'Called 30 businesses' } },
      });
      expect(res.body.session.checkOutAt).toBe('2026-10-23T15:10:00.000Z');
      expect(await auditCount('attendance.checkout_provisional', sessionId)).toBe(1);
      expect(await outboxCount('attendance.checkout_provisional', sessionId)).toBe(1);
      await putSettings();
      pin(at('09:00', '2026-10-26'));
      expect((await call(a, 'post', '/api/attendance/check-in', {})).status).toBe(201);
      // Owner resolves the review item (confirms the attempted time).
      const q = await call(owner, 'get', '/api/attendance/corrections?kind=missing_checkout&pageSize=100');
      const item = q.body.items.find((i: { sessionId: string }) => i.sessionId === sessionId);
      expect(item).toMatchObject({ kind: 'missing_checkout', sessionState: 'closed_provisional' });
      const resolved = await call(owner, 'post', `/api/attendance/sessions/${sessionId}/resolve-review`, { version: item.version });
      expect(resolved.status).toBe(200);
      expect(resolved.body.session).toMatchObject({ state: 'closed', reviewPending: false, effectiveCheckOutAt: '2026-10-23T15:10:00.000Z' });
    });

    it('DEC-026 hold: pending review, no checkout time until the Owner sets one', async () => {
      setAttendanceFlagOverridesForTests({ 'attendance.failedCheckout': 'hold' });
      const { a, sessionId } = await openThenFailCheckout();
      const res = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Called 30 businesses' } });
      expect(res.body).toMatchObject({ outcome: 'pending_review', session: { state: 'pending_review', checkOutAt: null } });
      expect(await outboxCount('attendance.checkout_pending_review', sessionId)).toBe(1);
      const r = await call(owner, 'post', `/api/attendance/sessions/${sessionId}/resolve-review`, {
        version: res.body.session.version,
        checkOutAt: '2026-10-23T15:00:00.000Z',
        reason: 'Confirmed with the employee',
      });
      expect(r.body.session).toMatchObject({ state: 'closed', adjusted: true, effectiveCheckOutAt: '2026-10-23T15:00:00.000Z', checkOutAt: null });
      await putSettings();
    });

    it('DEC-026 block: 422 OFFICE_CHECK_FAILED, summary saved, session stays open', async () => {
      setAttendanceFlagOverridesForTests({ 'attendance.failedCheckout': 'block' });
      const { a, sessionId } = await openThenFailCheckout();
      const res = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Called 30 businesses' } });
      expect(res.status).toBe(422);
      expect(res.body.details).toMatchObject({ reason: 'OFFICE_CHECK_FAILED', outcome: 'blocked', sessionId });
      const s = (await call(a, 'get', `/api/attendance/sessions/${sessionId}`)).body.session;
      expect(s).toMatchObject({ state: 'open', summary: { workCompleted: 'Called 30 businesses' } });
      expect(s.checkoutAttemptedAt).toBe('2026-10-23T15:10:00.000Z');
      expect(await auditCount('attendance.checkout_failed', sessionId)).toBe(1);
      await putSettings();
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Corrections (DEC-011) — flag both branches, F-01, N-2, originals kept, audit
  // ---------------------------------------------------------------------------------------------
  describe('corrections', () => {
    async function closedSession(a: Agent, date = '2026-10-21') {
      pin(at('09:00', date));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      pin(at('18:00', date));
      await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Regular work day' } });
      return s.id as string;
    }

    it('Alt B (flag true): request → Owner approves; original kept, effective + adjusted; punctuality re-derived (F-03)', async () => {
      const a = await agentFor('data_entry');
      const sid = await closedSession(a);
      pin(at('12:00', '2026-10-23'));
      const req1 = await call(a, 'post', '/api/attendance/corrections', {
        sessionId: sid,
        proposedCheckInAt: '2026-10-21T08:30:00+03:00',
        reason: 'Badge reader was down',
      });
      expect(req1.status).toBe(201);
      expect(req1.body).toMatchObject({ status: 'submitted', kind: 'request', sessionId: sid });
      expect(await outboxCount('attendance_correction.submitted', req1.body.id)).toBe(1);
      const dup = await call(a, 'post', '/api/attendance/corrections', { sessionId: sid, proposedCheckInAt: '2026-10-21T08:40:00+03:00', reason: 'again' });
      expect(dup.status).toBe(409);

      const noReason = await call(owner, 'post', `/api/attendance/corrections/${req1.body.id}/reject`, { version: req1.body.version });
      expect(noReason.status).toBe(400);
      const ap = await call(owner, 'post', `/api/attendance/corrections/${req1.body.id}/approve`, { version: req1.body.version });
      expect(ap.status).toBe(200);
      expect(ap.body.status).toBe('approved');
      const s = (await call(a, 'get', `/api/attendance/sessions/${sid}`)).body;
      expect(s.session).toMatchObject({
        checkInAt: '2026-10-21T06:00:00.000Z', // original never overwritten
        effectiveCheckInAt: '2026-10-21T05:30:00.000Z',
        adjusted: true,
        punctuality: 'on_time',
      });
      expect(s.corrections).toHaveLength(1);
      expect(await auditCount('attendance_correction.approved', req1.body.id)).toBe(1);
      expect(await auditCount('attendance.corrected', sid)).toBe(1);
      // Repeat approve = no-op 200.
      expect((await call(owner, 'post', `/api/attendance/corrections/${req1.body.id}/approve`, { version: req1.body.version })).status).toBe(200);
    });

    it('validation: future, checkout before check-in and overlap are 422; IDOR is 404', async () => {
      const a = await agentFor('call_center');
      const s1 = await closedSession(a, '2026-10-20');
      const s2 = await closedSession(a, '2026-10-21');
      pin(at('12:00', '2026-10-23'));
      const body = (o: object) => ({ sessionId: s2, reason: 'fix', ...o });
      const future = await call(a, 'post', '/api/attendance/corrections', body({ proposedCheckOutAt: '2026-10-24T18:00:00+03:00' }));
      expect(future.body.details.reason).toBe('IN_FUTURE');
      const before = await call(a, 'post', '/api/attendance/corrections', body({ proposedCheckOutAt: '2026-10-21T08:00:00+03:00' }));
      expect(before.body.details.reason).toBe('CHECKOUT_BEFORE_CHECKIN');
      const overlap = await call(a, 'post', '/api/attendance/corrections', body({ proposedCheckInAt: '2026-10-20T17:00:00+03:00' }));
      expect(overlap.status).toBe(422);
      expect(overlap.body.details.reason).toBe('OVERLAP');
      expect(s1).toBeTruthy();
      // Another employee's session / request.
      const other = await agentFor('developer');
      const idor = await call(other, 'post', '/api/attendance/corrections', { sessionId: s2, proposedCheckInAt: '2026-10-21T08:30:00+03:00', reason: 'x' });
      expect(idor.status).toBe(404);
      expect((await call(other, 'get', `/api/attendance/sessions/${s2}`)).status).toBe(404);
      const mine = await call(a, 'post', '/api/attendance/corrections', { sessionId: s2, proposedCheckInAt: '2026-10-21T08:55:00+03:00', reason: 'ok' });
      expect((await call(other, 'get', `/api/attendance/corrections/${mine.body.id}`)).status).toBe(404);
      expect((await call(other, 'post', `/api/attendance/corrections/${mine.body.id}/withdraw`, { version: mine.body.version })).status).toBe(404);
      // Requester withdraws.
      const w = await call(a, 'post', `/api/attendance/corrections/${mine.body.id}/withdraw`, { version: mine.body.version });
      expect(w.body.status).toBe('withdrawn');
      // Lists are scoped: employee sees only own, Owner sees this one.
      const list = await call(other, 'get', '/api/attendance/corrections');
      expect(list.body.items.some((c: { id: string }) => c.id === mine.body.id)).toBe(false);
      const ownerList = await call(owner, 'get', `/api/attendance/corrections?employeeId=${a.id}`);
      expect(ownerList.body.items.some((c: { id: string }) => c.id === mine.body.id)).toBe(true);
    });

    it('F-01: a request for a still-open earlier session closes it provisionally; check-in allowed; reject → unknown', async () => {
      const a = await agentFor('developer');
      pin(at('09:00', '2026-10-21'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      pin(at('09:00', '2026-10-22'));
      const blocked = await call(a, 'post', '/api/attendance/check-in', {});
      expect(blocked.body.details.reason).toBe('OPEN_SESSION');
      const req1 = await call(a, 'post', '/api/attendance/corrections', { sessionId: s.id, proposedCheckOutAt: '2026-10-21T18:00:00+03:00', reason: 'Forgot to check out' });
      expect(req1.body.closedSessionProvisionally).toBe(true);
      expect((await call(a, 'post', '/api/attendance/check-in', {})).status).toBe(201);
      const rej = await call(owner, 'post', `/api/attendance/corrections/${req1.body.id}/reject`, { version: req1.body.version, reason: 'No evidence', effectiveCheckOutAt: null });
      expect(rej.body.status).toBe('rejected');
      const after = (await call(owner, 'get', `/api/attendance/sessions/${s.id}`)).body.session;
      expect(after).toMatchObject({ state: 'closed', checkOutUnknown: true, effectiveCheckOutAt: null, checkOutAt: null, durationStatus: 'unknown' });
    });

    it('N-2: a request for a missing session; approval creates a retroactive session', async () => {
      const a = await agentFor('call_center');
      pin(at('12:00', '2026-10-23'));
      const req1 = await call(a, 'post', '/api/attendance/corrections', {
        proposedCheckInAt: '2026-10-19T09:00:00+03:00',
        proposedCheckOutAt: '2026-10-19T18:00:00+03:00',
        reason: 'Phone battery died',
      });
      expect(req1.status).toBe(201);
      const ap = await call(owner, 'post', `/api/attendance/corrections/${req1.body.id}/approve`, { version: req1.body.version });
      expect(ap.body.sessionId).toBeTruthy();
      const s = (await call(a, 'get', `/api/attendance/sessions/${ap.body.sessionId}`)).body.session;
      expect(s).toMatchObject({ origin: 'retroactive', state: 'closed', workDate: '2026-10-19', verification: { checkIn: { result: 'retroactive' } } });
    });

    it('Alt A (flag false): employee requests → 403; the Owner adjusts directly (original kept, audited)', async () => {
      setAttendanceFlagOverridesForTests({ 'attendance.employeeRequests': false });
      const a = await agentFor('data_entry');
      const sid = await closedSession(a, '2026-10-22');
      pin(at('12:00', '2026-10-23'));
      const denied = await call(a, 'post', '/api/attendance/corrections', { sessionId: sid, proposedCheckInAt: '2026-10-22T08:30:00+03:00', reason: 'x' });
      expect(denied.status).toBe(403);
      expect((await call(a, 'get', '/api/attendance/me/today')).body.employeeRequestsEnabled).toBe(false);
      const cur = (await call(owner, 'get', `/api/attendance/sessions/${sid}`)).body.session;
      const noReason = await call(owner, 'post', `/api/attendance/sessions/${sid}/adjust`, { version: cur.version, checkOutAt: '2026-10-22T17:30:00+03:00' });
      expect(noReason.status).toBe(400);
      const adj = await call(owner, 'post', `/api/attendance/sessions/${sid}/adjust`, { version: cur.version, checkOutAt: '2026-10-22T17:30:00+03:00', reason: 'Left early, approved' });
      expect(adj.status).toBe(200);
      expect(adj.body.session).toMatchObject({ checkOutAt: '2026-10-22T15:00:00.000Z', effectiveCheckOutAt: '2026-10-22T14:30:00.000Z', adjusted: true });
      expect(await auditCount('attendance.corrected', sid)).toBe(1);
      const stale = await call(owner, 'post', `/api/attendance/sessions/${sid}/adjust`, { version: cur.version, checkOutAt: '2026-10-22T17:00:00+03:00', reason: 'again' });
      expect(stale.status).toBe(409);
      expect(stale.body.details.currentVersion).toBe(cur.version + 1);
    });

    it('Owner retroactive session (N-2): 201, audited, overlap refused', async () => {
      const e = await makeEmployee('developer');
      pin(at('12:00', '2026-10-23'));
      const body = { employeeId: e.id, checkInAt: '2026-10-20T09:00:00+03:00', checkOutAt: '2026-10-20T18:00:00+03:00', reason: 'Missed check-in' };
      const r = await call(owner, 'post', '/api/attendance/sessions', body);
      expect(r.status).toBe(201);
      expect(await auditCount('attendance.retroactive_created', r.body.session.id)).toBe(1);
      expect((await call(owner, 'post', '/api/attendance/sessions', body)).status).toBe(422);
      expect((await call(owner, 'post', '/api/attendance/sessions', { ...body, employeeId: SOME_ID })).status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Settings versions (WF-ADMIN-001)
  // ---------------------------------------------------------------------------------------------
  describe('settings versions', () => {
    it('validation: IP mode needs IPs, no location verifier, invalid IPs; version conflict', async () => {
      const cur = (await call(owner, 'get', '/api/attendance/settings')).body;
      const v = cur.current.versionNo;
      const put = (o: object) => call(owner, 'put', '/api/attendance/settings', { ...BASE_SETTINGS, version: v, ...o });
      expect((await put({ officeIps: [] })).body.details.officeIps).toBeDefined();
      expect((await put({ verificationMode: 'geofence' })).body.details.verificationMode).toBeDefined();
      expect((await put({ officeIps: ['300.1.1.1'] })).body.details['officeIps.0']).toBeDefined();
      expect((await put({ timezone: 'Mars/Base' })).body.details.timezone).toBeDefined();
      expect((await put({ shiftEnd: '08:00' })).body.details.shiftEnd).toBeDefined();
      const stale = await put({ version: v - 1 });
      expect(stale.status).toBe(409);
      expect(stale.body.details.currentVersion).toBe(v);
      // A valid save creates version v+1, keeps the previous rows and is audited.
      const ok = await put({ graceMinutes: 15, reason: 'Traffic season' });
      expect(ok.body.current).toMatchObject({ versionNo: v + 1, graceMinutes: 15, source: 'version' });
      expect(ok.body.versions[1].versionNo).toBe(v);
      expect(await count(`SELECT COUNT(*)::text AS n FROM audit_events WHERE event_name = 'settings.updated' AND entity_type = 'attendance_settings' AND reason = 'Traffic season'`, [])).toBeGreaterThan(0);
      // company.timezone mirrors the saved version.
      const pub = await call(cc, 'get', '/api/settings/public');
      expect(pub.body.company['company.timezone']).toBe('Asia/Beirut');
      await putSettings();
    });

    it('a settings change applies to future sessions only (AC-SET-004)', async () => {
      const a = await agentFor('call_center');
      pin(at('09:12'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      expect(s.punctuality).toBe('late');
      await putSettings({ graceMinutes: 30 });
      const again = (await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session;
      expect(again.punctuality).toBe('late'); // still judged by the version it was created under
      const b = await agentFor('call_center');
      expect((await call(b, 'post', '/api/attendance/check-in', {})).body.session.punctuality).toBe('on_time');
      await putSettings();
    });

    it('non-Owners get derived values only; Owner gets IPs, holidays and versions; test office check saves nothing', async () => {
      const pub = (await call(dv, 'get', '/api/attendance/settings')).body;
      expect(pub.current.officeIps).toBeUndefined();
      expect(pub.versions).toBeUndefined();
      expect(pub).toMatchObject({ configured: true, label: DEMO_LABEL });
      const full = (await call(owner, 'get', '/api/attendance/settings')).body;
      expect(full.current.officeIps).toEqual(LOCAL_IPS);
      expect(full.versions.length).toBeGreaterThan(0);
      const before = full.current.versionNo;
      const t = await call(owner, 'post', '/api/attendance/settings/test-office-check', { officeIps: ['127.0.0.0/8', '::1'] });
      expect(t.body).toMatchObject({ mode: 'ip', result: 'passed' });
      const miss = await call(owner, 'post', '/api/attendance/settings/test-office-check', { officeIps: ['203.0.113.0/24'] });
      expect(miss.body.result).toBe('failed');
      expect((await call(owner, 'get', '/api/attendance/settings')).body.current.versionNo).toBe(before);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // J-04, OWN-004 overview, My Attendance, employee list
  // ---------------------------------------------------------------------------------------------
  describe('J-04, monitoring and reads', () => {
    it('J-04 flags a missing checkout after shift end + 6 h and never closes the session; missing check-in on working days only', async () => {
      const a = await agentFor('developer');
      pin(at('09:00', '2026-10-22'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      const noShow = await makeEmployee('call_center');

      pin(new Date('2026-10-22T20:59:00Z')); // 23:59 Beirut: before 18:00 + 6 h
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect((await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session.missingCheckout).toBe(false);

      pin(new Date('2026-10-23T07:00:00Z')); // Friday 10:00 Beirut: past 18:00+6 h and past 09:00+10+30 min
      const r = await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(r.missingCheckout).toBeGreaterThanOrEqual(1);
      const flagged = (await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session;
      expect(flagged).toMatchObject({ state: 'open', missingCheckout: true });
      expect(await outboxCount('attendance.missing_checkout_detected', s.id)).toBe(1);
      expect(await count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND employee_id = $1 AND work_date = '2026-10-23'`, [noShow.id])).toBe(1);
      // Idempotent: a second run adds nothing (one detection per kind / work date / employee).
      const checkinEvents = await outboxCount('attendance.missing_checkin_detected', noShow.id);
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await outboxCount('attendance.missing_checkout_detected', s.id)).toBe(1);
      expect(await outboxCount('attendance.missing_checkin_detected', noShow.id)).toBe(checkinEvents);

      // Saturday: no missing check-in detection.
      pin(at('12:00', '2026-10-24'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND work_date = '2026-10-24'`, [])).toBe(0);

      // OWN-004 overview + OWN-002 employee row reflect it.
      pin(new Date('2026-10-23T07:00:00Z'));
      const ov = await call(owner, 'get', `/api/attendance/overview?employeeId=${a.id}`);
      expect(ov.status).toBe(200);
      expect(ov.body.rows[0]).toMatchObject({ employeeId: a.id, status: 'open_previous', missingCheckout: true, employee: { id: a.id } });
      expect(ov.body.summary.missingCheckout).toBe(1);
      expect(ov.body.exceptions.some((e: { kind: string }) => e.kind === 'missing_checkout')).toBe(true);
      const ovNoShow = await call(owner, 'get', `/api/attendance/overview?employeeId=${noShow.id}`);
      expect(ovNoShow.body.rows[0]).toMatchObject({ status: 'not_checked_in', missingCheckin: true });
      const emp = await call(owner, 'get', `/api/employees/${a.id}`);
      expect(emp.body).toMatchObject({ missingCheckout: true, openWork: { openAttendanceSessions: 1 } });
      expect(emp.body.openWork.unavailable).not.toContain('openAttendanceSessions');
      const list = await call(owner, 'get', `/api/employees?q=${encodeURIComponent(a.email)}`);
      expect(list.body.items[0]).toMatchObject({ missingCheckout: true, openWork: { openAttendanceSessions: 1 } });
      const items = await call(owner, 'get', `/api/employees/${a.id}/open-items`);
      expect(items.body.openAttendanceSessions).toBe(1);
    }, 60_000);

    it('overview counts: checked in / out / late / remote; "not checked in" is not "absent"', async () => {
      pin(at('12:00', '2026-10-23'));
      const ov = (await call(owner, 'get', '/api/attendance/overview?date=2026-10-23')).body;
      expect(ov).toMatchObject({ date: '2026-10-23', workingDay: true, scheduleConfigured: true, configured: true, label: DEMO_LABEL });
      expect(ov.counts.employees).toBe(ov.rows.length);
      expect(ov.counts.checkedIn + ov.counts.checkedOut + ov.counts.notCheckedIn).toBeLessThanOrEqual(ov.rows.length);
      expect(ov.summary.lateArrivals).toBeGreaterThan(0);
      expect(JSON.stringify(ov)).not.toMatch(/absent/);
      expect(ov.rows.every((r: { verification: string }) => r.verification !== 'passed')).toBe(true); // AC-ATT-015
      const sat = (await call(owner, 'get', '/api/attendance/overview?date=2026-10-24')).body;
      expect(sat).toMatchObject({ workingDay: false, nonWorkingReason: 'weekend' });
      expect(sat.rows.some((r: { missingCheckin: boolean }) => r.missingCheckin)).toBe(false);
    });

    it('My Attendance: own sessions only, with a summary; /sessions is own for non-Owners, all for the Owner', async () => {
      const a = await agentFor('data_entry');
      for (const [d, inT] of [['2026-10-19', '09:00'], ['2026-10-20', '09:20']] as const) {
        pin(at(inT, d));
        await call(a, 'post', '/api/attendance/check-in', {});
        pin(at('18:30', d));
        await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Data entry batch' } });
      }
      const mine = (await call(a, 'get', '/api/attendance/me/sessions?from=2026-10-19&to=2026-10-20')).body;
      expect(mine.total).toBe(2);
      expect(mine.summary).toMatchObject({ sessions: 2, onTime: 1, late: 1, closedSessions: 2 });
      const asCc = (await call(cc, 'get', '/api/attendance/sessions?pageSize=100')).body;
      expect(asCc.items.every((s: { employeeId: string }) => s.employeeId === cc.id)).toBe(true);
      const asOwner = (await call(owner, 'get', `/api/attendance/sessions?employeeId=${a.id}`)).body;
      expect(asOwner.total).toBe(2);
      const today = (await call(a, 'get', '/api/attendance/me/today')).body;
      expect(today).toMatchObject({ configured: true, canCheckIn: true, summaryRule: { required: true, minLength: 10 }, label: DEMO_LABEL });
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Identity: revoke-all sessions; capabilities use registry/matrix names (SEC R3, CR1-01)
  // ---------------------------------------------------------------------------------------------
  describe('identity additions', () => {
    it('sign out everywhere ends every session (incl. this one); keepCurrent ends only the others', async () => {
      const e = await makeEmployee('call_center');
      const s1 = await login(e.email);
      const s2 = await login(e.email);
      const keep = await call(s1, 'post', '/api/auth/sessions/revoke-all', { keepCurrent: true });
      expect(keep.body).toMatchObject({ revoked: 1, currentSessionEnded: false });
      expect((await call(s1, 'get', '/api/auth/me')).status).toBe(200);
      expect((await call(s2, 'get', '/api/auth/me')).status).toBe(401);
      const s3 = await login(e.email);
      const all = await call(s3, 'post', '/api/auth/sessions/revoke-all', {});
      expect(all.body).toMatchObject({ revoked: 2, currentSessionEnded: true });
      expect((await call(s1, 'get', '/api/auth/me')).status).toBe(401);
      expect((await call(s3, 'get', '/api/auth/me')).status).toBe(401);
      expect(await count(`SELECT COUNT(*)::text AS n FROM audit_events WHERE event_name = 'session.revoked' AND entity_id = $1 AND actor_id = $2`, [e.id, e.id])).toBe(2);
    });

    it('/me capabilities use the declared matrix names', async () => {
      const o = (await call(owner, 'get', '/api/auth/me')).body.capabilities as string[];
      expect(o).toEqual(expect.arrayContaining(['settings.read', 'settings.update', 'audit.read', 'attendance.overview.read', 'attendance.correction.review', 'profile.read']));
      expect(o).not.toContain('setting.read');
      const c = (await call(cc, 'get', '/api/auth/me')).body.capabilities as string[];
      expect(c).toEqual(expect.arrayContaining(['attendance.check_in', 'attendance.read', 'settings.read_public', 'auth.session.revoke_all']));
      expect(c).not.toContain('settings.read');
      expect(c).not.toContain('attendance.overview.read');
    });
  });
});
