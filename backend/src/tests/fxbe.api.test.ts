/**
 * FX-BE production-fix wave (2026-10-28): contract and regression tests for the backend fixes.
 * Runs against TEST_DATABASE_URL only. Each test creates its own employees/businesses.
 *
 * Covered: R3-01 meetings authorization (P0), FX-BE-C3 attendee options, F-05/F-09 notification
 * consumers (payload keys + every event), FX-BE-C1/C2 settings save contracts, FX-BE-C4 My Day work
 * list, FX-BE-C5 deal filters, FX-BE-C6 task start date, R2-12 save-after-loss, R2-11 follow-up cap,
 * R2-15 send-again bound, F-14 session cleanup + retention purge.
 */
import crypto from 'crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../app.js';
import { query, withTransaction } from '../db/pool.js';
import { config } from '../config/index.js';
import { DEV_TOTP_SECRET } from '../db/seed.js';
import { OUTBOX_EVENTS, getOutboxConsumers, outbox } from '../shared/outbox.js';
import { runSystemCommand } from '../shared/tx.js';
import { storeEnrolledSecret } from '../modules/identity/twoFactor.js';
import { clock } from '../modules/platform/clock.js';
import { relayOutboxOnce } from '../modules/platform/service.js';
import { cleanupSessions, retentionPurge } from '../modules/platform/retention.js';
import { NO_CONSUMER_EVENTS, SEND_AGAIN_MAX } from '../modules/notifications/service.js';
import { createAcceptedOpportunity, setDeliveryPolicyForTests } from '../modules/deals/service.js';
import { initCallingState } from '../modules/calls/service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';

type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';
interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  role: Role;
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

function call(a: Agent, method: 'get' | 'post' | 'patch' | 'put', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  return body ? r.send(body) : r;
}

async function makeEmployee(role: Role): Promise<{ id: string; email: string }> {
  const email = `fxbe.${role}.${uniq()}@test.invalid`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `FXBE ${role} ${uniq()}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}

async function agentFor(role: Exclude<Role, 'owner'>): Promise<Agent> {
  const e = await makeEmployee(role);
  const s = await login(e.email);
  expect(s.res.status).toBe(200);
  return { cookie: s.cookie, csrf: s.csrf, id: e.id, role };
}

async function ownerAgent(): Promise<Agent> {
  const e = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, e.id, DEV_TOTP_SECRET));
  const s = await login(e.email);
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', s.cookie)
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id: e.id, role: 'owner' };
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await query<{ n: string }>(sql, params);
  return Number(rows[0].n);
}

async function relayAll(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const r = await relayOutboxOnce();
    if (r.claimed === 0) return;
  }
}

describe.skipIf(!hasTestDb)('FX-BE production-fix wave (DB)', () => {
  let owner: Agent;
  let cc: Agent;
  let dv: Agent;
  let dv2: Agent;
  let de: Agent;

  async function newBusiness(assignee?: Agent): Promise<string> {
    const { rows } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`FXBE Biz ${uniq()}`, owner.id]);
    const id = rows[0].id;
    await runSystemCommand('test.fxbe', (ctx) => initCallingState(ctx, id));
    if (assignee) await query(`INSERT INTO calling_assignments (business_id, assignee_id, assigned_by) VALUES ($1, $2, $3)`, [id, assignee.id, owner.id]);
    return id;
  }

  async function newDeal(developer: Agent | null): Promise<{ businessId: string; dealId: string }> {
    const businessId = await newBusiness(cc);
    const { rows: a } = await query<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
      [businessId, cc.id, crypto.randomUUID()]
    );
    const r = await runSystemCommand('test.fxbe', (ctx) =>
      createAcceptedOpportunity(ctx, {
        businessId,
        callAttemptId: a[0].id,
        acceptingAgentId: cc.id,
        clientNeedsNote: 'Needs a booking portal',
        ...(developer ? { developerId: developer.id } : {}),
      })
    );
    return { businessId, dealId: r.dealId };
  }

  const future = (hours = 24) => new Date(Date.now() + hours * 3600_000).toISOString();

  beforeAll(async () => {
    owner = await ownerAgent();
    cc = await agentFor('call_center');
    dv = await agentFor('developer');
    dv2 = await agentFor('developer');
    de = await agentFor('data_entry');
  });

  afterEach(() => {
    clock.set(null);
    setDeliveryPolicyForTests({});
  });

  afterAll(() => {
    clock.set(null);
  });

  // ------------------------------------------------------------------ R3-01 (P0) meetings
  describe('meetings authorization (R3-01, P0)', () => {
    it('a Developer cannot create a deal or attach to a business through a meeting; nothing is written', async () => {
      const businessId = await newBusiness(cc);
      const res = await call(dv2, 'post', '/api/meetings', { businessId, startsAt: future(), attendeeIds: [dv2.id] });
      expect([403, 404, 422]).toContain(res.status);
      expect(await count('SELECT count(*)::text AS n FROM deals WHERE business_id = $1', [businessId])).toBe(0);
      expect(await count('SELECT count(*)::text AS n FROM call_attempts WHERE business_id = $1', [businessId])).toBe(0);
      expect(await count('SELECT count(*)::text AS n FROM meetings WHERE business_id = $1', [businessId])).toBe(0);
    });

    it('a Developer cannot attach themselves to an unassigned open deal by scheduling a meeting', async () => {
      const { dealId } = await newDeal(null);
      const res = await call(dv2, 'post', '/api/meetings', { dealId, startsAt: future(), attendeeIds: [dv2.id] });
      expect(res.status).toBe(403);
      const { rows } = await query<{ assigned_developer_id: string | null }>('SELECT assigned_developer_id FROM deals WHERE id = $1', [dealId]);
      expect(rows[0].assigned_developer_id).toBeNull();
    });

    it('a business with no open deal answers 422 NO_OPEN_DEAL for Call Center and creates nothing', async () => {
      const businessId = await newBusiness(cc);
      const res = await call(cc, 'post', '/api/meetings', { businessId, startsAt: future(), attendeeIds: [cc.id] });
      expect(res.status).toBe(422);
      expect(res.body.details?.code).toBe('NO_OPEN_DEAL');
      expect(await count('SELECT count(*)::text AS n FROM deals WHERE business_id = $1', [businessId])).toBe(0);
      expect(await count('SELECT count(*)::text AS n FROM call_attempts WHERE business_id = $1', [businessId])).toBe(0);
    });

    it('businessId resolves to the open deal; an Owner adding a Developer assigns them through the audited command', async () => {
      const { businessId, dealId } = await newDeal(null);
      const res = await call(owner, 'post', '/api/meetings', { businessId, startsAt: future(), attendeeIds: [owner.id, dv.id] });
      expect(res.status).toBe(201);
      expect(res.body.meeting.dealId).toBe(dealId);
      const { rows } = await query<{ assigned_developer_id: string | null }>('SELECT assigned_developer_id FROM deals WHERE id = $1', [dealId]);
      expect(rows[0].assigned_developer_id).toBe(dv.id);
      expect(await count(`SELECT count(*)::text AS n FROM audit_events WHERE event_name = 'deal.developer_assigned' AND entity_id = $1`, [dealId])).toBe(1);
      expect(await count(`SELECT count(*)::text AS n FROM deal_developer_assignments WHERE deal_id = $1`, [dealId])).toBe(1);
    });

    it('a mismatched businessId and dealId is 400', async () => {
      const { dealId } = await newDeal(null);
      const other = await newBusiness(cc);
      const res = await call(owner, 'post', '/api/meetings', { dealId, businessId: other, startsAt: future(), attendeeIds: [owner.id] });
      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------ FX-BE-C3 attendee options
  it('attendee options: Call Center and Developer read id/name/role of active staff; Data Entry is 403', async () => {
    for (const a of [cc, dv, owner]) {
      const r = await call(a, 'get', '/api/meetings/attendee-options?pageSize=100');
      expect(r.status).toBe(200);
      expect(r.body.items.length).toBeGreaterThan(0);
      for (const item of r.body.items) expect(Object.keys(item).sort()).toEqual(['fullName', 'id', 'role']);
    }
    const byName = await call(cc, 'get', `/api/meetings/attendee-options?q=${encodeURIComponent('FXBE developer')}&role=developer`);
    expect(byName.status).toBe(200);
    expect(byName.body.items.every((i: { role: string }) => i.role === 'developer')).toBe(true);
    expect((await call(de, 'get', '/api/meetings/attendee-options')).status).toBe(403);
    expect((await call(cc, 'get', '/api/meetings/attendee-options?email=x')).status).toBe(400);
  });

  // ------------------------------------------------------------------ notifications (F-05 / F-09)
  describe('notification consumers', () => {
    it('every outbox event has a consumer or a documented NO_CONSUMER reason', () => {
      const consumed = new Set(getOutboxConsumers().flatMap((c) => c.events));
      const missing = OUTBOX_EVENTS.filter((e) => !consumed.has(e) && !(e in NO_CONSUMER_EVENTS));
      expect(missing).toEqual([]);
    });

    async function emitAndRelay(name: (typeof OUTBOX_EVENTS)[number], aggregateType: string, aggregateId: string, payload: Record<string, string | null>) {
      await runSystemCommand('test.fxbe', (ctx) => outbox.emit(ctx.tx, { name, aggregateType, aggregateId, payload }));
      await relayAll();
    }

    it('calling assignment (assigneeId) and reservation override (holderId) reach the agent as sent in-app notices', async () => {
      const businessId = await newBusiness();
      await emitAndRelay('calling_assignment.assigned', 'calling_assignment', businessId, { businessId, assigneeId: cc.id });
      expect(
        await count(`SELECT count(*)::text AS n FROM notification_deliveries WHERE recipient_id = $1 AND template = 'business.assignment' AND source_id = $2 AND state = 'sent'`, [cc.id, businessId])
      ).toBe(1);
      const resId = crypto.randomUUID();
      await emitAndRelay('contact_reservation.overridden', 'contact_reservation', resId, { businessId, holderId: cc.id });
      expect(
        await count(`SELECT count(*)::text AS n FROM notification_deliveries WHERE recipient_id = $1 AND template = 'business.reservation_overridden' AND source_id = $2`, [cc.id, resId])
      ).toBe(1);
      const list = await call(cc, 'get', '/api/notifications');
      expect(list.status).toBe(200);
      expect(list.body.items.some((i: { template: string }) => i.template === 'business.assignment')).toBe(true);
    });

    it('closure rejected reaches the assigned Developer; provisioning failure reaches the Owners', async () => {
      const { dealId } = await newDeal(dv);
      await emitAndRelay('deal.closure_rejected', 'deal', dealId, { dealId, reviewId: null });
      expect(await count(`SELECT count(*)::text AS n FROM notification_deliveries WHERE recipient_id = $1 AND template = 'business.deal_closure_rejected' AND source_id = $2`, [dv.id, dealId])).toBe(1);
      await emitAndRelay('project.provisioning_failed', 'deal', dealId, { dealId });
      expect(await count(`SELECT count(*)::text AS n FROM notification_deliveries WHERE recipient_id = $1 AND template = 'business.provisioning_failed' AND source_id = $2`, [owner.id, dealId])).toBe(1);
    });

    it('send again: only failed rows, at most SEND_AGAIN_MAX times, each audited; sent rows are 409', async () => {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO notification_deliveries (dedupe_key, family, template, channel, recipient_id, state, next_attempt_at)
         VALUES ($1, 'business', 'business.assignment', 'email', $2, 'sent', now()) RETURNING id`,
        [`fxbe:${uniq()}`, cc.id]
      );
      const id = rows[0].id;
      expect((await call(owner, 'post', `/api/delivery-monitor/reminders/${id}/send-again`, {})).status).toBe(409);
      for (let i = 0; i < SEND_AGAIN_MAX; i++) {
        await query(`UPDATE notification_deliveries SET state = 'failed' WHERE id = $1`, [id]);
        expect((await call(owner, 'post', `/api/delivery-monitor/reminders/${id}/send-again`, {})).status).toBe(200);
      }
      await query(`UPDATE notification_deliveries SET state = 'failed' WHERE id = $1`, [id]);
      const over = await call(owner, 'post', `/api/delivery-monitor/reminders/${id}/send-again`, {});
      expect(over.status).toBe(409);
      expect(await count(`SELECT count(*)::text AS n FROM audit_events WHERE event_name = 'notification.send_again_requested' AND entity_id = $1`, [id])).toBe(SEND_AGAIN_MAX);
    });
  });

  // ------------------------------------------------------------------ settings contracts
  describe('settings save contracts (FX-BE-C1, C2)', () => {
    it('attendance PUT accepts lowercase days and keeps omitted fields (no wipe)', async () => {
      const before = await call(owner, 'get', '/api/attendance/settings');
      expect(before.status).toBe(200);
      const cur = before.body.current;
      const version: number = before.body.versionNo ?? before.body.current?.versionNo ?? before.body.version ?? 0;
      const full = {
        timezone: cur.timezone || 'Asia/Beirut',
        workingDays: cur.workingDays?.length ? cur.workingDays : ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        shiftStart: cur.shiftStart || '09:00',
        shiftEnd: cur.shiftEnd || '18:00',
        graceMinutes: cur.graceMinutes ?? 10,
        verificationMode: cur.verificationMode === 'ip' && !(cur.officeIps ?? []).length ? 'disabled' : cur.verificationMode || 'disabled',
        officeIps: cur.officeIps ?? [],
        holidays: ['2026-12-25'],
        summaryRequired: true,
        summaryMinLength: 7,
        missingCheckoutFlagHours: 9,
      };
      const seeded = await call(owner, 'put', '/api/attendance/settings', { version, ...full, reason: 'fxbe seed' });
      expect(seeded.status).toBe(200);
      const v2 = await call(owner, 'get', '/api/attendance/settings');
      const version2: number = v2.body.versionNo ?? v2.body.current?.versionNo ?? v2.body.version;
      const partial = await call(owner, 'put', '/api/attendance/settings', { version: version2, workingDays: ['mon', 'Tuesday', 'wed'] });
      expect(partial.status).toBe(200);
      const after = await call(owner, 'get', '/api/attendance/settings');
      expect(after.body.current.workingDays).toEqual(['MON', 'TUE', 'WED']);
      expect(after.body.current.holidays).toEqual(['2026-12-25']);
      expect(after.body.current.summaryRequired).toBe(true);
      expect(after.body.current.summaryMinLength).toBe(7);
      expect(after.body.current.missingCheckoutFlagHours).toBe(9);
      // Restore the original values for the other suites.
      const version3: number = after.body.versionNo ?? after.body.current?.versionNo ?? after.body.version;
      const restore = await call(owner, 'put', '/api/attendance/settings', {
        version: version3,
        ...full,
        workingDays: full.workingDays,
        holidays: cur.holidays ?? [],
        summaryRequired: cur.summaryRequired ?? true,
        summaryMinLength: cur.summaryMinLength ?? 10,
        missingCheckoutFlagHours: cur.missingCheckoutFlagHours ?? 6,
        reason: 'fxbe restore',
      });
      expect(restore.status).toBe(200);
    });

    it('company.name saves through PATCH /api/settings and is public', async () => {
      const cur = await call(owner, 'get', '/api/settings');
      const saved = await call(owner, 'patch', '/api/settings', { version: cur.body.version, company: { 'company.name': 'Udigity FXBE' } });
      expect(saved.status).toBe(200);
      expect(saved.body.company['company.name']).toBe('Udigity FXBE');
      const pub = await call(cc, 'get', '/api/settings/public');
      expect(pub.body.company['company.name']).toBe('Udigity FXBE');
      const bad = await call(owner, 'patch', '/api/settings', { version: saved.body.version, company: { 'company.name': 'x'.repeat(121) } });
      expect(bad.status).toBe(400);
      const reset = await call(owner, 'patch', '/api/settings', { version: saved.body.version, company: { 'company.name': null } });
      expect(reset.status).toBe(200);
    });
  });

  // ------------------------------------------------------------------ My Day work list
  it('My Day work list: limit + state=open, row fields, business name only when readable', async () => {
    const readable = await newBusiness(cc);
    const { rows: hidden } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by, created_at) VALUES ($1, $2, now() - interval '400 days') RETURNING id`, [`FXBE Hidden ${uniq()}`, owner.id]);
    for (const [title, sourceId] of [['Call the gym', readable], ['Hidden one', hidden[0].id]] as const) {
      const r = await call(owner, 'post', '/api/work-items', { assigneeId: cc.id, title, sourceType: 'business', sourceId, dueDate: '2026-01-01' });
      expect(r.status).toBe(201);
    }
    const res = await call(cc, 'get', '/api/work-items?limit=5&state=open');
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(5);
    const byTitle = new Map<string, Record<string, unknown>>(res.body.items.map((i: Record<string, unknown>) => [i.title as string, i]));
    const shown = byTitle.get('Call the gym')!;
    expect(shown.businessId).toBe(readable);
    expect(String(shown.businessName)).toMatch(/^FXBE Biz/);
    expect(shown.kind).toBe('new_assignment');
    expect(shown.statusLabel).toBe('Overdue');
    expect(shown.dueAt).toBe('2026-01-01');
    const masked = byTitle.get('Hidden one')!;
    expect(masked.businessId).toBeNull();
    expect(masked.businessName).toBe('Hidden one');
    expect((await call(cc, 'get', '/api/work-items?bogus=1')).status).toBe(400);
    expect((await call(cc, 'get', '/api/targets?employeeId=not-a-uuid')).status).toBe(400);
  });

  // ------------------------------------------------------------------ deals filters + task start date
  it('deal list filters q and projectStatus (FX-BE-C5)', async () => {
    const { dealId } = await newDeal(dv);
    const { rows } = await query<{ code: string }>('SELECT code FROM deals WHERE id = $1', [dealId]);
    const byCode = await call(owner, 'get', `/api/deals?q=${encodeURIComponent(rows[0].code)}`);
    expect(byCode.status).toBe(200);
    expect(byCode.body.items.map((d: { id: string }) => d.id)).toContain(dealId);
    expect(byCode.body.total).toBe(byCode.body.items.length);
    const none = await call(owner, 'get', `/api/deals?q=${encodeURIComponent(rows[0].code)}&projectStatus=none`);
    expect(none.body.items.map((d: { id: string }) => d.id)).toContain(dealId);
    const delivered = await call(owner, 'get', `/api/deals?q=${encodeURIComponent(rows[0].code)}&projectStatus=delivered`);
    expect(delivered.body.items).toEqual([]);
    expect((await call(owner, 'get', '/api/deals?projectStatus=bogus')).status).toBe(400);
  });

  it('task startDate is stored, returned and must not follow the due date (FX-BE-C6)', async () => {
    setDeliveryPolicyForTests({ closureMode: 'direct' });
    const { dealId } = await newDeal(dv);
    const v = async () => (await query<{ version: number }>('SELECT version FROM deals WHERE id = $1', [dealId])).rows[0].version;
    expect((await call(dv, 'post', `/api/deals/${dealId}/payment`, { version: await v(), date: '2026-10-20', reference: 'PAY-1' })).status).toBe(200);
    expect((await call(dv, 'post', `/api/deals/${dealId}/signature`, { version: await v(), date: '2026-10-21', reference: 'AGR-1' })).status).toBe(200);
    expect((await call(dv, 'post', `/api/deals/${dealId}/finalize`, { version: await v() })).status).toBe(200);
    await relayAll();
    const { rows } = await query<{ id: string }>('SELECT id FROM projects WHERE deal_id = $1', [dealId]);
    expect(rows).toHaveLength(1);
    const created = await call(owner, 'post', '/api/tasks', { projectId: rows[0].id, title: 'Upload photos', startDate: '2026-11-02', dueDate: '2026-11-05' });
    expect(created.status).toBe(201);
    expect(created.body.task.startDate).toBe('2026-11-02');
    const badCreate = await call(owner, 'post', '/api/tasks', { projectId: rows[0].id, title: 'Bad', startDate: '2026-11-09', dueDate: '2026-11-05' });
    expect(badCreate.status).toBe(400);
    const badPatch = await call(owner, 'patch', `/api/tasks/${created.body.task.id}`, { version: created.body.task.version, startDate: '2026-11-30' });
    expect(badPatch.status).toBe(400);
    const okPatch = await call(owner, 'patch', `/api/tasks/${created.body.task.id}`, { version: created.body.task.version, startDate: null });
    expect(okPatch.status).toBe(200);
    expect(okPatch.body.task.startDate).toBeNull();
  });

  // ------------------------------------------------------------------ calling P2s
  it('R2-12: a caller who never held the reservation cannot save an attempt (409 RESERVATION_LOST)', async () => {
    const businessId = await newBusiness(cc);
    const { rows } = await query<{ version: number }>('SELECT version FROM business_calling_states WHERE business_id = $1', [businessId]);
    const res = await call(cc, 'post', '/api/calling/attempts', {
      businessId,
      reservationId: crypto.randomUUID(),
      leaseToken: crypto.randomUUID(),
      stateVersion: rows[0].version,
      outcome: 'on_hold',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RESERVATION_LOST');
    expect(await count('SELECT count(*)::text AS n FROM call_attempts WHERE business_id = $1', [businessId])).toBe(0);
  });

  it('R2-11: a follow-up more than followUps.maxScheduleDays ahead is 400', async () => {
    const businessId = await newBusiness(cc);
    const far = await call(cc, 'post', '/api/follow-ups', { businessId, scheduledFor: new Date(Date.now() + 200 * 86_400_000).toISOString() });
    expect(far.status).toBe(400);
    expect(JSON.stringify(far.body.details)).toMatch(/within 90 days/);
  });

  // ------------------------------------------------------------------ F-14 jobs
  it('J-06 ends expired sessions and deletes old ended ones; J-12 purges old operational rows only', async () => {
    const e = await makeEmployee('data_entry');
    const old = new Date(Date.now() - 400 * 86_400_000);
    const { rows: s } = await query<{ id: string }>(
      `INSERT INTO sessions (employee_id, role, expires_at, state, token_hash, created_at)
       VALUES ($1, 'data_entry', now() - interval '1 hour', 'active', $2, now() - interval '2 hours') RETURNING id`,
      [e.id, crypto.randomBytes(32).toString('hex')]
    );
    const { rows: oldS } = await query<{ id: string }>(
      `INSERT INTO sessions (employee_id, role, expires_at, state, ended_at, end_reason, token_hash, created_at)
       VALUES ($1, 'data_entry', $2, 'ended', $2, 'logout', $3, $2) RETURNING id`,
      [e.id, old, crypto.randomBytes(32).toString('hex')]
    );
    const r1 = await withTransaction((tx) => cleanupSessions(tx, new Date()));
    expect(r1.ended.absolute).toBeGreaterThanOrEqual(1);
    const { rows: after } = await query<{ state: string; end_reason: string }>('SELECT state, end_reason FROM sessions WHERE id = $1', [s[0].id]);
    expect(after[0]).toEqual({ state: 'ended', end_reason: 'absolute_expired' });
    expect(await count('SELECT count(*)::text AS n FROM sessions WHERE id = $1', [oldS[0].id])).toBe(0);

    const { rows: ev } = await query<{ id: string }>(
      `INSERT INTO outbox_events (name, aggregate_type, aggregate_id, payload, state, created_at)
       VALUES ('call_outcome.changed', 'business', $1, '{}'::jsonb, 'done', $2) RETURNING id`,
      [crypto.randomUUID(), old]
    );
    const { rows: fresh } = await query<{ id: string }>(
      `INSERT INTO outbox_events (name, aggregate_type, aggregate_id, payload, state) VALUES ('call_outcome.changed', 'business', $1, '{}'::jsonb, 'done') RETURNING id`,
      [crypto.randomUUID()]
    );
    const r2 = await withTransaction((tx) => retentionPurge(tx, new Date()));
    expect(r2.outboxEvents).toBeGreaterThanOrEqual(1);
    expect(await count('SELECT count(*)::text AS n FROM outbox_events WHERE id = $1', [ev[0].id])).toBe(0);
    expect(await count('SELECT count(*)::text AS n FROM outbox_events WHERE id = $1', [fresh[0].id])).toBe(1);
    // Audit rows are never purged.
    expect(await count('SELECT count(*)::text AS n FROM audit_events', [])).toBeGreaterThan(0);
  });
});
