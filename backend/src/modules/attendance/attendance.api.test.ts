/**
 * BE1 Increment 3 — attendance API tests (DB). Run only with TEST_DATABASE_URL (BE1: udigity_test_be1).
 * Covers: per-role matrix for every attendance route (4 roles + Owner pending 2FA); check-in/out with
 * the DEC-009 office check incl. X-Forwarded-For spoofing with and without proxy trust; DEC-010 remote
 * exceptions (+ self-request flag both branches); DEC-012 summary (both settings branches); DEC-026
 * failed checkout (all three flag branches); DEC-011 corrections (flag both branches, F-01, N-2,
 * originals kept, audit); timezone/day boundaries and DEC-008 grace; settings versions + validation;
 * J-04; OWN-004 overview; My Attendance; employee list open work; revoke-all sessions; capabilities.
 * v1 policy baseline 2026-10-29 (D1–D6, D18): configured gate, shift end = start + 9 h, grace strictly
 * after, days off, earlier-day checkout refusal, self-decision guards, summary rule, J-04 timing.
 * Rows are uniquely named and never deleted (FKs RESTRICT, audit append-only).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query } from '../../db/pool.js';
import { restoreAttendanceSettings, snapshotAttendanceSettings, type SettingsSnapshot } from '../../tests/helpers/testState.js';
import { config } from '../../config/index.js';
import { DEMO_LABEL, loadPolicyFlags } from '../../shared/flags.js';
import { runSystemCommand } from '../../shared/tx.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { clock } from '../platform/clock.js';
import { relayOutboxOnce } from '../platform/service.js';
import { runExceptionCheck, setAttendanceFlagOverridesForTests } from './service.js';
import { setOfficeResolverForTests } from './officeDns.js';

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
async function relayAll() {
  for (let i = 0; i < 500; i++) if ((await relayOutboxOnce()).claimed === 0) break;
}

/** Friday 2026-10-23 in Beirut (UTC+3): `at('09:05')` = 06:05Z. */
const at = (hhmm: string, date = '2026-10-23') => new Date(`${date}T${hhmm}:00+03:00`);
const pin = (d: Date) => clock.set(d);
/** November 2026 in Beirut is winter time (UTC+2): `w('09:00', '2026-11-02')` = 07:00Z. */
const w = (hhmm: string, date: string) => new Date(`${date}T${hhmm}:00+02:00`);

const LOCAL_IPS = ['127.0.0.1', '::1'];
// D1: every company value is stated explicitly (no shift end: start + 9 h; no summary policy: pinned).
const BASE_SETTINGS = {
  timezone: 'Asia/Beirut',
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  shiftStart: '09:00',
  graceMinutes: 10,
  verificationMode: 'ip',
  officeIps: LOCAL_IPS,
  officeHostnames: [] as string[], // H-07: stated, so a hostname left by an earlier run never applies
  holidays: ['2026-12-25'],
  holidaysConfirmed: true,
  missingCheckoutFlagHours: 6,
};

describe.skipIf(!hasTestDb)('BE1 Increment 3 — attendance (DB)', { timeout: 60_000 }, () => {  // H-07: DB-heavy, realistic limit
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

  let settingsBefore: SettingsSnapshot = { id: null };
  beforeAll(async () => {
    settingsBefore = await snapshotAttendanceSettings(pool); // H-07: restored in afterAll
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
    // empty backlog (events without a consumer are simply marked done). Events emitted under a pinned
    // (future) clock are due at that instant: relay at the latest due time, or they stay pending and a
    // later suite that pins a later clock has to drain hundreds of them inside its 5 s test timeout.
    const { rows } = await query<{ t: Date | null }>(`SELECT max(next_attempt_at) AS t FROM outbox_events WHERE state = 'pending'`);
    if (rows[0]?.t && rows[0].t.getTime() > Date.now()) clock.set(new Date(rows[0].t));
    for (let i = 0; i < 5000; i++) if ((await relayOutboxOnce()).claimed === 0) break;
    clock.set(null);
    // Other suites in this DB expect company.timezone unset (it is a NEEDS VALUE setting).
    await query(`UPDATE company_settings SET "values" = "values" - 'company.timezone' WHERE id = 1`);
    await restoreAttendanceSettings(pool, settingsBefore);
    await pool.end();
  }, 300_000);

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

    // Approved policy change (baseline 2026-10-29 D1): late strictly after start + grace, ms precision.
    // Before it, 09:10:59 counted as on time (minute granularity); now 09:10:00.001 is already late.
    it('grace boundary (D1): 09:10:00.000 on time, 09:10:00.001 late, 09:11 late (11 min)', async () => {
      const a = await agentFor('data_entry');
      pin(new Date('2026-10-23T06:10:00.000Z'));
      expect((await call(a, 'post', '/api/attendance/check-in', {})).body.session.punctuality).toBe('on_time');
      const c = await agentFor('data_entry');
      pin(new Date('2026-10-23T06:10:00.001Z'));
      expect((await call(c, 'post', '/api/attendance/check-in', {})).body.session).toMatchObject({ punctuality: 'late', lateMinutes: 10 });
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

    it('D6: the summary rule is pinned (cannot be switched off); whitespace does not count', async () => {
      const cur = await call(owner, 'get', '/api/attendance/settings');
      const off = await call(owner, 'put', '/api/attendance/settings', { ...BASE_SETTINGS, summaryRequired: false, version: cur.body.current.versionNo });
      expect(off.status).toBe(400);
      expect(cur.body.current).toMatchObject({ summaryRequired: true, summaryMinLength: 10 });
      const a = await agentFor('developer');
      pin(at('09:00'));
      await call(a, 'post', '/api/attendance/check-in', {});
      pin(at('18:00'));
      expect((await call(a, 'post', '/api/attendance/check-out', {})).status).toBe(400);
      // 9 non-whitespace characters padded to 19: refused; 10 non-whitespace characters: accepted.
      const padded = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: ' a b c d e f g h i ' } });
      expect(padded.status).toBe(400);
      expect(padded.body.details['summary.workCompleted']).toBeDefined();
      const ok = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'a b c d e f g h i j' } });
      expect(ok.status).toBe(200);
      expect(ok.body.session).toMatchObject({ state: 'closed', durationStatus: 'met', summary: { workCompleted: 'a b c d e f g h i j', writtenBy: null } });
    });

    async function openThenFailCheckout(): Promise<{ a: Agent; sessionId: string }> {
      const a = await agentFor('call_center');
      pin(at('09:00'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      await putSettings({ officeIps: ['203.0.113.0/24'] }); // the employee left the office network
      pin(at('18:10'));
      return { a, sessionId: s.id };
    }

    it('D5 provisional (pinned): closed provisionally at the attempted time + review item; next check-in allowed', async () => {
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
      // D4: changing the time while resolving needs a reason.
      const noReason = await call(owner, 'post', `/api/attendance/sessions/${sessionId}/resolve-review`, { version: item.version, checkOutAt: '2026-10-23T15:00:00.000Z' });
      expect(noReason.status).toBe(400);
      expect(noReason.body.details.reason).toBeDefined();
      const resolved = await call(owner, 'post', `/api/attendance/sessions/${sessionId}/resolve-review`, { version: item.version });
      expect(resolved.status).toBe(200);
      expect(resolved.body.session).toMatchObject({ state: 'closed', reviewPending: false, effectiveCheckOutAt: '2026-10-23T15:10:00.000Z' });
    });

    it('D5: the block / hold alternatives are not selectable (env parsing refuses them)', () => {
      expect(() => loadPolicyFlags({ POLICY_ATTENDANCE_FAILED_CHECKOUT: 'block' })).toThrow(/provisional/);
      expect(() => loadPolicyFlags({ POLICY_ATTENDANCE_FAILED_CHECKOUT: 'hold' })).toThrow(/provisional/);
      expect(loadPolicyFlags({})['attendance.failedCheckout']).toBe('provisional');
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

    it('F-01/D4: a request for a still-open earlier session moves it to review WITHOUT the proposed checkout; check-in allowed; reject → unknown', async () => {
      const a = await agentFor('developer');
      pin(at('09:00', '2026-10-21'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      pin(at('09:00', '2026-10-22'));
      const blocked = await call(a, 'post', '/api/attendance/check-in', {});
      expect(blocked.body.details.reason).toBe('OPEN_SESSION');
      const req1 = await call(a, 'post', '/api/attendance/corrections', { sessionId: s.id, proposedCheckOutAt: '2026-10-21T18:00:00+03:00', reason: 'Forgot to check out' });
      expect(req1.body.closedSessionProvisionally).toBe(true);
      // D4: the proposed time is not effective before the Owner approves it.
      const pending = (await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session;
      expect(pending).toMatchObject({ state: 'pending_review', effectiveCheckOutAt: null, checkOutAt: null, reviewPending: true, pendingCorrectionId: req1.body.id });
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
    it('validation: office IPs required, no location / disabled mode (D2), no shift end (D1), invalid IPs; version conflict', async () => {
      const cur = (await call(owner, 'get', '/api/attendance/settings')).body;
      const v = cur.current.versionNo;
      const put = (o: object) => call(owner, 'put', '/api/attendance/settings', { ...BASE_SETTINGS, version: v, ...o });
      expect((await put({ officeIps: [] })).body.details.officeIps).toBeDefined();
      expect((await put({ verificationMode: 'geofence' })).body.details.verificationMode).toBeDefined();
      expect((await put({ verificationMode: 'disabled' })).body.details.verificationMode).toBeDefined();
      expect((await put({ officeIps: ['300.1.1.1'] })).body.details['officeIps.0']).toBeDefined();
      expect((await put({ timezone: 'Mars/Base' })).body.details.timezone).toBeDefined();
      expect((await put({ holidaysConfirmed: false })).body.details.holidaysConfirmed).toBeDefined();
      // D1: shift end is derived (start + 9 h) and no longer accepted.
      expect((await put({ shiftEnd: '18:00' })).status).toBe(400);
      expect(cur.current).toMatchObject({ shiftStart: '09:00', shiftEnd: '18:00', holidaysConfirmed: true });
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

      // Missing check-in goes to the Owner too (D18): one notice per detected work date.
      await relayAll();
      const detections = await count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND employee_id = $1`, [noShow.id]);
      expect(detections).toBeGreaterThanOrEqual(1);
      expect(await count(`SELECT COUNT(*)::text AS n FROM notification_deliveries WHERE recipient_id = $1 AND template = 'business.attendance_review' AND source_id = $2`, [owner.id, noShow.id])).toBe(detections);

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
  // v1 policy baseline 2026-10-29 (D1–D6, D18)
  // ---------------------------------------------------------------------------------------------
  describe('v1 policy (baseline 2026-10-29)', () => {
    afterAll(async () => {
      await putSettings();
    });

    it('D1 configured gate: a version without the holiday confirmation (or with a retired mode) enforces nothing', async () => {
      const cur = (await call(owner, 'get', '/api/attendance/settings')).body.current;
      // A version saved before migration 980 (holidays not confirmed): attendance is Not configured.
      await query(
        `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes,
           verification_mode, office_ips, holidays, summary_required, summary_min_length, missing_checkout_flag_hours, reason, created_by)
         VALUES ($1, 'Asia/Beirut', ARRAY['MON','TUE','WED','THU','FRI'], '09:00', '18:00', 10, 'ip', $2, '{}'::date[], true, 10, 6, 'legacy', $3)`,
        [cur.versionNo + 1, LOCAL_IPS, owner.id]
      );
      const a = await agentFor('call_center');
      pin(w('09:30', '2026-11-02'));
      const today = (await call(a, 'get', '/api/attendance/me/today')).body;
      expect(today).toMatchObject({ configured: false, canCheckIn: false, canCheckOut: false, workingDay: null });
      expect(today.missing).toContain('attendance.holidays');
      const res = await call(a, 'post', '/api/attendance/check-in', {});
      expect(res.status).toBe(409);
      expect(res.body.details).toMatchObject({ reason: 'POLICY_NOT_CONFIGURED' });
      // Not even under a remote exception.
      await call(owner, 'post', '/api/attendance/remote-exceptions', { employeeId: a.id, startDate: '2026-11-02', reason: 'Client site' });
      expect((await call(a, 'post', '/api/attendance/check-in', {})).body.details.reason).toBe('POLICY_NOT_CONFIGURED');
      // J-04 runs no alert on assumed values.
      const r = await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(r).toMatchObject({ notConfigured: true, missingCheckin: 0, missingCheckout: 0, checkoutReminders: 0 });
      const ov = (await call(owner, 'get', '/api/attendance/overview?date=2026-11-02')).body;
      expect(ov).toMatchObject({ configured: false, scheduleConfigured: false, summary: { expected: null, lateArrivals: null, notCheckedIn: null } });
      // The next save must confirm the holidays explicitly (the stored "false" is kept, never assumed).
      const { holidaysConfirmed: _omit, ...withoutConfirmation } = BASE_SETTINGS;
      void _omit;
      const v = (await call(owner, 'get', '/api/attendance/settings')).body.current.versionNo;
      const refused = await call(owner, 'put', '/api/attendance/settings', { ...withoutConfirmation, version: v });
      expect(refused.status).toBe(400);
      expect(refused.body.details.holidaysConfirmed).toBeDefined();
      // A stored legacy "disabled" (allow all) mode is Not configured too, never a pass.
      await query(`UPDATE attendance_settings_versions SET verification_mode = 'disabled', holidays_confirmed = true WHERE version_no = $1`, [v]);
      expect((await call(a, 'get', '/api/attendance/me/today')).body).toMatchObject({ configured: false, missing: ['attendance.verificationMode'] });
      expect((await call(a, 'post', '/api/attendance/check-in', {})).body.details.reason).toBe('POLICY_NOT_CONFIGURED');
      await putSettings();
      expect((await call(a, 'get', '/api/attendance/me/today')).body).toMatchObject({ configured: true, canCheckIn: true });
    });

    it('D2: env parsing refuses the disabled and location modes', () => {
      expect(() => loadPolicyFlags({ POLICY_ATTENDANCE_VERIFICATION_MODE: 'disabled' })).toThrow();
      expect(() => loadPolicyFlags({ POLICY_ATTENDANCE_VERIFICATION_MODE: 'geofence' })).toThrow();
      expect(loadPolicyFlags({ POLICY_ATTENDANCE_VERIFICATION_MODE: 'ip' })['attendance.verificationMode']).toBe('ip');
    });

    // Root cause of the earlier full-suite failures: relayAll() below drains the whole outbox backlog the
    // other suites left (slow on a full run) and hit the 5 s default timeout; the 10:00 start was then never
    // restored, so the next tests' 09:40 missing check-in was not due yet. Longer timeout + finally restore,
    // and the schedule-dependent tests below set the company schedule themselves.
    it('D1 shift end = start + 9 h: with a 10:00 start the reminder is 20:00 and the flag 01:00', async () => {
      await putSettings({ shiftStart: '10:00' });
      try {
      const a = await agentFor('developer');
      pin(w('10:00', '2026-11-03'));
      expect((await call(a, 'get', '/api/attendance/me/today')).body.schedule).toMatchObject({ shiftStart: '10:00', shiftEnd: '19:00' });
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      const reminders = () => count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkout_reminder' AND employee_id = $1`, [a.id]);
      pin(w('19:59', '2026-11-03'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await reminders()).toBe(0);
      // D18: the employee reminder at shift end + 1 h, once.
      pin(w('20:00', '2026-11-03'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await reminders()).toBe(1);
      expect(await outboxCount('attendance.missing_checkout_reminder', s.id)).toBe(1);
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await outboxCount('attendance.missing_checkout_reminder', s.id)).toBe(1);
      await relayAll();
      expect(await count(`SELECT COUNT(*)::text AS n FROM notification_deliveries WHERE recipient_id = $1 AND template = 'business.attendance_alert' AND source_id = $2`, [a.id, s.id])).toBe(1);
      // D5: the "missing checkout" flag stays at shift end + 6 h (19:00 + 6 h = 01:00 next day).
      pin(w('00:59', '2026-11-04'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect((await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session.missingCheckout).toBe(false);
      pin(w('01:00', '2026-11-04'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect((await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session).toMatchObject({ state: 'open', missingCheckout: true });
      } finally {
        await putSettings();
      }
    }, 120_000);

    it('D18 missing check-in: at start + grace + 30 min on working days only', async () => {
      await putSettings();
      const noShow = await makeEmployee('data_entry');
      const flagged = () => count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND employee_id = $1`, [noShow.id]);
      pin(new Date('2026-11-05T09:39:59.999+02:00')); // Thursday, winter time: 09:00 + 10 + 30 min is 09:40
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await flagged()).toBe(0);
      pin(new Date('2026-11-05T09:40:00+02:00'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await flagged()).toBe(1);
    });

    it('D1 days off: Owner create / list / cancel (audited); suppress the missing check-in; non-working for the employee', async () => {
      await putSettings();
      const off = await agentFor('call_center');
      const body = { employeeId: off.id, startDate: '2026-11-09', endDate: '2026-11-10', reason: 'Approved annual leave' };
      expect((await call(off, 'post', '/api/attendance/days-off', body)).status).toBe(403);
      expect((await call(off, 'get', '/api/attendance/days-off')).status).toBe(403);
      expect((await call(await pendingOwner(), 'post', '/api/attendance/days-off', body)).status).toBe(403);
      expect((await call(owner, 'post', '/api/attendance/days-off', { ...body, reason: ' ' })).status).toBe(400);
      expect((await call(owner, 'post', '/api/attendance/days-off', { ...body, endDate: '2026-11-08' })).status).toBe(400);
      const created = await call(owner, 'post', '/api/attendance/days-off', body);
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ employeeId: off.id, startDate: '2026-11-09', endDate: '2026-11-10', cancelledAt: null });
      expect(await auditCount('attendance.day_off_created', created.body.id)).toBe(1);
      const overlap = await call(owner, 'post', '/api/attendance/days-off', { ...body, startDate: '2026-11-10', endDate: '2026-11-12' });
      expect(overlap.status).toBe(422);
      expect(overlap.body.details.reason).toBe('OVERLAP');
      const list = (await call(owner, 'get', `/api/attendance/days-off?employeeId=${off.id}`)).body;
      expect(list.items.map((d: { id: string }) => d.id)).toEqual([created.body.id]);

      // Monday 2026-11-09, past 09:40: no missing check-in for the employee on leave.
      pin(new Date('2026-11-09T10:00:00+02:00'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND employee_id = $1`, [off.id])).toBe(0);
      const ov = (await call(owner, 'get', `/api/attendance/overview?employeeId=${off.id}`)).body;
      expect(ov.rows[0]).toMatchObject({ dayOff: true, missingCheckin: false, status: 'not_checked_in' });
      expect(ov.summary).toMatchObject({ expected: 0, notCheckedIn: 0 });
      expect((await call(off, 'get', '/api/attendance/me/today')).body).toMatchObject({ dayOff: true, workingDay: false, nonWorkingReason: 'day_off' });

      // Cancel: reason required, additive (the row stays), audited, repeat is a no-op.
      expect((await call(owner, 'post', `/api/attendance/days-off/${created.body.id}/cancel`, { version: created.body.version })).status).toBe(400);
      const cancelled = await call(owner, 'post', `/api/attendance/days-off/${created.body.id}/cancel`, { version: created.body.version, reason: 'Leave withdrawn' });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body).toMatchObject({ cancelledBy: owner.id, cancelReason: 'Leave withdrawn' });
      expect(await auditCount('attendance.day_off_cancelled', created.body.id)).toBe(1);
      expect((await call(owner, 'post', `/api/attendance/days-off/${created.body.id}/cancel`, { version: created.body.version, reason: 'again' })).status).toBe(200);
      expect((await call(owner, 'get', `/api/attendance/days-off?employeeId=${off.id}`)).body.items).toHaveLength(0);
      expect((await call(owner, 'get', `/api/attendance/days-off?employeeId=${off.id}&includeCancelled=true`)).body.items).toHaveLength(1);
      expect((await call(off, 'get', '/api/attendance/me/today')).body).toMatchObject({ dayOff: false, workingDay: true });
      // Tuesday, no longer on leave: the missing check-in is raised again.
      pin(new Date('2026-11-10T10:00:00+02:00'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND employee_id = $1`, [off.id])).toBe(1);
    });

    it('D5: an earlier-day or missing-checkout session is not self-closed; a correction request resolves it and unblocks check-in', async () => {
      const a = await agentFor('data_entry');
      pin(w('09:00', '2026-11-11'));
      const s = (await call(a, 'post', '/api/attendance/check-in', {})).body.session;
      pin(new Date('2026-11-12T09:30:00+02:00'));
      const today = (await call(a, 'get', '/api/attendance/me/today')).body;
      expect(today).toMatchObject({ canCheckIn: false, canCheckOut: false, openSessionFromEarlierDay: { id: s.id } });
      const out = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Entered forty businesses' } });
      expect(out.status).toBe(409);
      expect(out.body.details).toMatchObject({ reason: 'CORRECTION_REQUIRED', sessionId: s.id });
      expect((await call(a, 'post', '/api/attendance/check-in', {})).body.details.reason).toBe('OPEN_SESSION');
      const req1 = await call(a, 'post', '/api/attendance/corrections', { sessionId: s.id, proposedCheckOutAt: '2026-11-11T18:05:00+02:00', reason: 'Forgot to check out' });
      expect(req1.status).toBe(201);
      expect((await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session).toMatchObject({ state: 'pending_review', effectiveCheckOutAt: null });
      // The review state is closed for check-in purposes (no trap).
      expect((await call(a, 'post', '/api/attendance/check-in', {})).status).toBe(201);
      // The proposed time becomes effective only on approval.
      const ap = await call(owner, 'post', `/api/attendance/corrections/${req1.body.id}/approve`, { version: req1.body.version });
      expect(ap.status).toBe(200);
      expect((await call(a, 'get', `/api/attendance/sessions/${s.id}`)).body.session).toMatchObject({
        state: 'closed',
        adjusted: true,
        checkOutAt: null,
        effectiveCheckOutAt: '2026-11-11T16:05:00.000Z',
      });
    });

    it('D3/D4/S-30: the Owner sends no request for their own attendance; no self-granted or self-approved remote exception', async () => {
      await query(`UPDATE attendance_sessions SET state = 'closed', check_out_at = check_in_at, effective_check_out_at = effective_check_in_at WHERE employee_id = $1 AND state = 'open'`, [owner.id]);
      // The seed Owner is shared by every run on this DB: a fresh day per run keeps the intervals apart.
      const day = new Date(Date.UTC(2027, 0, 4 + Math.floor(Math.random() * 3000))).toISOString().slice(0, 10);
      pin(new Date(`${day}T07:00:00Z`));
      const s = (await call(owner, 'post', '/api/attendance/check-in', {})).body.session;
      pin(new Date(`${day}T16:00:00Z`));
      await call(owner, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Owner reviews and calls' } });
      pin(new Date(`${day}T20:00:00Z`));
      const own = await call(owner, 'post', '/api/attendance/corrections', { sessionId: s.id, proposedCheckInAt: `${day}T06:30:00Z`, reason: 'Arrived earlier' });
      expect(own.status, JSON.stringify(own.body)).toBe(409);
      expect(own.body.details.reason).toBe('OWNER_CORRECTS_DIRECTLY');
      const grant = await call(owner, 'post', '/api/attendance/remote-exceptions', { employeeId: owner.id, startDate: day, reason: 'Working from home' });
      expect(grant.status).toBe(403);
      setAttendanceFlagOverridesForTests({ 'attendance.remoteSelfRequest': true });
      const asked = await call(owner, 'post', '/api/attendance/remote-exceptions/requests', { startDate: day, reason: 'Working from home' });
      expect(asked.status).toBe(201);
      expect((await call(owner, 'post', `/api/attendance/remote-exceptions/${asked.body.id}/approve`, { version: asked.body.version })).status).toBe(403);
    });

    it('D6: the Owner completes a missing summary with a reason (additive, writer recorded); never replaces one', async () => {
      const e = await makeEmployee('developer');
      pin(w('12:00', '2026-11-16'));
      const r = await call(owner, 'post', '/api/attendance/sessions', { employeeId: e.id, checkInAt: '2026-11-13T09:00:00+02:00', checkOutAt: '2026-11-13T18:00:00+02:00', reason: 'Missed check-in' });
      const sid = r.body.session.id as string;
      expect(r.body.session.summary).toBeNull();
      const v = r.body.session.version;
      expect((await call(owner, 'post', `/api/attendance/sessions/${sid}/adjust`, { version: v, workCompleted: 'Built the landing page' })).status).toBe(400);
      expect((await call(owner, 'post', `/api/attendance/sessions/${sid}/adjust`, { version: v, workCompleted: 'too short', reason: 'Employee on leave' })).status).toBe(400);
      const ok = await call(owner, 'post', `/api/attendance/sessions/${sid}/adjust`, { version: v, workCompleted: 'Built the landing page', reason: 'Employee on leave' });
      expect(ok.status).toBe(200);
      expect(ok.body.session).toMatchObject({ adjusted: false, summary: { workCompleted: 'Built the landing page', writtenBy: owner.id } });
      expect(await auditCount('attendance.summary_completed', sid)).toBe(1);
      const again = await call(owner, 'post', `/api/attendance/sessions/${sid}/adjust`, { version: ok.body.session.version, workCompleted: 'Something else entirely', reason: 'x' });
      expect(again.status).toBe(422);
      expect(again.body.details.reason).toBe('SUMMARY_EXISTS');
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Owner decisions 2026-10-29: per-employee schedule, office dynamic-DNS hostnames
  // ---------------------------------------------------------------------------------------------
  describe('round 2 (Owner decisions 2026-10-29)', () => {
    afterAll(async () => {
      setOfficeResolverForTests(null);
      await putSettings();
    });

    it('per-employee start 08:00 and own working days drive punctuality, J-04, today and overview; history is kept', async () => {
      await putSettings();
      const early = await agentFor('call_center');
      const peer = await makeEmployee('call_center');
      const sched = (b: object) => call(owner, 'put', `/api/attendance/employees/${early.id}/schedule`, b);
      // Owner only; non-Owners 403.
      expect((await call(early, 'put', `/api/attendance/employees/${early.id}/schedule`, { shiftStart: '08:00' })).status).toBe(403);
      expect((await call(early, 'get', `/api/attendance/employees/${early.id}/schedule`)).status).toBe(403);
      expect((await sched({})).status).toBe(400);
      pin(w('07:00', '2026-11-16'));
      const set = await sched({ effectiveFrom: '2026-11-16', shiftStart: '08:00', workingDays: ['MON', 'TUE', 'WED', 'THU', 'SAT'], reason: 'Early shift' });
      expect(set.status).toBe(200);
      expect(set.body).toMatchObject({ effective: { shiftStart: '08:00', shiftEnd: '17:00', workingDays: ['MON', 'TUE', 'WED', 'THU', 'SAT'] }, company: { shiftStart: '09:00' } });
      expect(await count(`SELECT COUNT(*)::text AS n FROM audit_events WHERE event_name = 'attendance.employee_schedule_set' AND entity_id = $1`, [early.id])).toBe(1);

      // Monday 08:15: late for the 08:00 employee (grace 10); the company default would be on time.
      pin(w('08:15', '2026-11-16'));
      expect((await call(early, 'get', '/api/attendance/me/today')).body.schedule).toMatchObject({ shiftStart: '08:00', shiftEnd: '17:00' });
      const s = (await call(early, 'post', '/api/attendance/check-in', {})).body.session;
      expect(s).toMatchObject({ punctuality: 'late', lateMinutes: 15 });
      // Reminder at 17:00 + 1 h = 18:00 (company employees would be 19:00).
      const reminders = () => count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkout_reminder' AND employee_id = $1`, [early.id]);
      pin(w('17:59', '2026-11-16'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await reminders()).toBe(0);
      pin(w('18:00', '2026-11-16'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await reminders()).toBe(1);
      pin(w('18:05', '2026-11-16'));
      await call(early, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Early shift calls done' } });

      // Missing check-in at 08:40 for the early employee only (company 09:40). Tuesday 2026-11-17.
      const missed = (id: string) => count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND employee_id = $1 AND work_date = '2026-11-17'`, [id]);
      pin(w('08:40', '2026-11-17'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await missed(early.id)).toBe(1);
      expect(await missed(peer.id)).toBe(0);
      const ov = (await call(owner, 'get', `/api/attendance/overview?employeeId=${early.id}`)).body;
      expect(ov.rows[0]).toMatchObject({ missingCheckin: true, workingDay: true, shiftStart: '08:00' });

      // Own working days: Friday is off for them (no alert), Saturday is a working day.
      pin(w('12:00', '2026-11-20'));
      await runSystemCommand('attendance.exception_check', (ctx) => runExceptionCheck(ctx));
      expect(await count(`SELECT COUNT(*)::text AS n FROM attendance_exceptions WHERE kind = 'missing_checkin' AND employee_id = $1 AND work_date = '2026-11-20'`, [early.id])).toBe(0);
      expect((await call(early, 'get', '/api/attendance/me/today')).body).toMatchObject({ workingDay: false, nonWorkingReason: 'weekend' });
      pin(w('07:55', '2026-11-21'));
      expect((await call(early, 'post', '/api/attendance/check-in', {})).body.session.punctuality).toBe('on_time');

      // Back to the company default from 2026-11-23; the 2026-11-16 session keeps its 08:00 start (history).
      pin(w('20:00', '2026-11-21'));
      await call(early, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Saturday cover shift' } });
      const back = await sched({ effectiveFrom: '2026-11-23', useCompanyDefault: true, reason: 'Back to normal' });
      expect(back.body.history).toHaveLength(2);
      expect((await call(owner, 'get', `/api/attendance/sessions/${s.id}`)).body.session).toMatchObject({ punctuality: 'late', lateMinutes: 15 });
      pin(w('08:15', '2026-11-23'));
      expect((await call(early, 'get', '/api/attendance/me/today')).body.schedule).toMatchObject({ shiftStart: '09:00', shiftEnd: '18:00' });
      expect((await call(early, 'post', '/api/attendance/check-in', {})).body.session.punctuality).toBe('on_time');
    }, 60_000);

    it('office by dynamic-DNS hostname: configured without IPs; resolved address passes; fail closed after 60 min', async () => {
      const cur = (await call(owner, 'get', '/api/attendance/settings')).body.current.versionNo;
      const put = (o: object) => call(owner, 'put', '/api/attendance/settings', { ...BASE_SETTINGS, version: cur, ...o });
      expect((await put({ officeIps: [], officeHostnames: ['not a host'] })).body.details['officeHostnames.0']).toBeDefined();
      expect((await put({ officeIps: [], officeHostnames: ['a.ddns.net', 'b.ddns.net', 'c.ddns.net', 'd.ddns.net', 'e.ddns.net', 'f.ddns.net'] })).status).toBe(400);
      let ok = true;
      setOfficeResolverForTests(async () => {
        if (!ok) throw new Error('SERVFAIL');
        return ['127.0.0.1', '::1'];
      });
      const saved = await put({ officeIps: [], officeHostnames: ['Office.DDNS.net'] });
      expect(saved.status).toBe(200);
      expect(saved.body).toMatchObject({ configured: true, current: { officeIps: [], officeHostnames: ['office.ddns.net'] } });
      const a = await agentFor('developer');
      const b = await agentFor('developer');
      pin(w('09:00', '2026-11-24'));
      expect((await call(a, 'post', '/api/attendance/check-in', {})).body.session.verification.checkIn.result).toBe('passed');
      // The DNS provider fails: the last good address is kept for up to 60 minutes...
      ok = false;
      pin(w('09:50', '2026-11-24'));
      expect((await call(b, 'post', '/api/attendance/check-in', {})).status).toBe(201);
      // ...then the check fails closed with a clear reason (checkout goes the provisional path).
      pin(w('10:01', '2026-11-24'));
      const c = await agentFor('developer');
      const refused = await call(c, 'post', '/api/attendance/check-in', {});
      expect(refused.status).toBe(422);
      expect(refused.body.details).toMatchObject({ reason: 'OFFICE_CHECK_FAILED', hostnamesUnresolved: true });
      pin(w('18:00', '2026-11-24'));
      expect((await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Built the landing page' } })).body.outcome).toBe('closed_provisional');
      setOfficeResolverForTests(null);
      await putSettings();
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
