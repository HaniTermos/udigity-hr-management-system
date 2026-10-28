/**
 * BE3 Increment 4 — Calling API tests on the Docker test DB (TEST_DATABASE_URL=…/udigity_test_be3). Owner: BE3.
 * Covers SEQ-09/10 (reservation lease, heartbeat, idle, max-total, override, J-05, concurrency),
 * SEQ-11/13 (attempt + outcome + follow-up + deal in one transaction, idempotency, post-commit release),
 * U-01 (APPROVED "Accepted keeps reservation"), the B3-Q05 save-after-loss FLAG (both branches),
 * assignment (WF-CALL-001), follow-ups, DNC (+ inbound route), reopen/requeue, queue/opportunities,
 * one role test per role, and leakage (hidden rows not counted).
 * Every other policy exercised here is a "Demonstration alternative — not approved".
 * Rows are uniquely named and never deleted (FKs RESTRICT, audit append-only).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { stateConflict } from '../../shared/errors.js';
import { clock } from '../platform/clock.js';
import { runJobNow } from '../platform/service.js';
import * as reservationRepo from '../reservation/repo.js';
import { deals4Port, setOpportunityPort } from './opportunityPort.js';
import { initCallingState, setSaveAfterLossOverride } from './service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const SEED_OWNER = 'udigity@gmail.com';
const MIN = 60_000;

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

async function login(email: string) {
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  return { res, cookie: cookieFrom(res), csrf: res.body.csrfToken as string };
}

function call(a: Pick<Agent, 'cookie' | 'csrf'>, method: 'get' | 'post' | 'patch', path: string, body?: object, idemKey?: string) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
  if (idemKey) r.set('Idempotency-Key', idemKey);
  return body ? r.send(body) : r;
}

async function employeeIdOf(email: string): Promise<string> {
  const { rows } = await query<{ id: string }>('SELECT id FROM employees WHERE LOWER(email) = LOWER($1)', [email]);
  return rows[0].id;
}

async function ownerAgent(): Promise<Agent> {
  const id = await employeeIdOf(SEED_OWNER);
  await query(
    `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL WHERE employee_id = $1`,
    [id]
  );
  const s = await login(SEED_OWNER);
  const v = await call(s, 'post', '/api/auth/2fa/verify', { token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id };
}

async function pendingOwner(): Promise<Agent> {
  const s = await login(SEED_OWNER);
  return { cookie: s.cookie, csrf: s.csrf, id: await employeeIdOf(SEED_OWNER) };
}

async function agentFor(role: Exclude<Role, 'owner'>, name = 'BE3 Test'): Promise<Agent> {
  const email = `be3.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, name, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  const s = await login(email);
  expect(s.res.status).toBe(200);
  return { cookie: s.cookie, csrf: s.csrf, id: rows[0].id };
}

let phoneSeq = Math.floor(Math.random() * 1e6);

/** A business created through the same hook BE2 uses (initCallingState in the insert transaction). */
async function newBusiness(createdBy: string, opts: { phone?: boolean; createdAt?: Date } = {}): Promise<string> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO businesses (name, created_by, created_at) VALUES ($1, $2, COALESCE($3, now())) RETURNING id`,
      [`BE3 Biz ${uniq()}`, createdBy, opts.createdAt ?? null]
    );
    const id = rows[0].id;
    if (opts.phone !== false) {
      const n = `9${String(++phoneSeq).padStart(9, '0')}${Math.floor(Math.random() * 10)}`;
      await tx.query(`INSERT INTO business_phones (business_id, country_code, number, normalized_phone) VALUES ($1, '+1', $2, $2)`, [id, n]);
    }
    await initCallingState(tx, id);
    return id;
  });
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await query<{ n: number }>(sql, params);
  return Number(rows[0].n);
}
const auditCount = (eventName: string, entityId: string) =>
  count('SELECT count(*)::int AS n FROM audit_events WHERE event_name = $1 AND entity_id = $2', [eventName, entityId]);

describe.skipIf(!hasTestDb)('BE3 Increment 4 — calling (DB)', () => {
  let owner: Agent;
  let cc: Agent;
  let cc2: Agent;
  let de: Agent;
  let dv: Agent;

  beforeAll(async () => {
    owner = await ownerAgent();
    cc = await agentFor('call_center', 'Cara Caller');
    cc2 = await agentFor('call_center', 'Other Caller');
    de = await agentFor('data_entry');
    dv = await agentFor('developer');
  });

  afterEach(() => {
    clock.set(null);
    setSaveAfterLossOverride(null);
    setOpportunityPort(null);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function assignTo(businessId: string, agent: Agent) {
    const r = await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [businessId], assigneeId: agent.id });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.assigned).toHaveLength(1);
    return r.body.assigned[0] as { id: string; version: number };
  }

  async function assignedBusiness(agent: Agent = cc) {
    const id = await newBusiness(owner.id);
    await assignTo(id, agent);
    return id;
  }

  const acquire = (a: Agent, businessId: string) => call(a, 'post', '/api/reservations', { businessId }, randomUUID());

  async function startContact(a: Agent, businessId: string) {
    const r = await acquire(a, businessId);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body as { id: string; leaseToken: string };
  }

  async function stateVersion(businessId: string): Promise<number> {
    const { rows } = await query<{ version: number }>('SELECT version FROM business_calling_states WHERE business_id = $1', [businessId]);
    return rows[0].version;
  }

  const future = (mins: number) => new Date(clock.now().getTime() + mins * MIN).toISOString();

  async function save(a: Agent, businessId: string, res: { id: string; leaseToken: string }, body: Record<string, unknown>, key = randomUUID()) {
    return call(
      a,
      'post',
      '/api/calling/attempts',
      { businessId, reservationId: res.id, leaseToken: res.leaseToken, stateVersion: await stateVersion(businessId), ...body },
      key
    );
  }

  // -------------------------------------------------------------------------
  // One role test per role (VT-3 + resource checks)
  // -------------------------------------------------------------------------
  describe('roles', () => {
    it('Data Entry: every calling endpoint is 403 FORBIDDEN_ROLE', async () => {
      const biz = await newBusiness(owner.id);
      for (const r of [
        await call(de, 'get', '/api/calling/queue'),
        await acquire(de, biz),
        await call(de, 'post', '/api/calling/attempts', {}, randomUUID()),
        await call(de, 'get', '/api/follow-ups'),
        await call(de, 'get', '/api/calling/do-not-call'),
        await call(de, 'get', '/api/calling-assignments'),
      ]) {
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('Developer: every calling endpoint is 403 FORBIDDEN_ROLE', async () => {
      for (const r of [
        await call(dv, 'get', '/api/calling/queue'),
        await call(dv, 'get', '/api/calling/opportunities'),
        await call(dv, 'post', '/api/follow-ups', { businessId: randomUUID(), scheduledFor: future(60) }),
        await call(dv, 'post', `/api/reservations/${randomUUID()}/renew`, { leaseToken: randomUUID() }),
      ]) {
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('Call Center: Owner-only commands are 403; an unassigned business is 403 PERMISSION_DENIED; own queue only', async () => {
      const biz = await newBusiness(owner.id);
      expect((await call(cc, 'post', '/api/calling-assignments/assign', { businessIds: [biz], assigneeId: cc.id })).status).toBe(403);
      expect((await call(cc, 'post', `/api/reservations/${randomUUID()}/override`, { reason: 'take over' })).status).toBe(403);
      expect((await call(cc, 'post', `/api/calling/businesses/${biz}/reopen`, { reason: 'reopen it', stateVersion: 1 })).status).toBe(403);
      const notMine = await acquire(cc, biz);
      expect(notMine.status).toBe(403);
      expect(notMine.body.code).toBe('PERMISSION_DENIED');
      expect((await call(cc, 'get', `/api/calling/businesses/${biz}/workspace`)).status).toBe(403);
      expect((await call(cc, 'get', `/api/calling/queue?agentId=${cc2.id}`)).status).toBe(403);
    });

    it('Owner: admin commands need completed 2FA; a pending-2FA Owner is refused (R11-a) and reads nothing', async () => {
      const pending = await pendingOwner();
      const biz = await newBusiness(owner.id);
      const r = await call(pending, 'post', '/api/calling-assignments/assign', { businessIds: [biz], assigneeId: cc.id });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('OWNER_2FA_REQUIRED');
      const q = await call(pending, 'get', '/api/calling/queue');
      expect(q.status).toBe(403);
      expect(q.body.items).toBeUndefined();
      const full = await call(owner, 'get', '/api/calling/queue');
      expect(full.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Assignment (WF-CALL-001)
  // -------------------------------------------------------------------------
  describe('assignment', () => {
    it('assign skips ineligible items (no phone, do-not-call, already assigned) and audits + emits E-07', async () => {
      const ok = await newBusiness(owner.id);
      const noPhone = await newBusiness(owner.id, { phone: false });
      const rejected = await newBusiness(owner.id);
      await query(`UPDATE business_calling_states SET outcome = 'rejected', rejection_reason = 'asked' WHERE business_id = $1`, [rejected]);
      const r = await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [ok, noPhone, rejected], assigneeId: cc.id });
      expect(r.status).toBe(200);
      expect(r.body.assigned.map((a: { businessId: string }) => a.businessId)).toEqual([ok]);
      expect(Object.fromEntries(r.body.skipped.map((s: { businessId: string; code: string }) => [s.businessId, s.code]))).toEqual({
        [noPhone]: 'no_phone',
        [rejected]: 'do_not_call',
      });
      const again = await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [ok], assigneeId: cc2.id });
      expect(again.body.skipped[0].code).toBe('already_assigned');
      expect(await auditCount('calling_assignment.assigned', r.body.assigned[0].id)).toBe(1);
      expect(await count(`SELECT count(*)::int AS n FROM outbox_events WHERE name = 'calling_assignment.assigned' AND aggregate_id = $1`, [r.body.assigned[0].id])).toBe(1);
      const bad = await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [ok], assigneeId: dv.id });
      expect(bad.status).toBe(422);
    });

    it('reassign: blocked while a reservation is active; version 409; transfers the follow-up by explicit choice', async () => {
      const biz = await newBusiness(owner.id);
      const a = await assignTo(biz, cc);
      const res = await startContact(cc, biz);
      const fu = await call(cc, 'post', '/api/follow-ups', { businessId: biz, scheduledFor: future(120) });
      expect(fu.status).toBe(201);
      const impact = await call(owner, 'post', '/api/calling-assignments/reassign-impact', { businessId: biz, newAssigneeId: cc2.id });
      expect(impact.status).toBe(200);
      expect(impact.body.activeReservation.holderName).toBe('Cara Caller');
      expect(impact.body.openFollowUps[0]).toMatchObject({ id: fu.body.followUp.id, preselected: 'transfer' });

      const body = { businessId: biz, newAssigneeId: cc2.id, version: a.version, reason: 'agent rotation', followUps: [{ followUpId: fu.body.followUp.id, action: 'transfer' }] };
      const blocked = await call(owner, 'post', '/api/calling-assignments/reassign', body);
      expect(blocked.status).toBe(409);
      expect(blocked.body.details.reason).toBe('reservation_active');

      expect((await call(cc, 'post', `/api/reservations/${res.id}/release`, { leaseToken: res.leaseToken })).status).toBe(200);
      expect((await call(owner, 'post', '/api/calling-assignments/reassign', { ...body, version: a.version + 5 })).status).toBe(409);
      const missing = await call(owner, 'post', '/api/calling-assignments/reassign', { ...body, followUps: [] });
      expect(missing.status).toBe(422);
      const ok = await call(owner, 'post', '/api/calling-assignments/reassign', body);
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.assignment.assigneeId).toBe(cc2.id);
      const { rows } = await query<{ responsible_id: string }>('SELECT responsible_id FROM follow_ups WHERE id = $1', [fu.body.followUp.id]);
      expect(rows[0].responsible_id).toBe(cc2.id);
      expect(await auditCount('calling_assignment.reassigned', ok.body.assignment.id)).toBe(1);
      // The previous agent lost access; the new one has it.
      expect((await call(cc, 'get', `/api/calling/businesses/${biz}/workspace`)).status).toBe(403);
      expect((await call(cc2, 'get', `/api/calling/businesses/${biz}/workspace`)).status).toBe(200);
    });

    it('unassign with cancel choice on a Needs-another-call business sets the D2 marker; list shows Unassigned', async () => {
      const biz = await newBusiness(owner.id);
      const a = await assignTo(biz, cc);
      const res = await startContact(cc, biz);
      const s = await save(cc, biz, res, { outcome: 'needs_another_call', followUp: { scheduledFor: future(90) } });
      expect(s.status, JSON.stringify(s.body)).toBe(201);
      const fuId = s.body.followUp.id as string;
      const u = await call(owner, 'post', '/api/calling-assignments/unassign', {
        businessId: biz, version: a.version, reason: 'pause calling', followUps: [{ followUpId: fuId, action: 'cancel', reason: 'unassigned' }],
      });
      expect(u.status, JSON.stringify(u.body)).toBe(200);
      const st = await query<{ callback_marker: boolean }>('SELECT callback_marker FROM business_calling_states WHERE business_id = $1', [biz]);
      expect(st.rows[0].callback_marker).toBe(true);
      // BL-14: walk every page, so the check does not depend on what other suites left in the DB.
      let found = false;
      for (let page = 1; !found; page++) {
        const list = await call(owner, 'get', `/api/calling-assignments?status=unassigned&pageSize=100&sort=businessName&page=${page}`);
        expect(list.status).toBe(200);
        found = list.body.items.some((i: { businessId: string; assignment: unknown }) => i.businessId === biz && i.assignment === null);
        if (page * 100 >= list.body.total) break;
      }
      expect(found).toBe(true);
    });

    it('BL-01: list rows carry category, phone, reservation holder and last attempt; q searches name and phone digits', async () => {
      const biz = await newBusiness(owner.id);
      await assignTo(biz, cc);
      const res = await startContact(cc, biz);
      const s = await save(cc, biz, res, { outcome: 'on_hold', keepReservation: true });
      expect(s.status, JSON.stringify(s.body)).toBe(201);
      const { rows } = await query<{ name: string; phone: string }>(
        'SELECT b.name, p.normalized_phone AS phone FROM businesses b JOIN business_phones p ON p.business_id = b.id WHERE b.id = $1',
        [biz]
      );
      type Item = { businessId: string; categoryName: string | null; phone: string | null; phoneCount: number; reservation: { state: string; holderId?: string; holderName?: string }; lastAttempt: { outcome: string } | null; attemptCount: number };
      const byName = await call(owner, 'get', `/api/calling-assignments?q=${encodeURIComponent(rows[0].name)}`);
      expect(byName.status).toBe(200);
      const item = (byName.body.items as Item[]).find((i) => i.businessId === biz)!;
      expect(item).toMatchObject({
        categoryName: expect.any(String),
        phone: rows[0].phone,
        phoneCount: 1,
        reservation: { state: 'reserved', holderId: cc.id, holderName: 'Cara Caller' },
        lastAttempt: { outcome: 'on_hold' },
        attemptCount: 1,
      });
      const byPhone = await call(owner, 'get', `/api/calling-assignments?q=${rows[0].phone.slice(-7)}`);
      expect((byPhone.body.items as Item[]).map((i) => i.businessId)).toContain(biz);
      const reserved = await call(owner, 'get', `/api/calling-assignments?q=${encodeURIComponent(rows[0].name)}&reservation=reserved`);
      expect((reserved.body.items as Item[]).map((i) => i.businessId)).toEqual([biz]);
      const free = await call(owner, 'get', `/api/calling-assignments?q=${encodeURIComponent(rows[0].name)}&reservation=free`);
      expect(free.body.total).toBe(0);
      // A wildcard in q is literal.
      expect((await call(owner, 'get', '/api/calling-assignments?q=%25%25')).body.total).toBe(0);
    });

    it('autofill respects the per-agent daily cap (DEMO DEC-021)', async () => {
      const agent = await agentFor('call_center');
      await newBusiness(owner.id);
      await newBusiness(owner.id);
      const r = await call(owner, 'post', '/api/calling-assignments/autofill', { agentId: agent.id, limit: 2 });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.assigned).toHaveLength(2);
      expect(r.body.assigned.every((x: { source: string }) => x.source === 'automatic')).toBe(true);
      expect(r.body.cap).toBe(40);
    });
  });

  // -------------------------------------------------------------------------
  // SEQ-09 / SEQ-10 — reservations
  // -------------------------------------------------------------------------
  describe('reservations (SEQ-09/10)', () => {
    it('acquire → re-entry returns the same row; another user gets 409 with the holder name; release is idempotent', async () => {
      const biz = await assignedBusiness();
      const first = await startContact(cc, biz);
      const again = await acquire(cc, biz);
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ id: first.id, reentry: true, leaseToken: first.leaseToken });
      const other = await acquire(owner, biz);
      expect(other.status).toBe(409);
      expect(other.body.code).toBe('RESERVATION_CONFLICT');
      expect(other.body.details.holderName).toBe('Cara Caller');
      expect(JSON.stringify(other.body)).not.toContain(first.leaseToken);
      expect((await call(cc, 'post', `/api/reservations/${first.id}/release`, { leaseToken: first.leaseToken })).status).toBe(200);
      const twice = await call(cc, 'post', `/api/reservations/${first.id}/release`, { leaseToken: first.leaseToken });
      expect(twice.status).toBe(200);
      expect(twice.body.state).toBe('released');
      expect(await auditCount('contact_reservation.released', first.id)).toBe(1);
      expect((await call(cc, 'post', '/api/reservations', { businessId: biz })).status).toBe(400); // Idempotency-Key required
    });

    it('concurrency: parallel acquires produce exactly one Active row (database arbiter)', async () => {
      const biz = await assignedBusiness();
      const results = await Promise.all([acquire(cc, biz), acquire(owner, biz), acquire(cc, biz), acquire(owner, biz), acquire(cc, biz), acquire(owner, biz)]);
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.every((s) => s === 201 || s === 200 || s === 409)).toBe(true);
      const winner = results.find((r) => r.status === 201)!.body.id;
      for (const r of results.filter((x) => x.status === 200)) expect(r.body.id).toBe(winner);
      expect(await count(`SELECT count(*)::int AS n FROM contact_reservations WHERE business_id = $1 AND state = 'active'`, [biz])).toBe(1);

      // Repo level: 8 racing inserts with different holders, one winner.
      const biz2 = await newBusiness(owner.id);
      const holders = [cc.id, cc2.id, owner.id, de.id, dv.id, cc.id, cc2.id, owner.id];
      const now = new Date();
      const rows = await Promise.all(
        holders.map((h) => withTransaction((tx) => reservationRepo.insertActive(tx, { businessId: biz2, holderId: h, now, leaseExpiresAt: new Date(now.getTime() + 5 * MIN) })))
      );
      expect(rows.filter(Boolean)).toHaveLength(1);
    });

    it('lazy expiry on acquire: after the lease lapses another user acquires; `expired` audited exactly once (J-05 later finds nothing)', async () => {
      clock.set(new Date());
      const biz = await assignedBusiness();
      const first = await startContact(cc, biz);
      clock.advance(6 * MIN);
      const next = await acquire(owner, biz);
      expect(next.status).toBe(201);
      const { rows } = await query<{ state: string; end_reason: string }>('SELECT state, end_reason FROM contact_reservations WHERE id = $1', [first.id]);
      expect(rows[0]).toEqual({ state: 'expired', end_reason: 'lease_elapsed' });
      await runJobNow('reservation.expiry_sweep');
      expect(await auditCount('contact_reservation.expired', first.id)).toBe(1);
    });

    it('J-05 sweep (BE5 JobQueue handler) expires a lapsed row once; renew after loss is 409 RESERVATION_LOST', async () => {
      clock.set(new Date());
      const biz = await assignedBusiness();
      const r = await startContact(cc, biz);
      clock.advance(5 * MIN + 1000);
      await runJobNow('reservation.expiry_sweep');
      await runJobNow('reservation.expiry_sweep');
      expect(await auditCount('contact_reservation.expired', r.id)).toBe(1);
      const renew = await call(cc, 'post', `/api/reservations/${r.id}/renew`, { leaseToken: r.leaseToken });
      expect(renew.status).toBe(409);
      expect(renew.body.code).toBe('RESERVATION_LOST');
    });

    it('heartbeat extends the lease; no user input for 15 min ends it as idle (DEMO DEC-004)', async () => {
      clock.set(new Date());
      const start = clock.now().getTime();
      const biz = await assignedBusiness();
      const r = await startContact(cc, biz);
      let last = '';
      for (const m of [4, 8, 12]) {
        clock.set(new Date(start + m * MIN));
        const hb = await call(cc, 'post', `/api/reservations/${r.id}/renew`, { leaseToken: r.leaseToken, idleSeconds: m * 60 });
        expect(hb.status, JSON.stringify(hb.body)).toBe(200);
        expect(hb.body.leaseExpiresAt > last).toBe(true);
        last = hb.body.leaseExpiresAt;
        expect(hb.body.idleWarning).toBe(m >= 13);
      }
      expect(last).toBe(new Date(start + 15 * MIN).toISOString()); // capped by the idle deadline
      clock.set(new Date(start + 13.5 * MIN));
      const warn = await call(cc, 'post', `/api/reservations/${r.id}/renew`, { leaseToken: r.leaseToken, idleSeconds: 810 });
      expect(warn.body.idleWarning).toBe(true);
      clock.set(new Date(start + 16 * MIN));
      const lost = await call(cc, 'post', `/api/reservations/${r.id}/renew`, { leaseToken: r.leaseToken, idleSeconds: 960 });
      expect(lost.status).toBe(409);
      expect(lost.body.details.reason).toBe('idle');
    });

    it('max-total: warning before 60 min, "Keep working" restarts the window, otherwise it ends as max_total', async () => {
      clock.set(new Date());
      const start = clock.now().getTime();
      const biz = await assignedBusiness();
      const r = await startContact(cc, biz);
      const beat = (m: number, keepWorking = false) => {
        clock.set(new Date(start + m * MIN));
        return call(cc, 'post', `/api/reservations/${r.id}/renew`, { leaseToken: r.leaseToken, idleSeconds: 0, keepWorking });
      };
      for (let m = 4; m <= 56; m += 4) expect((await beat(m)).status).toBe(200);
      const w = await beat(58.5);
      expect(w.body.maxTotalWarning).toBe(true);
      expect(w.body.leaseExpiresAt).toBe(new Date(start + 60 * MIN).toISOString());
      const lost = await beat(61);
      expect(lost.status).toBe(409);
      expect(lost.body.details.reason).toBe('max_total');

      // Same again with "Keep working" at the warning.
      clock.set(new Date(start + 120 * MIN));
      const biz2 = await assignedBusiness();
      const start2 = clock.now().getTime();
      const r2 = await startContact(cc, biz2);
      const beat2 = (m: number, keepWorking = false) => {
        clock.set(new Date(start2 + m * MIN));
        return call(cc, 'post', `/api/reservations/${r2.id}/renew`, { leaseToken: r2.leaseToken, idleSeconds: 0, keepWorking });
      };
      for (let m = 4; m <= 56; m += 4) expect((await beat2(m)).status).toBe(200);
      const kept = await beat2(58.5, true);
      expect(kept.status).toBe(200);
      expect(kept.body.maxTotalExpiresAt).toBe(new Date(start2 + 118.5 * MIN).toISOString());
      expect((await beat2(62)).status).toBe(200);
    });

    it('Owner override (reason required, 2FA) ends the holder reservation; the holder then loses it', async () => {
      const biz = await assignedBusiness();
      const r = await startContact(cc, biz);
      expect((await call(owner, 'post', `/api/reservations/${r.id}/override`, { reason: '' })).status).toBe(400);
      const pending = await pendingOwner();
      expect((await call(pending, 'post', `/api/reservations/${r.id}/override`, { reason: 'urgent client call' })).body.code).toBe('OWNER_2FA_REQUIRED');
      const o = await call(owner, 'post', `/api/reservations/${r.id}/override`, { reason: 'urgent client call' });
      expect(o.status).toBe(200);
      expect(o.body.state).toBe('overridden');
      const { rows } = await query<{ reason: string; payload: { holderId: string } }>(
        `SELECT reason, payload FROM audit_events WHERE event_name = 'contact_reservation.overridden' AND entity_id = $1`,
        [r.id]
      );
      expect(rows[0].reason).toBe('urgent client call');
      expect(rows[0].payload.holderId).toBe(cc.id);
      // BL-03: holder notice event, same transaction as the audit row.
      expect(await count(`SELECT count(*)::int AS n FROM outbox_events WHERE name = 'contact_reservation.overridden' AND aggregate_id = $1`, [r.id])).toBe(1);
      const renew = await call(cc, 'post', `/api/reservations/${r.id}/renew`, { leaseToken: r.leaseToken });
      expect(renew.status).toBe(409);
      expect(renew.body.details.reason).toBe('overridden');
      expect((await acquire(owner, biz)).status).toBe(201);
    });

    it('acquire is refused on a do-not-call (Rejected) business for everyone, including the Owner', async () => {
      const biz = await assignedBusiness();
      await query(`UPDATE business_calling_states SET outcome = 'rejected', rejection_reason = 'stop' WHERE business_id = $1`, [biz]);
      for (const a of [cc, owner]) {
        const r = await acquire(a, biz);
        expect(r.status).toBe(409);
        expect(r.body.details.reason).toBe('do_not_call');
      }
    });
  });

  // -------------------------------------------------------------------------
  // SEQ-11 / SEQ-13 — attempts, outcomes, U-01, save-after-loss
  // -------------------------------------------------------------------------
  describe('attempts and outcomes (SEQ-11/13)', () => {
    it('double submit with the same Idempotency-Key stores one attempt; a different body with that key is 409', async () => {
      const biz = await assignedBusiness();
      const res = await startContact(cc, biz);
      const key = randomUUID();
      const body = { businessId: biz, reservationId: res.id, leaseToken: res.leaseToken, stateVersion: await stateVersion(biz), outcome: 'on_hold', keepReservation: true };
      const a = await call(cc, 'post', '/api/calling/attempts', body, key);
      expect(a.status, JSON.stringify(a.body)).toBe(201);
      const b = await call(cc, 'post', '/api/calling/attempts', body, key);
      expect(b.status).toBe(201);
      expect(b.body.attempt.id).toBe(a.body.attempt.id);
      expect(await count('SELECT count(*)::int AS n FROM call_attempts WHERE business_id = $1', [biz])).toBe(1);
      const c = await call(cc, 'post', '/api/calling/attempts', { ...body, notes: 'changed' }, key);
      expect(c.status).toBe(409);
      expect(c.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect((await call(cc, 'post', '/api/calling/attempts', body)).status).toBe(400); // key required
    });

    it('validation: D2 needs follow-up XOR marker; Accepted note min length; client time rejected; stale stateVersion 409', async () => {
      const biz = await assignedBusiness();
      const res = await startContact(cc, biz);
      expect((await save(cc, biz, res, { outcome: 'needs_another_call' })).status).toBe(400);
      expect((await save(cc, biz, res, { outcome: 'accepted', clientNeedsNote: 'short' })).status).toBe(400);
      expect((await save(cc, biz, res, { outcome: 'on_hold', attemptedAt: new Date().toISOString() })).status).toBe(400);
      expect((await save(cc, biz, res, { outcome: 'on_hold', followUp: { scheduledFor: new Date(Date.now() - MIN).toISOString() } })).status).toBe(400);
      const stale = await call(cc, 'post', '/api/calling/attempts',
        { businessId: biz, reservationId: res.id, leaseToken: res.leaseToken, stateVersion: 999, outcome: 'on_hold' }, randomUUID());
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('VERSION_CONFLICT');
      expect(stale.body.details.currentVersion).toBe(await stateVersion(biz));
      expect(await count('SELECT count(*)::int AS n FROM call_attempts WHERE business_id = $1', [biz])).toBe(0);
    });

    it('needs_another_call with a follow-up: one transaction (attempt, follow-up, audit, E-05/E-16 outbox), then release', async () => {
      const biz = await assignedBusiness();
      const res = await startContact(cc, biz);
      const r = await save(cc, biz, res, { outcome: 'needs_another_call', followUp: { scheduledFor: future(30), purpose: 'call back' }, notes: 'busy' });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.reservation).toBe('released');
      expect(r.body.state).toMatchObject({ outcome: 'needs_another_call', callbackMarker: false });
      expect(r.body.followUp).toMatchObject({ state: 'scheduled', responsibleId: cc.id });
      expect(await auditCount('call_attempt.logged', r.body.attempt.id)).toBe(1);
      expect(await auditCount('call_outcome.changed', biz)).toBe(1);
      expect(await count(`SELECT count(*)::int AS n FROM outbox_events WHERE name = 'follow_up.scheduled' AND aggregate_id = $1`, [r.body.followUp.id])).toBe(1);
      const { rows } = await query<{ state: string; end_reason: string }>('SELECT state, end_reason FROM contact_reservations WHERE id = $1', [res.id]);
      expect(rows[0]).toEqual({ state: 'released', end_reason: 'call_saved' });
      // The attempt is append-only.
      await expect(query('UPDATE call_attempts SET notes = $1 WHERE id = $2', ['x', r.body.attempt.id])).rejects.toThrow(/append-only/);
    });

    it('U-01 (APPROVED): keepReservation keeps the lease for Accepted, Needs another call and On hold; forbidden for Rejected', async () => {
      for (const outcome of ['on_hold', 'needs_another_call', 'accepted'] as const) {
        const biz = await assignedBusiness();
        const res = await startContact(cc, biz);
        const extra =
          outcome === 'accepted' ? { clientNeedsNote: 'Wants a new website with booking' } : outcome === 'needs_another_call' ? { callbackToBeScheduled: true } : {};
        const r = await save(cc, biz, res, { outcome, keepReservation: true, ...extra });
        expect(r.status, `${outcome}: ${JSON.stringify(r.body)}`).toBe(201);
        expect(r.body.reservation).toBe('kept');
        expect(r.body.reservationLease.id).toBe(res.id);
        const { rows } = await query<{ state: string }>('SELECT state FROM contact_reservations WHERE id = $1', [res.id]);
        expect(rows[0].state).toBe('active');
      }
      const biz = await assignedBusiness();
      const res = await startContact(cc, biz);
      const bad = await save(cc, biz, res, { outcome: 'rejected', rejectionReason: 'asked to stop', keepReservation: true });
      expect(bad.status).toBe(400);
      const ws = await call(cc, 'get', `/api/calling/businesses/${biz}/workspace`);
      expect(ws.body.allowed.keepReservation).toEqual({ on_hold: true, needs_another_call: true, rejected: false, accepted: true });
    });

    it('Accepted creates the BE4 deal in the same transaction and keeps the open follow-up (D4); opportunities list shows it', async () => {
      const biz = await assignedBusiness();
      const fu = await call(cc, 'post', '/api/follow-ups', { businessId: biz, scheduledFor: future(240) });
      expect(fu.status).toBe(201);
      const res = await startContact(cc, biz);
      const r = await save(cc, biz, res, { outcome: 'accepted', clientNeedsNote: 'Needs an online shop for 200 items', serviceInterest: 'e-commerce' });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.dealId).toBeTruthy();
      expect(r.body.developerAssigned).toBe(false);
      expect(await count('SELECT count(*)::int AS n FROM deals WHERE accepted_attempt_id = $1', [r.body.attempt.id])).toBe(1);
      const { rows } = await query<{ state: string }>('SELECT state FROM follow_ups WHERE id = $1', [fu.body.followUp.id]);
      expect(rows[0].state).toBe('scheduled');
      const opp = await call(cc, 'get', '/api/calling/opportunities?pageSize=100');
      expect(opp.status).toBe(200);
      const item = opp.body.items.find((i: { businessId: string }) => i.businessId === biz);
      expect(item).toMatchObject({ clientNeedsNote: 'Needs an online shop for 200 items', serviceInterest: 'e-commerce', attemptId: r.body.attempt.id });
      expect(item.deal.dealId).toBe(r.body.dealId);
      // B3-Q12: an agent cannot change Accepted; logging another "accepted" attempt is allowed (attempt only).
      const res2 = await startContact(cc, biz);
      expect((await save(cc, biz, res2, { outcome: 'on_hold' })).status).toBe(422);
      const again = await save(cc, biz, res2, { outcome: 'accepted', clientNeedsNote: 'Confirmed the shop again' });
      expect(again.status).toBe(201);
      expect(again.body.dealId).toBeNull();
    });

    it('a failing deal insert rolls the whole save back (no attempt row); DEC-017 open deal is 409 with the deal id', async () => {
      const biz = await assignedBusiness();
      const res = await startContact(cc, biz);
      setOpportunityPort({
        ...deals4Port,
        async createAcceptedOpportunity() {
          throw stateConflict('This business already has an open deal', { reason: 'open_deal', dealId: 'x' });
        },
      });
      const r = await save(cc, biz, res, { outcome: 'accepted', clientNeedsNote: 'Wants a mobile app quickly' });
      expect(r.status).toBe(409);
      expect(await count('SELECT count(*)::int AS n FROM call_attempts WHERE business_id = $1', [biz])).toBe(0);
      expect((await query<{ outcome: string }>('SELECT outcome FROM business_calling_states WHERE business_id = $1', [biz])).rows[0].outcome).toBe('pending');
      setOpportunityPort(null);

      // DEC-017 through the real BE4 op: an open deal already exists for the business.
      const ok = await save(cc, biz, res, { outcome: 'accepted', clientNeedsNote: 'Wants a mobile app quickly', keepReservation: true });
      expect(ok.status).toBe(201);
      await query(`UPDATE business_calling_states SET outcome = 'on_hold' WHERE business_id = $1`, [biz]); // simulate drift
      const dup = await save(cc, biz, res, { outcome: 'accepted', clientNeedsNote: 'Second acceptance attempt' });
      expect(dup.status).toBe(409);
      expect(dup.body.details.dealId).toBe(ok.body.dealId);
    });

    it('Rejected cancels the open follow-up and clears the marker (D4); DNC list scoped; Owner reopens (DEC-016)', async () => {
      const biz = await assignedBusiness();
      const res = await startContact(cc, biz);
      const first = await save(cc, biz, res, { outcome: 'needs_another_call', followUp: { scheduledFor: future(60) }, keepReservation: true });
      expect(first.status).toBe(201);
      const r = await save(cc, biz, res, { outcome: 'rejected', rejectionReason: 'Not interested, asked to stop' });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.cancelledFollowUpIds).toEqual([first.body.followUp.id]);
      expect(r.body.state).toMatchObject({ outcome: 'rejected', callbackMarker: false });
      const fu = await query<{ cancel_source: string }>('SELECT cancel_source FROM follow_ups WHERE id = $1', [first.body.followUp.id]);
      expect(fu.rows[0].cancel_source).toBe('outcome_rejected');
      expect((await call(cc, 'post', '/api/follow-ups', { businessId: biz, scheduledFor: future(60) })).status).toBe(409);

      const mine = await call(cc, 'get', '/api/calling/do-not-call?pageSize=100');
      expect(mine.body.items.some((i: { businessId: string }) => i.businessId === biz)).toBe(true);
      const theirs = await call(cc2, 'get', '/api/calling/do-not-call?pageSize=100');
      expect(theirs.body.items.some((i: { businessId: string }) => i.businessId === biz)).toBe(false);

      const v = await stateVersion(biz);
      expect((await call(owner, 'post', `/api/calling/businesses/${biz}/reopen`, { reason: 'x', stateVersion: v })).status).toBe(400);
      expect((await call(owner, 'post', `/api/calling/businesses/${biz}/reopen`, { reason: 'Client called back', stateVersion: v + 1 })).status).toBe(409);
      const re = await call(owner, 'post', `/api/calling/businesses/${biz}/reopen`, { reason: 'Client called back', stateVersion: v });
      expect(re.status).toBe(200);
      expect(re.body.state.outcome).toBe('pending');
      expect(await auditCount('call_outcome.reopened', biz)).toBe(1);
      expect((await call(owner, 'post', `/api/calling/businesses/${biz}/reopen`, { reason: 'Client called back', stateVersion: v + 1 })).status).toBe(409);
    });

    it('inbound do-not-call (separate route, no reservation) by the assignee', async () => {
      const biz = await assignedBusiness();
      const fu = await call(cc, 'post', '/api/follow-ups', { businessId: biz, scheduledFor: future(60) });
      const r = await call(cc, 'post', '/api/calling/attempts/inbound-rejection',
        { businessId: biz, stateVersion: await stateVersion(biz), rejectionReason: 'Emailed: remove us' }, randomUUID());
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.attempt).toMatchObject({ channel: 'inbound_other', outcome: 'rejected' });
      expect(r.body.cancelledFollowUpIds).toEqual([fu.body.followUp.id]);
      const other = await call(cc2, 'post', '/api/calling/attempts/inbound-rejection',
        { businessId: await assignedBusiness(), stateVersion: 1, rejectionReason: 'not my business' }, randomUUID());
      expect(other.status).toBe(403);
    });

    it('Owner re-queues an Accepted business only after the deal is Not proceeding (B3-Q12)', async () => {
      const biz = await assignedBusiness();
      const res = await startContact(cc, biz);
      const acc = await save(cc, biz, res, { outcome: 'accepted', clientNeedsNote: 'Wants branding and a site' });
      expect(acc.status).toBe(201);
      const v = await stateVersion(biz);
      const early = await call(owner, 'post', `/api/calling/businesses/${biz}/requeue`, { reason: 'Deal is open still', stateVersion: v });
      expect(early.status).toBe(409);
      await query(`UPDATE deals SET stage = 'not_proceeding', not_proceeding_reason = 'budget', not_proceeding_at = now(), not_proceeding_by_id = $2 WHERE id = $1`, [acc.body.dealId, owner.id]);
      const ok = await call(owner, 'post', `/api/calling/businesses/${biz}/requeue`, { reason: 'Try again next quarter', stateVersion: v });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.state.outcome).toBe('pending');
      expect(await count(`SELECT count(*)::int AS n FROM outcome_reopenings WHERE business_id = $1 AND kind = 'requeue'`, [biz])).toBe(1);
    });

    describe('save after reservation loss (B3-Q05 FLAG, DEMO) — same request, both branches', () => {
      async function lostSetup() {
        clock.set(new Date());
        const biz = await assignedBusiness();
        const res = await startContact(cc, biz);
        clock.advance(6 * MIN); // lease lapsed
        const body = { outcome: 'needs_another_call', followUp: { scheduledFor: future(60) }, notes: 'Spoke to the manager' };
        return { biz, res, body };
      }

      it('keepAttemptOnly: attempt and notes stored, outcome/follow-up not applied, warning returned', async () => {
        setSaveAfterLossOverride('keepAttemptOnly');
        const { biz, res, body } = await lostSetup();
        const r = await save(cc, biz, res, body);
        expect(r.status, JSON.stringify(r.body)).toBe(201);
        expect(r.body).toMatchObject({ warning: 'outcome_not_applied', reservation: 'lost', followUp: null });
        expect(r.body.attempt).toMatchObject({ outcomeApplied: false, notes: 'Spoke to the manager' });
        expect(r.body.state.outcome).toBe('pending');
        expect(r.body.state.lastTouchpointAt).not.toBeNull();
        expect(await count(`SELECT count(*)::int AS n FROM follow_ups WHERE business_id = $1`, [biz])).toBe(0);
        expect(await count(`SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id = $1`, [biz])).toBe(0);
      });

      it('reject: nothing stored, 409 RESERVATION_LOST', async () => {
        setSaveAfterLossOverride('reject');
        const { biz, res, body } = await lostSetup();
        const r = await save(cc, biz, res, body);
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('RESERVATION_LOST');
        expect(await count('SELECT count(*)::int AS n FROM call_attempts WHERE business_id = $1', [biz])).toBe(0);
      });

      it('both branches: a business that became Rejected is refused first', async () => {
        for (const v of ['keepAttemptOnly', 'reject'] as const) {
          setSaveAfterLossOverride(v);
          const { biz, res, body } = await lostSetup();
          await query(`UPDATE business_calling_states SET outcome = 'rejected', rejection_reason = 'stop' WHERE business_id = $1`, [biz]);
          const r = await save(cc, biz, res, body);
          expect(r.status).toBe(409);
          expect(await count('SELECT count(*)::int AS n FROM call_attempts WHERE business_id = $1', [biz])).toBe(0);
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // Follow-ups, queue, workspace, leakage
  // -------------------------------------------------------------------------
  describe('follow-ups, queue and leakage', () => {
    it('B3-Q04: a second create reschedules the open follow-up; reschedule/complete need version; D2 replacement rule', async () => {
      const biz = await assignedBusiness();
      const a = await call(cc, 'post', '/api/follow-ups', { businessId: biz, scheduledFor: future(60) });
      expect(a.status).toBe(201);
      const b = await call(cc, 'post', '/api/follow-ups', { businessId: biz, scheduledFor: future(120) });
      expect(b.status).toBe(200);
      expect(b.body).toMatchObject({ rescheduled: true, followUp: { id: a.body.followUp.id } });
      const id = a.body.followUp.id as string;
      expect((await call(cc, 'patch', `/api/follow-ups/${id}`, { version: 1, scheduledFor: future(30) })).status).toBe(409);
      const p = await call(cc, 'patch', `/api/follow-ups/${id}`, { version: b.body.followUp.version, scheduledFor: future(30) });
      expect(p.status).toBe(200);
      expect(await auditCount('follow_up.rescheduled', id)).toBe(2);
      expect((await call(cc, 'post', `/api/follow-ups/${id}/cancel`, { version: p.body.followUp.version, reason: 'no' })).status).toBe(400);

      // Turn the business into Needs another call: completing the last open follow-up then needs a replacement.
      await query(`UPDATE business_calling_states SET outcome = 'needs_another_call' WHERE business_id = $1`, [biz]);
      const noRep = await call(cc, 'post', `/api/follow-ups/${id}/complete`, { version: p.body.followUp.version, completionNote: 'called' });
      expect(noRep.status).toBe(422);
      const done = await call(cc, 'post', `/api/follow-ups/${id}/complete`, { version: p.body.followUp.version, completionNote: 'called', replacement: 'callback_to_be_scheduled' });
      expect(done.status, JSON.stringify(done.body)).toBe(200);
      expect(done.body.followUp.state).toBe('completed');
      expect(done.body.state.callbackMarker).toBe(true);
    });

    it('calendar: Call Center sees only own responsibility; range filter; another agent cannot change it', async () => {
      const biz = await assignedBusiness();
      const fu = await call(cc, 'post', '/api/follow-ups', { businessId: biz, scheduledFor: future(90) });
      const from = new Date(Date.now() - MIN).toISOString();
      const to = new Date(Date.now() + 3 * 3600_000).toISOString();
      const mine = await call(cc, 'get', `/api/follow-ups?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      expect(mine.status).toBe(200);
      expect(mine.body.items.some((i: { id: string }) => i.id === fu.body.followUp.id)).toBe(true);
      expect(mine.body.items.every((i: { responsibleId: string }) => i.responsibleId === cc.id)).toBe(true);
      const theirs = await call(cc2, 'get', `/api/follow-ups?pageSize=100`);
      expect(theirs.body.items.some((i: { id: string }) => i.id === fu.body.followUp.id)).toBe(false);
      expect((await call(cc2, 'patch', `/api/follow-ups/${fu.body.followUp.id}`, { version: 1, scheduledFor: future(30) })).status).toBe(403);
      expect((await call(cc, 'get', `/api/follow-ups?responsibleId=${cc2.id}`)).status).toBe(403);
      expect((await call(cc, 'post', `/api/follow-ups/${randomUUID()}/cancel`, { version: 1, reason: 'gone now' })).status).toBe(404);
    });

    it('queue: derived buckets and counts after the access scope; a business past the 15-day window is not counted', async () => {
      const agent = await agentFor('call_center');
      const fresh = await assignedBusiness(agent);
      const marker = await assignedBusiness(agent);
      await query(`UPDATE business_calling_states SET outcome = 'needs_another_call', callback_marker = true WHERE business_id = $1`, [marker]);
      const old = await newBusiness(owner.id, { createdAt: new Date(Date.now() - 20 * 86_400_000) });
      await assignTo(old, agent);
      const q = await call(agent, 'get', '/api/calling/queue?pageSize=100');
      expect(q.status).toBe(200);
      const ids = q.body.items.map((i: { businessId: string }) => i.businessId);
      expect(ids).toContain(fresh);
      expect(ids).not.toContain(old);
      expect(q.body.total).toBe(2);
      expect(q.body.counts.new_assigned).toBe(1);
      expect(q.body.counts.callback_to_schedule).toBe(1);
      const filtered = await call(agent, 'get', '/api/calling/queue?bucket=callback_to_schedule');
      expect(filtered.body.items.map((i: { businessId: string }) => i.businessId)).toEqual([marker]);
      // The Owner sees the hidden one in the agent queue (Owner skips the window).
      const ownerView = await call(owner, 'get', `/api/calling/queue?agentId=${agent.id}&pageSize=100`);
      expect(ownerView.body.total).toBe(3);
      // reservedByOther without the holder name.
      await startContact(owner, fresh);
      const q2 = await call(agent, 'get', '/api/calling/queue?pageSize=100');
      const item = q2.body.items.find((i: { businessId: string }) => i.businessId === fresh);
      expect(item.reservedByOther).toBe(true);
      expect(JSON.stringify(item)).not.toContain('holderName');
    });

    it('workspace: assignee sees state, reservation and allowed actions; hidden business is 403 HIDDEN_BY_POLICY', async () => {
      const biz = await assignedBusiness();
      const ws = await call(cc, 'get', `/api/calling/businesses/${biz}/workspace`);
      expect(ws.status).toBe(200);
      expect(ws.body).toMatchObject({ businessId: biz, access: { level: 'full' }, assignment: { isMe: true }, reservation: { state: 'none' } });
      expect(ws.body.allowed).toMatchObject({ startContact: true, logAttempt: false, reopen: false });
      expect(ws.body.policy.label).toContain('Demonstration alternative');
      const old = await newBusiness(owner.id, { createdAt: new Date(Date.now() - 20 * 86_400_000) });
      await assignTo(old, cc);
      const hidden = await call(cc, 'get', `/api/calling/businesses/${old}/workspace`);
      expect(hidden.status).toBe(403);
      expect(hidden.body.code).toBe('HIDDEN_BY_POLICY');
      expect((await call(cc, 'get', `/api/calling/businesses/${randomUUID()}/workspace`)).status).toBe(404);
    });
  });
});
