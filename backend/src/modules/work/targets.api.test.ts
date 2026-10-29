/**
 * D7 (policy baseline 2026-10-29) target counting and period rules. DB tests (TEST_DATABASE_URL only).
 * - progress is computed from the actor columns (no typed-in currentValue)
 * - Data Entry: created businesses only, edits never count, archived excluded
 * - Call Center: distinct businesses per company-timezone day, summed over scheduled working days
 * - Developer: done tasks by completed_by_id; reopen + complete does not inflate
 * - weekly = Monday–Sunday (derived end), no retroactive targets or edits
 */
import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { addDays, nonWorkingReason, weekdayOf } from '../attendance/time.js';
import { storeEnrolledSecret } from '../identity/twoFactor.js';
import { computeProgress, derivePeriodEnd, periodInstants, progressContext, type ProgressContext } from './progress.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';

type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';
interface Agent {
  cookie: string;
  csrf: string;
  id: string;
}

const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

function cookieFrom(res: request.Response): string {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
}

function call(a: Agent, method: 'get' | 'post' | 'patch', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  return body ? r.send(body) : r;
}

async function makeEmployee(role: Role): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [`d7.${role}.${uniq()}@test.local`, `D7 ${role}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return rows[0].id;
}

async function ownerAgent(): Promise<Agent> {
  const id = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, id, DEV_TOTP_SECRET));
  const { rows } = await query<{ email: string }>('SELECT email FROM employees WHERE id = $1', [id]);
  const login = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: rows[0].email, password: PASSWORD });
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', cookieFrom(login))
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id };
}

async function business(createdBy: string, opts: { createdAt?: Date; archived?: boolean } = {}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO businesses (name, created_by, created_at, archived_at) VALUES ($1, $2, COALESCE($3, now()), $4) RETURNING id`,
    [`D7 Biz ${uniq()}`, createdBy, opts.createdAt ?? null, opts.archived ? new Date() : null]
  );
  return rows[0].id;
}

async function attempt(businessId: string, agentId: string, at: Date, outcome = 'on_hold'): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO call_attempts (business_id, agent_id, attempted_at, outcome, idempotency_key, reservation_held, outcome_applied)
     VALUES ($1, $2, $3, $4, gen_random_uuid(), false, true) RETURNING id`,
    [businessId, agentId, at, outcome]
  );
  return rows[0].id;
}

/** UTC today and the Monday of the current UTC week (test DB has no company timezone → UTC dates). */
const todayUtc = () => new Date().toISOString().slice(0, 10);
function mondayOf(date: string): string {
  const back = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 }[weekdayOf(date)];
  return addDays(date, -back);
}
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00Z`);

const UTC_ALL_DAYS: ProgressContext = { timezone: '', scheduleConfigured: false, workingDays: [], holidays: [], today: todayUtc() };

describe('D7 period helpers (pure)', () => {
  it('derives period ends; weekly = start + 6', () => {
    expect(derivePeriodEnd('2026-10-26', 'weekly')).toBe('2026-11-01');
    expect(derivePeriodEnd('2026-10-29', 'daily')).toBe('2026-10-29');
    expect(derivePeriodEnd('2026-02-10', 'monthly')).toBe('2026-02-28');
    expect(derivePeriodEnd('2026-11-15', 'quarterly')).toBe('2026-12-31');
  });

  it('company-timezone day boundary: Beirut day starts 22:00Z in winter (UTC+2)', () => {
    const { from, until } = periodInstants('2026-10-29', '2026-10-29', 'Asia/Beirut');
    expect(from.toISOString()).toBe('2026-10-28T22:00:00.000Z');
    expect(until.toISOString()).toBe('2026-10-29T22:00:00.000Z');
  });
});

describe.skipIf(!hasTestDb)('D7 target counting (DB)', () => {
  let owner: Agent;
  beforeAll(async () => {
    owner = await ownerAgent();
  });

  it('Data Entry: counts businesses created by the employee in the period; edits and archived never count', async () => {
    const de = await makeEmployee('data_entry');
    const other = await makeEmployee('data_entry');
    const today = todayUtc();
    await business(de, { createdAt: at(today, '00:30') });
    const edited = await business(de, { createdAt: at(today, '00:31') });
    await business(de, { archived: true, createdAt: at(today, '00:32') });
    await business(de, { createdAt: at(addDays(today, -1), '12:00') }); // before the period
    const othersBiz = await business(other, { createdAt: at(today, '00:33') });
    // Edits by the Data Entry employee (on their own and on someone else's record) do not count.
    await query('UPDATE businesses SET name = name || $2, updated_by = $3, updated_at = now() WHERE id = $1', [edited, ' (edited)', de]);
    await query('UPDATE businesses SET name = name || $2, updated_by = $3, updated_at = now() WHERE id = $1', [othersBiz, ' (edited)', de]);

    const r = await call(owner, 'post', '/api/targets', { employeeId: de, metric: 'data_entries', period: 'daily', targetValue: 5, startDate: today });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.currentValue).toBe(2);
    expect(r.body.endDate).toBe(today);
    // The note follows the stored attendance schedule. Not configured: progress is shown but marked (never an
    // assumed Mon–Fri). Earlier suites on the same DB (attendance) may have saved a schedule, so read it.
    const pctx = await progressContext(pool);
    const expected = !pctx.scheduleConfigured ? 'schedule_not_configured' : nonWorkingReason(today, pctx) ? 'non_working_day' : null;
    expect(r.body.progressNote).toBe(expected);
  });

  it('currentValue cannot be typed in (create or update): 400 VALIDATION_ERROR', async () => {
    const de = await makeEmployee('data_entry');
    const today = todayUtc();
    const bad = await call(owner, 'post', '/api/targets', { employeeId: de, metric: 'data_entries', period: 'daily', targetValue: 5, startDate: today, currentValue: 3 });
    expect(bad.status).toBe(400);
    const ok = await call(owner, 'post', '/api/targets', { employeeId: de, metric: 'data_entries', period: 'daily', targetValue: 5, startDate: today });
    const patch = await call(owner, 'patch', `/api/targets/${ok.body.id}`, { version: ok.body.version, currentValue: 3 });
    expect(patch.status).toBe(400);
  });

  it('Call Center: distinct businesses per day, summed over the period (repeat calls the same day count once)', async () => {
    const cc = await makeEmployee('call_center');
    const monday = mondayOf(todayUtc());
    const b1 = await business(owner.id);
    const b2 = await business(owner.id);
    await attempt(b1, cc, at(monday, '09:00'));
    await attempt(b1, cc, at(monday, '10:00')); // same business, same day
    await attempt(b2, cc, at(monday, '11:00'));
    await attempt(b1, cc, at(addDays(monday, 1), '09:00')); // next day counts again
    await attempt(b2, cc, at(addDays(monday, 7), '09:00')); // next week, outside

    const r = await call(owner, 'post', '/api/targets', { employeeId: cc, metric: 'businesses_contacted', period: 'weekly', targetValue: 10, startDate: monday });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.currentValue).toBe(3);

    const input = { employeeId: cc, metric: 'businesses_contacted', period: 'weekly' as const, startDate: monday, endDate: addDays(monday, 6) };
    // Scheduled working days only: with Monday as the only working day, Tuesday's contact is not counted.
    const monOnly = await computeProgress(pool, { ...UTC_ALL_DAYS, timezone: 'UTC', scheduleConfigured: true, workingDays: ['MON'] }, input);
    expect(monOnly).toEqual({ value: 2, note: null });
    // A holiday is not a working day.
    const holiday = await computeProgress(pool, { ...UTC_ALL_DAYS, timezone: 'UTC', scheduleConfigured: true, workingDays: ['MON', 'TUE'], holidays: [monday] }, input);
    expect(holiday.value).toBe(1);
    // Daily target on a non-working day is flagged.
    const daily = await computeProgress(
      pool,
      { ...UTC_ALL_DAYS, timezone: 'UTC', scheduleConfigured: true, workingDays: ['TUE'] },
      { ...input, period: 'daily', endDate: monday }
    );
    expect(daily.note).toBe('non_working_day');
  });

  it('Call Center: the day is the company-timezone day (22:30Z Monday is Tuesday in Beirut)', async () => {
    const cc = await makeEmployee('call_center');
    const monday = '2026-10-26';
    const b1 = await business(owner.id);
    await attempt(b1, cc, at(monday, '10:00'));
    await attempt(b1, cc, at(monday, '22:30')); // 00:30 Tuesday in Asia/Beirut (UTC+2)
    const input = { employeeId: cc, metric: 'businesses_contacted', period: 'weekly' as const, startDate: monday, endDate: '2026-11-01' };
    const utc = await computeProgress(pool, { ...UTC_ALL_DAYS, timezone: 'UTC' }, input);
    const beirut = await computeProgress(pool, { ...UTC_ALL_DAYS, timezone: 'Asia/Beirut' }, input);
    expect(utc.value).toBe(1); // same UTC day → once
    expect(beirut.value).toBe(2); // two Beirut days → twice
  });

  it('Developer: done tasks by completed_by_id; reopening and completing again does not inflate', async () => {
    const dev = await makeEmployee('developer');
    const biz = await business(owner.id);
    const att = await attempt(biz, owner.id, new Date(), 'accepted');
    const { rows: d } = await query<{ id: string }>(
      `INSERT INTO deals (business_id, accepted_attempt_id, accepted_by_id, client_needs_note) VALUES ($1, $2, $3, 'needs') RETURNING id`,
      [biz, att, owner.id]
    );
    const { rows: p } = await query<{ id: string }>(`INSERT INTO projects (deal_id, business_id, name) VALUES ($1, $2, 'D7 project') RETURNING id`, [d[0].id, biz]);
    const task = async () =>
      (await query<{ id: string }>(`INSERT INTO tasks (project_id, title, created_by_id, owner_id) VALUES ($1, $2, $3, $3) RETURNING id`, [p[0].id, `T ${uniq()}`, dev])).rows[0].id;
    const complete = (id: string, by: string) => query(`UPDATE tasks SET status = 'done', completed_at = now(), completed_by_id = $2 WHERE id = $1`, [id, by]);
    const reopen = (id: string) => query(`UPDATE tasks SET status = 'todo', completed_at = NULL, completed_by_id = NULL WHERE id = $1`, [id]);

    const t1 = await task();
    const t2 = await task();
    await task(); // never completed
    await complete(t1, dev);
    await reopen(t1);
    await complete(t1, dev);
    await reopen(t1);
    await complete(t1, dev);
    await complete(t2, owner.id); // completed by someone else: not the developer's
    const monday = mondayOf(todayUtc());
    const r = await call(owner, 'post', '/api/targets', { employeeId: dev, metric: 'tasks_completed', period: 'weekly', targetValue: 3, startDate: monday });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.currentValue).toBe(1);
    // Reopened and not yet completed again: no longer counted.
    await reopen(t1);
    const list = await call(owner, 'get', `/api/targets?employeeId=${dev}`);
    expect(list.body.items.find((x: { id: string }) => x.id === r.body.id).currentValue).toBe(0);
  });

  it('weekly targets: start must be a Monday; end is derived (start + 6) and a different end is refused', async () => {
    const de = await makeEmployee('data_entry');
    const monday = mondayOf(addDays(todayUtc(), 7)); // next week: never retroactive
    const tuesday = addDays(monday, 1);
    const notMonday = await call(owner, 'post', '/api/targets', { employeeId: de, metric: 'data_entries', period: 'weekly', targetValue: 5, startDate: tuesday });
    expect(notMonday.status).toBe(400);
    expect(notMonday.body.details).toHaveProperty('startDate');
    const wrongEnd = await call(owner, 'post', '/api/targets', {
      employeeId: de, metric: 'data_entries', period: 'weekly', targetValue: 5, startDate: monday, endDate: addDays(monday, 4),
    });
    expect(wrongEnd.status).toBe(400);
    expect(wrongEnd.body.details).toHaveProperty('endDate');
    const ok = await call(owner, 'post', '/api/targets', { employeeId: de, metric: 'data_entries', period: 'weekly', targetValue: 5, startDate: monday });
    expect(ok.status).toBe(201);
    expect(ok.body.endDate).toBe(addDays(monday, 6));
  });

  it('no retroactive changes: a past period cannot be targeted or edited; current edits are audited', async () => {
    const de = await makeEmployee('data_entry');
    const lastWeek = mondayOf(addDays(todayUtc(), -7));
    const past = await call(owner, 'post', '/api/targets', { employeeId: de, metric: 'data_entries', period: 'weekly', targetValue: 5, startDate: lastWeek });
    expect(past.status).toBe(422);
    expect(past.body.code).toBe('RULE_VIOLATION');

    const cur = await call(owner, 'post', '/api/targets', { employeeId: de, metric: 'data_entries', period: 'daily', targetValue: 5, startDate: todayUtc() });
    expect(cur.status).toBe(201);
    const edit = await call(owner, 'patch', `/api/targets/${cur.body.id}`, { version: cur.body.version, targetValue: 7 });
    expect(edit.status).toBe(200);
    expect(edit.body.targetValue).toBe(7);
    const { rows } = await query<{ before: { targetValue: number }; after: { targetValue: number; effectiveFrom: string } }>(
      `SELECT before_state AS before, after_state AS after FROM audit_events WHERE event_name = 'target.updated' AND entity_id = $1`,
      [cur.body.id]
    );
    expect(rows[0].before.targetValue).toBe(5);
    expect(rows[0].after).toMatchObject({ targetValue: 7, effectiveFrom: todayUtc() });
    // Changing the period is refused (it defines the dates).
    const period = await call(owner, 'patch', `/api/targets/${cur.body.id}`, { version: edit.body.version, period: 'weekly' });
    expect(period.status).toBe(422);

    // The period ends (simulated): further edits are refused and nothing changes.
    await query(`UPDATE targets SET start_date = $2, end_date = $2 WHERE id = $1`, [cur.body.id, addDays(todayUtc(), -1)]);
    const late = await call(owner, 'patch', `/api/targets/${cur.body.id}`, { version: edit.body.version, targetValue: 9 });
    expect(late.status).toBe(422);
    expect(late.body.code).toBe('RULE_VIOLATION');
    const { rows: t } = await query<{ target_value: string }>('SELECT target_value FROM targets WHERE id = $1', [cur.body.id]);
    expect(Number(t[0].target_value)).toBe(7);
  });
});
