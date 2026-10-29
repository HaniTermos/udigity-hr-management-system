/**
 * MOD-notifications end to end (TEST_DATABASE_URL only): for a representative set of D18 events, the real
 * producer (HTTP route) → J-03 relay (→ J-01 reminder dispatch where the event is a reminder) → the
 * recipient's GET /api/notifications lists a plain-English title + message + app link, the unread count
 * goes up, and mark-read / mark-all-read work. Every assertion is scoped to this run's own rows (by
 * recipient + source id), so a reused DB with a backlog from other files still passes.
 */
import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { runSystemCommand } from '../../shared/tx.js';
import { storeEnrolledSecret } from '../identity/twoFactor.js';
import { initCallingState } from '../calls/service.js';
import { createAcceptedOpportunity } from '../deals/service.js';
import { relayOutboxOnce } from '../platform/service.js';
import { dispatchDueReminders } from './service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
}
interface Item {
  id: string;
  template: string;
  sourceType: string | null;
  sourceId: string | null;
  readAt: string | null;
  title: string;
  message: string;
  link?: string;
}

const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
const rnd7 = () => String(Math.floor(1_000_000 + Math.random() * 8_999_999));

function cookieFrom(res: request.Response): string {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
}

async function login(email: string) {
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  return { res, cookie: cookieFrom(res), csrf: res.body.csrfToken as string };
}

function call(a: Agent, method: 'get' | 'post', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  return body ? r.send(body) : r;
}

async function makeEmployee(role: Role): Promise<{ id: string; email: string }> {
  const email = `ntf.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(`INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`, [
    email,
    `Ntf ${role}`,
    role,
  ]);
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}

async function agentFor(role: Exclude<Role, 'owner'>): Promise<Agent> {
  const e = await makeEmployee(role);
  const s = await login(e.email);
  expect(s.res.status).toBe(200);
  return { cookie: s.cookie, csrf: s.csrf, id: e.id };
}

/** A fresh Owner with an enrolled TOTP factor and a verified session. */
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
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id: e.id };
}

/** Relay / dispatch until nothing due is left (drains any backlog of the shared test DB). */
async function relayAll(): Promise<void> {
  for (let i = 0; i < 200; i++) if ((await relayOutboxOnce()).claimed === 0) return;
}
async function remindAll(): Promise<void> {
  for (let i = 0; i < 100; i++) if ((await dispatchDueReminders()).claimed === 0) return;
}

async function unread(a: Agent): Promise<number> {
  const r = await call(a, 'get', '/api/notifications/unread-count');
  expect(r.status).toBe(200);
  return r.body.unreadCount as number;
}

/** The recipient's inbox item for (template, sourceId), paging through the list (newest first). */
async function findItem(a: Agent, template: string, sourceId: string): Promise<Item> {
  for (let page = 1; page <= 20; page++) {
    const r = await call(a, 'get', `/api/notifications?page=${page}&pageSize=100`);
    expect(r.status).toBe(200);
    const items = r.body.items as Item[];
    const hit = items.find((i) => i.template === template && i.sourceId === sourceId);
    if (hit) return hit;
    if (items.length < 100) break;
  }
  throw new Error(`No ${template} notification for source ${sourceId}`);
}

/** Shared expectations: plain-English text (no template ids / jargon), an app link, unread, then mark read. */
async function expectReadable(a: Agent, item: Item, link: string | RegExp, title: string | RegExp): Promise<void> {
  if (typeof title === 'string') expect(item.title).toBe(title);
  else expect(item.title).toMatch(title);
  expect(item.message.length).toBeGreaterThan(10);
  for (const text of [item.title, item.message]) expect(text).not.toMatch(/\b(business|security)\.[a-z]|_|outbox|\bE-\d|template/i);
  if (typeof link === 'string') expect(item.link).toBe(link);
  else expect(item.link).toMatch(link);
  expect(item.readAt).toBeNull();
  const unreadList = await call(a, 'get', '/api/notifications?unreadOnly=true&pageSize=100');
  expect((unreadList.body.items as Item[]).some((i) => i.id === item.id)).toBe(true);

  const before = await unread(a);
  const mark = await call(a, 'post', `/api/notifications/${item.id}/read`);
  expect(mark.status).toBe(200);
  expect(await unread(a)).toBe(before - 1);
  const after = await call(a, 'get', '/api/notifications?unreadOnly=true&pageSize=100');
  expect((after.body.items as Item[]).some((i) => i.id === item.id)).toBe(false);
}

describe.skipIf(!hasTestDb)('notifications end to end: producer → relay → inbox (DB)', { timeout: 60_000 }, () => {
  let owner: Agent;
  let de: Agent;
  let cc: Agent;
  let dv: Agent;

  /** A business with one phone (calling eligibility needs a phone). */
  async function newBusiness(createdBy: string, phone = `7${rnd7()}`): Promise<string> {
    return withTransaction(async (tx) => {
      const name = `Ntf Biz ${uniq()}`;
      const { rows } = await tx.query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [name, createdBy]);
      await initCallingState(tx, rows[0].id);
      {
        await tx.query(`INSERT INTO business_phones (business_id, country_code, number, normalized_phone) VALUES ($1, '+961', $2, $3)`, [
          rows[0].id,
          phone,
          `+961${phone}`,
        ]);
      }
      return rows[0].id;
    });
  }

  /** Business assigned to `cc`, an accepted attempt and its deal (no Developer yet), as MOD-calls does. */
  async function newDeal(): Promise<{ businessId: string; dealId: string }> {
    const businessId = await newBusiness(de.id);
    await query(`INSERT INTO calling_assignments (business_id, assignee_id, assigned_by) VALUES ($1, $2, $3)`, [businessId, cc.id, owner.id]);
    const { rows: a } = await query<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
      [businessId, cc.id, crypto.randomUUID()]
    );
    const r = await runSystemCommand('test.ntf_accept', (ctx) =>
      createAcceptedOpportunity(ctx, { businessId, callAttemptId: a[0].id, acceptingAgentId: cc.id, clientNeedsNote: 'Needs a website' })
    );
    return { businessId, dealId: r.dealId };
  }

  const dealVersion = async (id: string) => (await query<{ version: number }>('SELECT version FROM deals WHERE id = $1', [id])).rows[0].version;
  const dealCmd = async (a: Agent, id: string, verb: string, body: object = {}) =>
    call(a, 'post', `/api/deals/${id}/${verb}`, { version: await dealVersion(id), ...body });

  beforeAll(async () => {
    owner = await ownerAgent();
    de = await agentFor('data_entry');
    cc = await agentFor('call_center');
    dv = await agentFor('developer');
    await relayAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('calling assignment → the assigned agent', async () => {
    const businessId = await newBusiness(de.id);
    const before = await unread(cc);
    const r = await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [businessId], assigneeId: cc.id });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const assignmentId = r.body.assigned[0].id as string;
    await relayAll();
    expect(await unread(cc)).toBe(before + 1);
    const item = await findItem(cc, 'business.assignment', assignmentId);
    await expectReadable(cc, item, '/queue', 'New Calling Assignment');
  });

  it('developer handoff → the assigned Developer, linked to the deal', async () => {
    const { dealId } = await newDeal();
    const before = await unread(dv);
    const r = await dealCmd(owner, dealId, 'developer', { developerId: dv.id });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    await relayAll();
    expect(await unread(dv)).toBe(before + 1);
    const item = await findItem(dv, 'business.developer_handoff', dealId);
    await expectReadable(dv, item, `/deals/${dealId}`, 'Opportunity Assigned to You');
  });

  it('follow-up due (15 min before) → the responsible agent, via the J-01 reminder', async () => {
    const businessId = await newBusiness(de.id);
    const a = await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [businessId], assigneeId: cc.id });
    expect(a.status).toBe(200);
    const scheduledFor = new Date(Date.now() + 10 * 60_000).toISOString(); // inside the 15-min lead: reminded now
    const fu = await call(cc, 'post', '/api/follow-ups', { businessId, scheduledFor });
    expect(fu.status, JSON.stringify(fu.body)).toBe(201);
    const followUpId = (fu.body.followUp?.id ?? fu.body.id) as string;
    expect(followUpId).toBeTruthy();
    await relayAll();
    await remindAll();
    const item = await findItem(cc, 'business.follow_up_reminder', followUpId);
    expect(item.message).toMatch(/^You have a follow-up call due in (9|10) minutes\.$/);
    await expectReadable(cc, item, '/calendar', 'Follow-up Due');
  });

  it('meeting reminder → the deal Developer (late 24 h reminder sent at once, with the real time left)', async () => {
    const { dealId } = await newDeal();
    expect((await dealCmd(owner, dealId, 'developer', { developerId: dv.id })).status).toBe(200);
    const startsAt = new Date(Date.now() + 3 * 3600_000).toISOString();
    const m = await call(dv, 'post', '/api/meetings', { dealId, title: 'Discovery', startsAt, attendeeIds: [dv.id] });
    expect(m.status, JSON.stringify(m.body)).toBe(201);
    const meetingId = (m.body.meeting?.id ?? m.body.id) as string;
    await relayAll();
    await remindAll();
    const item = await findItem(dv, 'business.meeting_reminder', meetingId);
    expect(item.message).toBe('An upcoming commercial discovery meeting starts in 3 hours.');
    await expectReadable(dv, item, '/meetings', 'Meeting Reminder');
  });

  it('data correction request → the business creator (Data Entry) and the Owners, never the requester', async () => {
    const businessId = await newBusiness(de.id);
    expect((await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [businessId], assigneeId: cc.id })).status).toBe(200);
    const r = await call(cc, 'post', '/api/correction-requests', { businessId, issueType: 'Incorrect phone', description: 'The phone number is out of service' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const requestId = (r.body.id ?? r.body.request?.id) as string;
    await relayAll();
    for (const a of [owner, de]) {
      const item = await findItem(a, 'business.correction_request', requestId);
      await expectReadable(a, item, '/corrections', 'New Correction Request');
    }
    const { rows } = await query(`SELECT 1 FROM notification_deliveries WHERE recipient_id = $1 AND source_id = $2`, [cc.id, requestId]);
    expect(rows).toHaveLength(0);
  });

  it('attendance correction request → the Owners, linked to the review queue', async () => {
    const day = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const r = await call(dv, 'post', '/api/attendance/corrections', {
      proposedCheckInAt: `${day}T06:00:00Z`,
      proposedCheckOutAt: `${day}T15:00:00Z`,
      reason: 'Forgot to check in that day',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    await relayAll();
    const item = await findItem(owner, 'business.attendance_review', r.body.id as string);
    await expectReadable(owner, item, '/attendance/corrections', 'Attendance Correction Request');
  });

  it('deal closure requested → the Owners, linked to the deal', async () => {
    const { dealId } = await newDeal();
    expect((await dealCmd(owner, dealId, 'developer', { developerId: dv.id })).status).toBe(200);
    expect((await dealCmd(dv, dealId, 'payment', { date: '2026-10-20', reference: 'PAY-1' })).status).toBe(200);
    expect((await dealCmd(dv, dealId, 'signature', { reference: 'AGR-1' })).status).toBe(200);
    const r = await dealCmd(dv, dealId, 'closure-request', { note: 'Paid and signed' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    await relayAll();
    const item = await findItem(owner, 'business.deal_closure', dealId);
    await expectReadable(owner, item, `/deals/${dealId}`, 'Deal Closure Requested');
  });

  it('duplicate review request → the Owners, linked to the existing business', async () => {
    const number = `7${rnd7()}`;
    const existing = await newBusiness(owner.id, number);
    const r = await call(de, 'post', '/api/businesses/duplicate-review-requests', { phones: [{ countryCode: '+961', number }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    await relayAll();
    const item = await findItem(owner, 'business.duplicate_review', existing);
    await expectReadable(owner, item, `/businesses/${existing}`, 'Duplicate Review Requested');
  });

  it('mark all as read clears the unread count', async () => {
    const businessId = await newBusiness(de.id);
    expect((await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [businessId], assigneeId: cc.id })).status).toBe(200);
    await relayAll();
    expect(await unread(cc)).toBeGreaterThan(0);
    const r = await call(cc, 'post', '/api/notifications/read-all');
    expect(r.status).toBe(200);
    expect(r.body.markedCount).toBeGreaterThan(0);
    expect(await unread(cc)).toBe(0);
  });
});
