/**
 * Wave 2 Attendance Breaks Engine API integration tests.
 * Runs against TEST_DATABASE_URL.
 * Tests:
 *  - Start/end break lifecycle.
 *  - Active break counter & shift allowance computation.
 *  - Concurrency guarantee (at most one active break per session).
 *  - Auto-close active breaks on checkout.
 *  - Audit event generation.
 *  - Access control and IDOR protections.
 *  - Owner decision 2026-10-29: breaks are on (CFG attendance.breaksEnabled, default true; 60 min and at most
 *    3 breaks per session by default). With the flag off every break route is 404.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { clock } from '../platform/clock.js';
import { setAttendanceFlagOverridesForTests } from './service.js';
import { loadPolicyFlags } from '../../shared/flags.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const SEED_OWNER = 'udigity@gmail.com';

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

describe.skipIf(!hasTestDb)('Wave 2: Attendance Break Timer Engine', () => {
  let owner: Agent;
  let employee: Agent;

  beforeAll(async () => {
    setAttendanceFlagOverridesForTests({ 'attendance.breaksEnabled': true });
    // 1. Login owner with 2FA (reset the TOTP replay guard: other suites used the same 30 s code).
    await query(
      `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL
        WHERE employee_id = (SELECT id FROM employees WHERE LOWER(email) = LOWER($1))`,
      [SEED_OWNER]
    );
    const step1 = await login(SEED_OWNER);
    const code = authenticator.generate(DEV_TOTP_SECRET);
    const step2 = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', step1.cookie)
      .set('X-CSRF-Token', step1.csrf)
      .send({ token: code });
    expect(step2.status).toBe(200);
    const { rows: oRows } = await query<{ id: string }>('SELECT id FROM employees WHERE LOWER(email) = LOWER($1)', [SEED_OWNER]);
    owner = { cookie: cookieFrom(step2), csrf: step2.body.csrfToken as string, id: oRows[0].id, email: SEED_OWNER };

    // 2. Configure office IP and company timezone to allow check-in
    await query(
      `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes,
         verification_mode, office_ips, holidays, holidays_confirmed, summary_required, summary_min_length, missing_checkout_flag_hours, reason, created_by)
       VALUES (
         COALESCE((SELECT MAX(version_no) + 1 FROM attendance_settings_versions), 1),
         'Asia/Beirut',
         ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
         '09:00', '18:00', 15, 'ip', ARRAY['127.0.0.1', '::1', '::ffff:127.0.0.1'], '{}'::date[], true, true, 10, 12, 'Wave 2 test settings', $1
       )`,
      [owner.id]
    );

    // 3. Create a test employee
    const email = `break.tester.${uniq()}@udigity.demo`;
    const hash = await bcrypt.hash(PASSWORD, 4);
    const { rows: eRows } = await query<{ id: string }>(
      `INSERT INTO employees (email, full_name, role, is_active)
       VALUES ($1, 'Break Tester', 'data_entry', true) RETURNING id`,
      [email]
    );
    await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [eRows[0].id, hash]);
    const eLogin = await login(email);
    employee = { cookie: eLogin.cookie, csrf: eLogin.csrf, id: eRows[0].id, email };
  });

  afterEach(() => {
    clock.set(null);
  });

  afterAll(async () => {
    clock.set(null);
    setAttendanceFlagOverridesForTests({});
  });

  it('routes refused when the flag is off: with attendance.breaksEnabled false every break route is 404 and My Day hides the timer', async () => {
    setAttendanceFlagOverridesForTests({ 'attendance.breaksEnabled': false });
    try {
      const sid = '00000000-0000-4000-8000-000000000001';
      for (const [method, path] of [
        ['post', '/api/attendance/breaks/start'],
        ['post', '/api/attendance/breaks/end'],
        ['get', '/api/attendance/breaks/active'],
        ['get', `/api/attendance/sessions/${sid}/breaks`],
      ] as const) {
        const res = await call(employee, method, path, method === 'post' ? {} : undefined);
        expect(res.status, `${method} ${path}`).toBe(404);
      }
      expect((await call(employee, 'get', '/api/attendance/me/today')).body.breaksEnabled).toBe(false);
    } finally {
      setAttendanceFlagOverridesForTests({ 'attendance.breaksEnabled': true });
    }
    expect((await call(employee, 'get', '/api/attendance/me/today')).body.breaksEnabled).toBe(true);
  });

  it('Owner decision 2026-10-29 defaults: breaks on, 60 minutes and at most 3 breaks per session; the Owner can change the limits', async () => {
    expect(loadPolicyFlags({})).toMatchObject({ 'attendance.breaksEnabled': true, 'attendance.breakAllowanceMinutes': 60, 'attendance.maxBreaksPerSession': 3 });
    const view = await call(employee, 'get', '/api/attendance/settings');
    expect(view.body.breaks).toMatchObject({ enabled: true, allowanceMinutes: 60, maxPerSession: 3 });
    const cur = await call(owner, 'get', '/api/attendance/settings');
    expect(cur.status).toBe(200);
    {
      const v = cur.body.current.versionNo;
      const base = { version: v, holidaysConfirmed: true };
      const put = await call(owner, 'put', '/api/attendance/settings', { ...base, maxBreaksPerSession: 4, breakAllowanceMinutes: 45 });
      expect(put.status).toBe(200);
      expect(put.body.breaks).toMatchObject({ allowanceMinutes: 45, maxPerSession: 4 });
      expect((await call(owner, 'put', '/api/attendance/settings', { ...base, version: v + 1, maxBreaksPerSession: 0 })).status).toBe(400);
      const back = await call(owner, 'put', '/api/attendance/settings', { ...base, version: v + 1, maxBreaksPerSession: 3, breakAllowanceMinutes: 60 });
      expect(back.body.breaks).toMatchObject({ allowanceMinutes: 60, maxPerSession: 3 });
    }
  });

  it('rejects starting a break when no attendance session is open (409 NO_OPEN_SESSION)', async () => {
    const res = await call(employee, 'post', '/api/attendance/breaks/start', {});
    expect(res.status).toBe(409);
    expect(res.body.details?.reason).toBe('NO_OPEN_SESSION');
  });

  it('starts a break, tracks live counter, and prevents concurrent active breaks', async () => {
    // 1. Check in
    clock.set(new Date('2026-10-26T08:00:00Z'));
    const checkInRes = await call(employee, 'post', '/api/attendance/check-in', {});
    expect(checkInRes.status).toBe(201);
    const sessionId = checkInRes.body.session.id;

    // 2. Start a break
    clock.set(new Date('2026-10-26T10:00:00Z'));
    const startRes = await call(employee, 'post', '/api/attendance/breaks/start', {
      breakType: 'unpaid',
      notes: 'Morning coffee break',
    });
    expect(startRes.status).toBe(201);
    expect(startRes.body.break).toMatchObject({
      sessionId,
      employeeId: employee.id,
      breakType: 'unpaid',
      notes: 'Morning coffee break',
      autoClosed: false,
    });
    expect(startRes.body.break.endedAt).toBeNull();
    const breakId = startRes.body.break.id;

    // 3. Concurrency check: attempting to start another break while one is active returns 409
    const dupRes = await call(employee, 'post', '/api/attendance/breaks/start', {});
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.details?.reason).toBe('BREAK_ALREADY_ACTIVE');

    // 4. Query active break status 15 minutes later
    clock.set(new Date('2026-10-26T10:15:00Z'));
    const activeRes = await call(employee, 'get', '/api/attendance/breaks/active');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.activeBreak).toMatchObject({ id: breakId });
    expect(activeRes.body.totalBreakSecondsToday).toBe(900); // 15 min = 900s
    expect(activeRes.body.remainingBreakAllowanceSeconds).toBe(2700); // 3600 - 900
    expect(activeRes.body.isExcessive).toBe(false);

    // 5. End the break at 10:20:00 (20 minutes = 1200 seconds)
    clock.set(new Date('2026-10-26T10:20:00Z'));
    const endRes = await call(employee, 'post', '/api/attendance/breaks/end', { notes: 'Back at desk' });
    expect(endRes.status).toBe(200);
    expect(endRes.body.break).toMatchObject({
      id: breakId,
      durationSeconds: 1200,
      autoClosed: false,
      notes: 'Back at desk',
    });
    expect(endRes.body.break.endedAt).not.toBeNull();

    // 6. Ending again when no break is active returns 409 NO_ACTIVE_BREAK
    const endAgainRes = await call(employee, 'post', '/api/attendance/breaks/end', {});
    expect(endAgainRes.status).toBe(409);
    expect(endAgainRes.body.details?.reason).toBe('NO_ACTIVE_BREAK');

    // 7. Verify audit records in DB
    const { rows: audits } = await query<{ event_name: string }>(
      'SELECT event_name FROM audit_events WHERE entity_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );
    const eventNames = audits.map((a) => a.event_name);
    expect(eventNames).toContain('attendance.break.started');
    expect(eventNames).toContain('attendance.break.ended');
  });

  it('automatically finalizes an active break when the employee checks out', async () => {
    // 1. Employee is currently checked in with session
    const activeInfo = await call(employee, 'get', '/api/attendance/breaks/active');
    expect(activeInfo.body.activeBreak).toBeNull();

    // 2. Start a new break at 12:00:00
    clock.set(new Date('2026-10-26T12:00:00Z'));
    const breakRes = await call(employee, 'post', '/api/attendance/breaks/start', { breakType: 'paid' });
    expect(breakRes.status).toBe(201);
    const breakId = breakRes.body.break.id;

    // 3. Employee checks out directly at 12:30:00 while still on break
    clock.set(new Date('2026-10-26T12:30:00Z'));
    const checkoutRes = await call(employee, 'post', '/api/attendance/check-out', {
      summary: { workCompleted: 'Done for the day, checked out on break' },
    });
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.outcome).toBe('closed');

    // 4. Verify that the break was automatically finalized in database
    const { rows: bRows } = await query<{
      id: string;
      ended_at: Date;
      duration_seconds: number;
      auto_closed: boolean;
    }>('SELECT id, ended_at, duration_seconds, auto_closed FROM attendance_breaks WHERE id = $1', [breakId]);
    expect(bRows[0].ended_at).not.toBeNull();
    expect(bRows[0].duration_seconds).toBe(1800); // 30 minutes
    expect(bRows[0].auto_closed).toBe(true);

    // 5. Verify active break is now null
    const afterCheckout = await call(employee, 'get', '/api/attendance/breaks/active');
    expect(afterCheckout.body.activeBreak).toBeNull();
  });

  it('detects excessive break duration when exceeding 60 minutes allowance', async () => {
    // 1. Check in for a new work session on a new date
    clock.set(new Date('2026-10-27T08:00:00Z'));
    const inRes = await call(employee, 'post', '/api/attendance/check-in', {});
    expect(inRes.status).toBe(201);
    const sessionId = inRes.body.session.id;

    // 2. Start break at 09:00:00
    clock.set(new Date('2026-10-27T09:00:00Z'));
    await call(employee, 'post', '/api/attendance/breaks/start', {});

    // 3. End break at 10:10:00 (70 minutes = 4200 seconds > 3600 limit)
    clock.set(new Date('2026-10-27T10:10:00Z'));
    const endRes = await call(employee, 'post', '/api/attendance/breaks/end', {});
    expect(endRes.status).toBe(200);
    expect(endRes.body.break.durationSeconds).toBe(4200);

    // 4. Verify active break report flags isExcessive = true
    const activeRes = await call(employee, 'get', '/api/attendance/breaks/active');
    expect(activeRes.body.isExcessive).toBe(true);
    expect(activeRes.body.remainingBreakAllowanceSeconds).toBe(0);

    // 5. Verify audit event for excessive break
    const { rows: audits } = await query<{ event_name: string }>(
      'SELECT event_name FROM audit_events WHERE entity_id = $1 AND event_name = $2',
      [sessionId, 'attendance.excessive_break_detected']
    );
    expect(audits.length).toBeGreaterThan(0);
  });
  // --- FX-BE hardening (user decision 2026-10-28: breaks kept) ---------------------------------
  it('validates bodies strictly: unknown keys and unknown break types are 400', async () => {
    const unknownKey = await call(employee, 'post', '/api/attendance/breaks/start', { startedAt: '2020-01-01T00:00:00Z' });
    expect(unknownKey.status).toBe(400);
    const badType = await call(employee, 'post', '/api/attendance/breaks/start', { breakType: 'lunch' });
    expect(badType.status).toBe(400);
    const longNote = await call(employee, 'post', '/api/attendance/breaks/end', { notes: 'x'.repeat(501) });
    expect(longNote.status).toBe(400);
  });

  it('reads are own-record only: another employee gets 404 for my session breaks', async () => {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM attendance_sessions WHERE employee_id = $1 ORDER BY check_in_at DESC LIMIT 1`,
      [employee.id]
    );
    const sessionId = rows[0].id;
    const mine = await call(employee, 'get', `/api/attendance/sessions/${sessionId}/breaks`);
    expect(mine.status).toBe(200);
    expect(mine.body.breaks.length).toBeGreaterThan(0);

    const email = `break.other.${uniq()}@udigity.demo`;
    const hash = await bcrypt.hash(PASSWORD, 4);
    const { rows: o } = await query<{ id: string }>(
      `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Break Other', 'call_center', true) RETURNING id`,
      [email]
    );
    await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [o[0].id, hash]);
    const other = await login(email);
    const foreign = await call(other, 'get', `/api/attendance/sessions/${sessionId}/breaks`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.breaks).toBeUndefined();
    // Their own active-break view never shows my breaks.
    const otherActive = await call(other, 'get', '/api/attendance/breaks/active');
    expect(otherActive.status).toBe(200);
    expect(otherActive.body.breaks).toEqual([]);
  });

  it('caps the number of breaks per session (409 BREAK_LIMIT_REACHED) and audits each start/end', async () => {
    // Self-contained: its own fresh session on its own date, and the limit read from the 409 itself,
    // so the stored attendance settings of other suites cannot change the outcome.
    const { rows: open } = await query<{ id: string }>(
      `SELECT id FROM attendance_sessions WHERE employee_id = $1 AND check_out_at IS NULL`,
      [employee.id]
    );
    if (open[0]) {
      clock.set(new Date('2026-10-27T16:00:00Z'));
      await call(employee, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Closing before the limit test' } });
    }
    await query(
      `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes,
         verification_mode, office_ips, holidays, holidays_confirmed, summary_required, summary_min_length, missing_checkout_flag_hours, reason, created_by)
       VALUES (COALESCE((SELECT MAX(version_no) + 1 FROM attendance_settings_versions), 1), 'Asia/Beirut',
         ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'], '09:00', '18:00', 15, 'ip', ARRAY['127.0.0.1', '::1', '::ffff:127.0.0.1'],
         '{}'::date[], true, true, 10, 12, 'breaks limit test', $1)`,
      [owner.id]
    );
    clock.set(new Date('2026-10-29T07:00:00Z'));
    const inRes = await call(employee, 'post', '/api/attendance/check-in', {});
    expect(inRes.status).toBe(201);
    const sessionId = inRes.body.session.id as string;
    let minute = 0;
    const at = () => new Date(Date.UTC(2026, 9, 29, 8, minute++));
    let started = 0;
    let over: request.Response | null = null;
    for (let i = 0; i < 60 && !over; i++) {
      clock.set(at());
      const s = await call(employee, 'post', '/api/attendance/breaks/start', {});
      if (s.status === 409) {
        over = s;
        break;
      }
      expect(s.status).toBe(201);
      started++;
      clock.set(at());
      expect((await call(employee, 'post', '/api/attendance/breaks/end', {})).status).toBe(200);
    }
    expect(over).not.toBeNull();
    expect(over!.body.details?.reason).toBe('BREAK_LIMIT_REACHED');
    expect(started).toBe(over!.body.details?.limit);
    const { rows: audits } = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events WHERE entity_id = $1 AND event_name = 'attendance.break.started'`,
      [sessionId]
    );
    expect(Number(audits[0].n)).toBe(started);
  });
});
