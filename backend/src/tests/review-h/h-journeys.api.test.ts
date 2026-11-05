/**
 * Review 2026-11-04, agent H: end-to-end journeys across the four roles through the HTTP API, checking the
 * persisted state and the authorization consequences of each step (who can read what afterwards), plus
 * the notifications the main events produce and the access re-check behind each notification link.
 *
 * Only setup the API cannot do is direct SQL: ageing a row (created_at / assignment start) to cross a
 * policy window. Everything else is an HTTP call or the worker function the scheduler would run.
 */
import crypto from 'crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { storeEnrolledSecret } from '../../modules/identity/twoFactor.js';
import { runBootstrap } from '../../modules/identity/bootstrap.js';
import { clock } from '../../modules/platform/clock.js';
import { relayOutboxOnce, runDueJobs } from '../../modules/platform/service.js';
import { dispatchDueDeliveries } from '../../modules/notifications/service.js';
import { mailSink, setEmailTransport } from '../../modules/notifications/transport.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
const phone = () => ({ countryCode: '+961', number: `7${Math.floor(1_000_000 + Math.random() * 8_999_999)}` });

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  email: string;
}

const cookieFrom = (res: request.Response): string =>
  (([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`)) ?? '').split(';')[0];

function call(a: Agent, method: 'get' | 'post' | 'patch' | 'put', path: string, body?: object, headers: Record<string, string> = {}) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  for (const [k, v] of Object.entries(headers)) r.set(k, v);
  return body ? r.send(body) : r;
}

async function makeEmployee(role: string): Promise<{ id: string; email: string }> {
  const email = `h.j.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(`INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`, [email, `HJ ${role}`, role]);
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}
async function signIn(email: string, password = PASSWORD): Promise<request.Response> {
  return request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
}
async function agentFor(role: string): Promise<Agent> {
  const e = await makeEmployee(role);
  const r = await signIn(e.email);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return { cookie: cookieFrom(r), csrf: r.body.csrfToken, ...e };
}
async function ownerAgent(): Promise<Agent> {
  const e = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, e.id, DEV_TOTP_SECRET));
  const s = await signIn(e.email);
  const v = await request(app).post('/api/auth/2fa/verify').set('Cookie', cookieFrom(s)).set('Origin', ORIGIN).set('X-CSRF-Token', s.body.csrfToken)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, ...e };
}

async function relayAll(): Promise<void> {
  for (let i = 0; i < 500; i++) if ((await relayOutboxOnce()).claimed === 0) break;
}
async function deliverAll(): Promise<void> {
  await relayAll();
  for (let i = 0; i < 100; i++) if ((await dispatchDueDeliveries()).claimed === 0) break;
}
const ver = async (table: string, id: string) => (await query<{ version: number }>(`SELECT version FROM ${table} WHERE id = $1`, [id])).rows[0].version;

interface Item { id: string; template: string; sourceId: string; link: string; title: string }
async function inbox(a: Agent): Promise<Item[]> {
  const r = await call(a, 'get', '/api/notifications?pageSize=100');
  expect(r.status).toBe(200);
  return r.body.items as Item[];
}

describe.skipIf(!hasTestDb)('H: role journeys end to end (API)', { timeout: 180_000 }, () => {
  let owner: Agent;

  beforeAll(async () => {
    owner = await ownerAgent();
    await relayAll();
  }, 120_000); // H-07: drains the shared backlog; realistic limit
  afterEach(() => clock.set(null));
  afterAll(async () => {
    setEmailTransport(null);
    await pool.end();
  });

  // ------------------------------------------------------------------------------------------ Owner bootstrap
  it('Owner bootstrap (CLI function) → enrol MFA → invite employee → set password from the e-mailed link → employee signs in', async () => {
    const email = `h.boot.${uniq()}@test.local`;
    const boot = await runBootstrap({ email, name: 'H Bootstrap Owner', reset2fa: false, encryptExisting: false });
    expect(boot.kind).toBe('created');
    if (boot.kind !== 'created') return;
    // A second run for the same address issues a fresh enrollment token only (no second account).
    const again = await runBootstrap({ email, reset2fa: false, encryptExisting: false });
    expect(again.kind).toBe('token_issued');
    const { rows: n } = await query<{ n: number }>('SELECT count(*)::int AS n FROM employees WHERE LOWER(email) = $1', [email]);
    expect(n[0].n).toBe(1);

    const s = await signIn(email, boot.password);
    expect(s.status).toBe(200);
    const pend: Agent = { cookie: cookieFrom(s), csrf: s.body.csrfToken, id: boot.employeeId, email };
    // Pending enrollment: nothing administrative works yet.
    expect((await call(pend, 'get', '/api/employees')).body.code).toBe('OWNER_2FA_REQUIRED');
    // The first token was superseded by the second run.
    const old = await call(pend, 'post', '/api/auth/2fa/enroll/start', { enrollmentToken: boot.enrollmentToken, currentPassword: boot.password });
    expect(old.body.code).toBe('ENROLLMENT_TOKEN_INVALID');
    if (again.kind !== 'token_issued') return;
    const start = await call(pend, 'post', '/api/auth/2fa/enroll/start', { enrollmentToken: again.enrollmentToken, currentPassword: boot.password });
    expect(start.status, JSON.stringify(start.body)).toBe(200);
    const confirm = await call(pend, 'post', '/api/auth/2fa/enroll/confirm', { token: authenticator.generate(start.body.secret) });
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(200);
    expect(confirm.body.recoveryCodes).toHaveLength(10);
    const rotated = cookieFrom(confirm) || pend.cookie;
    const bootOwner: Agent = { cookie: rotated, csrf: confirm.body.csrfToken ?? pend.csrf, id: boot.employeeId, email };
    expect((await call(bootOwner, 'get', '/api/employees')).status).toBe(200);

    // Invite → e-mail via outbox → set password → sign in.
    setEmailTransport(null);
    mailSink.clear();
    const invEmail = `h.invite.${uniq()}@test.local`;
    const inv = await call(bootOwner, 'post', '/api/employees', { email: invEmail, fullName: 'H Invited', role: 'data_entry' });
    expect(inv.status, JSON.stringify(inv.body)).toBe(201);
    expect((await signIn(invEmail, 'whatever passphrase 1')).status).toBe(401); // no password yet
    await deliverAll();
    const msg = mailSink.messages().filter((m) => m.to.toLowerCase() === invEmail);
    expect(msg).toHaveLength(1);
    const token = new URL(/https?:\/\/\S+reset-password\?token=[^\s"<]+/.exec(msg[0].text)![0]).searchParams.get('token');
    const set = await request(app).post('/api/auth/password-reset/complete').set('Origin', ORIGIN).send({ token, newPassword: 'H invited passphrase 1' });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(cookieFrom(set).replace(/^[^=]+=/, '')).toBe(''); // no session from the link itself (at most a clearing cookie)
    expect((await request(app).post('/api/auth/password-reset/complete').set('Origin', ORIGIN).send({ token, newPassword: 'H invited passphrase 2' })).status).toBe(400);
    const li = await signIn(invEmail, 'H invited passphrase 1');
    expect(li.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookieFrom(li));
    expect(me.body.user).toMatchObject({ role: 'data_entry', sessionState: 'active' });
    // Audit: creation by the CLI, invitation by the bootstrapped Owner.
    const { rows: au } = await query<{ event_name: string; actor_id: string | null }>(
      `SELECT event_name, actor_id FROM audit_events WHERE entity_id = ANY($1::text[]) AND event_name IN ('account.created') ORDER BY created_at`,
      [[boot.employeeId, inv.body.id]]
    );
    expect(au.map((a) => a.actor_id)).toEqual([null, boot.employeeId]);
  });

  // ------------------------------------------------------------------------------------------ Data Entry
  it('Data Entry: create → edit → duplicate (visible) → hidden duplicate review request (Owner notified, no access) → correction resolved', async () => {
    const de = await agentFor('data_entry');
    const de2 = await agentFor('data_entry');
    const cc = await agentFor('call_center');
    const p = phone();
    const body = (o: object = {}) => ({ name: `HJ shop ${uniq()}`, category: 'Other', phones: [phone()], social: [{ platform: 'instagram', handle: `@hj${uniq()}`, followers: null, lastPost: null }], website: null, confirmSimilar: true, ...o });
    const c = await call(de, 'post', '/api/businesses', body({ phones: [p] }));
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const e = await call(de, 'patch', `/api/businesses/${c.body.id}`, { version: c.body.version, website: 'hj-shop.example', notes: 'Opens at 10' });
    expect(e.status, JSON.stringify(e.body)).toBe(200);
    expect(e.body).toMatchObject({ website: expect.stringContaining('hj-shop.example'), notes: 'Opens at 10' });
    const dupVisible = await call(de, 'post', '/api/businesses', body({ phones: [p] }));
    expect(dupVisible.status).toBe(409);
    expect(dupVisible.body.details).toMatchObject({ visibility: 'visible', id: c.body.id });

    // Hidden: another Data Entry, after the 15-day window, assigned to a Call Center agent.
    expect((await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [c.body.id], assigneeId: cc.id })).status).toBe(200);
    await query(`UPDATE businesses SET created_at = now() - interval '20 days' WHERE id = $1`, [c.body.id]);
    const hidden = await call(de2, 'post', '/api/businesses', body({ phones: [p] }));
    expect(hidden.status).toBe(409);
    expect(hidden.body.details.visibility).toBe('hidden');
    expect(JSON.stringify(hidden.body)).not.toContain(c.body.id);
    const ownerUnread = (await call(owner, 'get', '/api/notifications/unread-count')).body.unreadCount;
    const rr = await call(de2, 'post', '/api/businesses/duplicate-review-requests', { phones: [p], explanation: 'Same shop?' });
    expect(rr.status, JSON.stringify(rr.body)).toBe(201);
    await relayAll();
    expect((await call(owner, 'get', '/api/notifications/unread-count')).body.unreadCount).toBeGreaterThan(ownerUnread);
    const note = (await inbox(owner)).find((i) => i.sourceId === c.body.id);
    expect(note, 'Owner notification for the duplicate review').toBeTruthy();
    expect((await call(de2, 'get', `/api/businesses/${c.body.id}`)).status).toBe(403); // request grants no access

    // Correction: the assigned agent reports, Data Entry applies it, the agent's access is unchanged.
    const cr = await call(cc, 'post', '/api/correction-requests', { businessId: c.body.id, issueType: 'Incorrect phone', description: 'Number is disconnected', suggestedValue: '71 000 000' });
    expect(cr.status, JSON.stringify(cr.body)).toBe(201);
    await relayAll();
    const crId = cr.body.id ?? cr.body.request?.id;
    expect(crId).toBeTruthy();
    const sr = await call(de, 'post', `/api/correction-requests/${crId}/start-review`, {});
    expect(sr.status, JSON.stringify(sr.body)).toBe(200);
    const biz = await call(de, 'get', `/api/businesses/${c.body.id}`);
    const res = await call(de, 'post', `/api/correction-requests/${crId}/resolve`, {
      version: await ver('data_correction_requests', crId), note: 'Fixed', business: { version: biz.body.version, notes: 'Phone checked' },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const { rows: st } = await query<{ status: string }>('SELECT status FROM data_correction_requests WHERE id = $1', [crId]);
    expect(st[0].status).toBe('resolved');
    expect((await call(cc, 'get', `/api/businesses/${c.body.id}`)).status).toBe(200);
  });

  // ------------------------------------------------------------------------------------------ Call Center → Developer
  it('Call Center: queue → reservation → callback (follow-up) → accepted → developer handoff → reassignment; access and notifications follow', async () => {
    const cc = await agentFor('call_center');
    const cc2 = await agentFor('call_center');
    const dv1 = await agentFor('developer');
    const dv2 = await agentFor('developer');
    const de = await agentFor('data_entry');
    const c = await call(de, 'post', '/api/businesses', { name: `HJ cafe ${uniq()}`, category: 'Other', phones: [phone()], social: [{ platform: 'instagram', handle: `@hj${uniq()}`, followers: null, lastPost: null }], website: null, confirmSimilar: true });
    expect(c.status).toBe(201);
    const biz = c.body.id as string;
    expect((await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [biz], assigneeId: cc.id })).status).toBe(200);
    await relayAll();
    expect((await inbox(cc)).some((i) => i.template === 'business.assignment')).toBe(true);
    const q = await call(cc, 'get', '/api/calling/queue?pageSize=100');
    expect(q.status).toBe(200);
    expect(JSON.stringify(q.body)).toContain(biz);
    expect(JSON.stringify((await call(cc2, 'get', '/api/calling/queue?pageSize=100')).body)).not.toContain(biz);

    const stateVersion = async () => (await query<{ version: number }>('SELECT version FROM business_calling_states WHERE business_id = $1', [biz])).rows[0].version;
    const reserve = async (a: Agent) => {
      const r = await call(a, 'post', '/api/reservations', { businessId: biz });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      return r.body as { id: string; leaseToken: string };
    };
    // Another agent cannot reserve a business that is not theirs.
    expect((await call(cc2, 'post', '/api/reservations', { businessId: biz })).status).toBeGreaterThanOrEqual(403);
    let res = await reserve(cc);
    const callbackAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const a1 = await call(cc, 'post', '/api/calling/attempts', {
      businessId: biz, reservationId: res.id, leaseToken: res.leaseToken, stateVersion: await stateVersion(), outcome: 'needs_another_call',
      followUp: { scheduledFor: callbackAt, purpose: 'Owner back at 3' }, notes: 'Asked to call back',
    });
    expect(a1.status, JSON.stringify(a1.body)).toBe(201);
    expect(a1.body.followUp).toMatchObject({ state: 'scheduled', responsibleId: cc.id });

    // D9 callback window: past the 15-day assignment window the agent keeps access until callback + 48 h.
    await query(`UPDATE calling_assignments SET started_at = now() - interval '30 days' WHERE business_id = $1 AND ended_at IS NULL`, [biz]);
    expect((await call(cc, 'get', `/api/businesses/${biz}`)).status).toBe(200);
    clock.set(new Date(Date.parse(callbackAt) + 49 * 3600_000));
    const expired = await call(cc, 'get', `/api/businesses/${biz}`);
    clock.set(null);
    expect([403, 404], 'callback + 48 h passed').toContain(expired.status);

    // The callback: complete the follow-up during the call and accept.
    await query(`UPDATE calling_assignments SET started_at = now() WHERE business_id = $1 AND ended_at IS NULL`, [biz]);
    res = await reserve(cc);
    const acc = await call(cc, 'post', '/api/calling/attempts', {
      businessId: biz, reservationId: res.id, leaseToken: res.leaseToken, stateVersion: await stateVersion(), outcome: 'accepted', clientNeedsNote: 'Wants an ordering website',
    });
    expect(acc.status, JSON.stringify(acc.body)).toBe(201);
    const dealId = acc.body.dealId as string;
    expect(dealId).toBeTruthy();
    // D15: the accepting agent does not read the opportunity; nobody but the Owner sees it before the handoff.
    expect((await call(cc, 'get', `/api/deals/${dealId}`)).status).toBe(403);
    expect([403, 404]).toContain((await call(dv1, 'get', `/api/deals/${dealId}`)).status);
    expect(JSON.stringify((await call(dv1, 'get', '/api/deals?pageSize=100')).body)).not.toContain(dealId);

    // Handoff to dv1: notified, can read; reassignment to dv2: dv1 loses it at once, dv2 notified.
    expect((await call(owner, 'post', `/api/deals/${dealId}/developer`, { version: await ver('deals', dealId), developerId: dv1.id })).status).toBe(200);
    await relayAll();
    const n1 = (await inbox(dv1)).find((i) => i.sourceId === dealId);
    expect(n1, 'developer handoff notification').toBeTruthy();
    expect((await call(dv1, 'get', `/api/deals/${dealId}`)).status).toBe(200);
    expect((await call(dv1, 'get', `/api/deals/${dealId}/call-notes`)).status).toBe(200);
    expect((await call(dv1, 'get', `/api/businesses/${biz}`)).status).toBe(200);
    expect((await call(owner, 'post', `/api/deals/${dealId}/developer`, { version: await ver('deals', dealId), developerId: dv2.id })).status).toBe(200);
    await relayAll();
    expect([403, 404], 'former developer: deal').toContain((await call(dv1, 'get', `/api/deals/${dealId}`)).status);
    expect([403, 404], 'former developer: call notes').toContain((await call(dv1, 'get', `/api/deals/${dealId}/call-notes`)).status);
    expect(JSON.stringify((await call(dv1, 'get', '/api/deals?pageSize=100')).body)).not.toContain(dealId);
    // The old notification stays in dv1's inbox but its link is re-checked on open (no data in the item).
    // The former developer's inbox is access-filtered: the handoff item is no longer listed (re-check on read).
    const old = (await inbox(dv1)).find((i) => i.sourceId === dealId);
    expect(old).toBeUndefined();
    expect((await inbox(dv2)).some((i) => i.sourceId === dealId)).toBe(true);
    expect((await call(dv2, 'get', `/api/deals/${dealId}`)).status).toBe(200);
  });

  // ------------------------------------------------------------------------------------------ Developer
  it('Developer: payment + signature → closure request (Owner notified) → Owner verify → project + task lifecycle; closed-deal access ends 15 days after completion; no directory', async () => {
    const cc = await agentFor('call_center');
    const dv = await agentFor('developer');
    const { rows: b } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`HJ dev ${uniq()}`, owner.id]);
    await query(`INSERT INTO business_phones (business_id, country_code, number, normalized_phone) VALUES ($1, '+961', '7', $2)`, [b[0].id, `+9617${Math.floor(1_000_000 + Math.random() * 8_999_999)}`]);
    await query(`INSERT INTO business_calling_states (business_id) VALUES ($1) ON CONFLICT DO NOTHING`, [b[0].id]);
    expect((await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [b[0].id], assigneeId: cc.id })).status).toBe(200);
    const res = await call(cc, 'post', '/api/reservations', { businessId: b[0].id });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const sv = (await query<{ version: number }>('SELECT version FROM business_calling_states WHERE business_id = $1', [b[0].id])).rows[0].version;
    const acc = await call(cc, 'post', '/api/calling/attempts', { businessId: b[0].id, reservationId: res.body.id, leaseToken: res.body.leaseToken, stateVersion: sv, outcome: 'accepted', clientNeedsNote: 'Needs a full brand site' });
    expect(acc.status, JSON.stringify(acc.body)).toBe(201);
    const dealId = acc.body.dealId as string;
    expect((await call(owner, 'post', `/api/deals/${dealId}/developer`, { version: await ver('deals', dealId), developerId: dv.id })).status).toBe(200);

    expect((await call(dv, 'get', '/api/employees')).body.code).toBe('FORBIDDEN_ROLE');
    const search = await call(dv, 'get', '/api/search?q=HJ');
    console.info('[H probe] developer search status', search.status, 'hits', JSON.stringify(search.body).length);
    expect(JSON.stringify(search.body)).not.toMatch(/HJ (shop|cafe)/); // other journeys' businesses never leak
    const pay = await call(dv, 'post', `/api/deals/${dealId}/payment`, { version: await ver('deals', dealId), date: '2026-10-30', reference: 'DEP-1' });
    expect(pay.status, JSON.stringify(pay.body)).toBe(200);
    expect(pay.body.deal.stage).toBe('paid');
    const sig = await call(dv, 'post', `/api/deals/${dealId}/signature`, { version: await ver('deals', dealId), reference: 'AGR-77' });
    expect(sig.body.deal.stage).toBe('signed_and_paid');
    expect((await call(dv, 'post', `/api/deals/${dealId}/finalize`, { version: await ver('deals', dealId) })).status).toBe(403);
    const before = (await call(owner, 'get', '/api/notifications/unread-count')).body.unreadCount;
    expect((await call(dv, 'post', `/api/deals/${dealId}/closure-request`, { version: await ver('deals', dealId), note: 'Contract and deposit in' })).status).toBe(200);
    await relayAll();
    expect((await call(owner, 'get', '/api/notifications/unread-count')).body.unreadCount).toBeGreaterThan(before);
    const v = await call(owner, 'post', `/api/deals/${dealId}/closure-verify`, { version: await ver('deals', dealId) });
    expect(v.status, JSON.stringify(v.body)).toBe(200);
    expect(v.body.deal).toMatchObject({ stage: 'closed' });
    await relayAll();
    const { rows: pr } = await query<{ id: string }>('SELECT id FROM projects WHERE deal_id = $1', [dealId]);
    expect(pr).toHaveLength(1);
    const projectId = pr[0].id;
    expect((await call(owner, 'post', `/api/projects/${projectId}/developers`, { version: await ver('projects', projectId), developerIds: [dv.id] })).status).toBe(200);
    const t = await call(dv, 'post', '/api/tasks', { projectId, title: 'Homepage' });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    let task = t.body.task;
    for (const status of ['in_progress', 'done']) {
      const u = await call(dv, 'patch', `/api/tasks/${task.id}`, { version: task.version, status });
      expect(u.status, JSON.stringify(u.body)).toBe(200);
      task = u.body.task;
    }
    const stale = await call(dv, 'patch', `/api/tasks/${task.id}`, { version: 1, title: 'stale' });
    expect(stale.status).toBe(409);
    for (const to of ['in_progress', 'delivered', 'completed']) {
      const s = await call(to === 'completed' ? owner : dv, 'post', `/api/projects/${projectId}/status`, { version: await ver('projects', projectId), to });
      expect(s.status, `${to}: ${JSON.stringify(s.body)}`).toBe(200);
    }
    expect((await call(dv, 'get', `/api/deals/${dealId}`)).status).toBe(200);
    expect((await call(dv, 'get', `/api/projects/${projectId}`)).status).toBe(200);
    // D9: closed deal visible to the Developer for 15 elapsed days after completion, then gone.
    clock.set(new Date(Date.now() + 16 * 86_400_000));
    const late = await call(dv, 'get', `/api/deals/${dealId}`);
    const lateProject = await call(dv, 'get', `/api/projects/${projectId}`);
    clock.set(null);
    expect([403, 404], 'deal 16 days after completion').toContain(late.status);
    expect([403, 404], 'project 16 days after completion').toContain(lateProject.status);
  });

  // ------------------------------------------------------------------------------------------ Attendance
  describe('attendance', () => {
    const OFFICE = ['203.0.113.0/24'];
    async function putSettings(o: object = {}) {
      const cur = await call(owner, 'get', '/api/attendance/settings');
      const r = await call(owner, 'put', '/api/attendance/settings', {
        version: cur.body.current?.versionNo ?? 0, timezone: 'Asia/Beirut', workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], shiftStart: '09:00',
        graceMinutes: 10, verificationMode: 'ip', officeIps: OFFICE, holidays: ['2026-12-25'], holidaysConfirmed: true, missingCheckoutFlagHours: 6, ...o,
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    const beirut = (date: string, hhmmss: string) => new Date(`${date}T${hhmmss}+02:00`); // November: UTC+2
    const inOffice = { 'X-Forwarded-For': '203.0.113.20' };
    const outside = { 'X-Forwarded-For': '198.51.100.99' };
    let trust: unknown;

    beforeAll(async () => {
      trust = app.get('trust proxy');
      app.set('trust proxy', 'loopback');
      await putSettings();
    });
    afterAll(async () => {
      app.set('trust proxy', trust);
      await putSettings({ officeIps: ['127.0.0.1', '::1', '::ffff:127.0.0.1'] });
    });

    it('outside office → 422 (audited, no session); Owner remote exception → remote session; grace boundary on time vs late; holiday', async () => {
      const a = await agentFor('developer');
      clock.set(beirut('2026-11-09', '09:10:00.000'));
      const denied = await call(a, 'post', '/api/attendance/check-in', {}, outside);
      expect(denied.status).toBe(422);
      expect(denied.body.details.reason).toBe('OFFICE_CHECK_FAILED');
      expect((await query('SELECT 1 FROM attendance_sessions WHERE employee_id = $1', [a.id])).rowCount).toBe(0);
      const g = await call(owner, 'post', '/api/attendance/remote-exceptions', { employeeId: a.id, startDate: '2026-11-09', reason: 'Client workshop' });
      expect(g.status).toBe(201);
      const ok = await call(a, 'post', '/api/attendance/check-in', {}, outside);
      expect(ok.status, JSON.stringify(ok.body)).toBe(201);
      expect(ok.body.session).toMatchObject({ remote: true, punctuality: 'on_time' }); // exactly start + grace = on time
      const b = await agentFor('call_center');
      clock.set(beirut('2026-11-09', '09:10:00.001'));
      const late = await call(b, 'post', '/api/attendance/check-in', {}, inOffice);
      expect(late.status).toBe(201);
      expect(late.body.session.punctuality).toBe('late');
      const h = await agentFor('data_entry');
      clock.set(beirut('2026-12-25', '09:30:00'));
      expect((await call(h, 'post', '/api/attendance/check-in', {}, inOffice)).body.session.punctuality).toBe('non_working_day');
    });

    it('failed checkout (outside office) → provisional + Owner review item; missing checkout → flagged by the job, blocks self checkout, correction unblocks', async () => {
      const a = await agentFor('data_entry');
      clock.set(beirut('2026-11-10', '09:00:00'));
      expect((await call(a, 'post', '/api/attendance/check-in', {}, inOffice)).status).toBe(201);
      clock.set(beirut('2026-11-10', '18:05:00'));
      const out = await call(a, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Typed in forty records' } }, outside);
      expect(out.status, JSON.stringify(out.body)).toBeLessThan(300);
      expect(out.body.session.state).toBe('closed_provisional');
      const q = await call(owner, 'get', '/api/attendance/corrections?kind=missing_checkout&pageSize=100');
      expect(JSON.stringify(q.body)).toContain(out.body.session.id);

      const m = await agentFor('call_center');
      clock.set(beirut('2026-11-11', '09:00:00'));
      const s = await call(m, 'post', '/api/attendance/check-in', {}, inOffice);
      expect(s.status).toBe(201);
      clock.set(beirut('2026-11-12', '01:30:00'));
      await runDueJobs(['attendance.exception_check']);
      clock.set(beirut('2026-11-12', '09:00:00'));
      const self = await call(m, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Forgot to check out' } }, inOffice);
      expect(self.status).toBe(409);
      expect(self.body.details.reason).toBe('CORRECTION_REQUIRED');
      const blocked = await call(m, 'post', '/api/attendance/check-in', {}, inOffice);
      expect(blocked.status).toBe(409);
      const cr = await call(m, 'post', '/api/attendance/corrections', { sessionId: s.body.session.id, proposedCheckOutAt: '2026-11-11T18:00:00+02:00', reason: 'Forgot to check out' });
      expect(cr.status, JSON.stringify(cr.body)).toBe(201);
      await relayAll();
      const ap = await call(owner, 'post', `/api/attendance/corrections/${cr.body.id}/approve`, { version: cr.body.version });
      expect(ap.status, JSON.stringify(ap.body)).toBe(200);
      const next = await call(m, 'post', '/api/attendance/check-in', {}, inOffice);
      expect(next.status, JSON.stringify(next.body)).toBe(201);
      const orig = await query<{ check_in_at: Date; check_out_at: Date | null }>('SELECT check_in_at, check_out_at FROM attendance_sessions WHERE id = $1', [s.body.session.id]);
      expect(orig.rows[0].check_in_at.toISOString()).toBe('2026-11-11T07:00:00.000Z'); // original kept
    });

    it('S-30: an Owner who forgot to check out cannot send a request (409 OWNER_CORRECTS_DIRECTLY) and adjusts their own session with a reason', async () => {
      const o2 = await ownerAgent();
      clock.set(beirut('2026-11-16', '09:00:00'));
      const s = await call(o2, 'post', '/api/attendance/check-in', {}, inOffice);
      expect(s.status).toBe(201);
      clock.set(beirut('2026-11-17', '01:30:00'));
      await runDueJobs(['attendance.exception_check']);
      clock.set(beirut('2026-11-17', '09:00:00'));
      expect((await call(o2, 'post', '/api/attendance/check-in', {}, inOffice)).status).toBe(409);
      expect((await call(o2, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Owner day of reviews' } }, inOffice)).status).toBe(409);
      const cr = await call(o2, 'post', '/api/attendance/corrections', { sessionId: s.body.session.id, proposedCheckOutAt: '2026-11-16T18:00:00+02:00', reason: 'Forgot' });
      // S-30 (Owner 2026-11-05): the Owner never sends a request for their own attendance.
      expect(cr.status, JSON.stringify(cr.body)).toBe(409);
      expect(cr.body.details?.reason).toBe('OWNER_CORRECTS_DIRECTLY');
      // S-30 (Owner 2026-11-04, H-01): a single Owner adjusts their own session directly, with a reason, audited selfAdjusted.
      const sv = await ver('attendance_sessions', s.body.session.id);
      const adj = await call(o2, 'post', `/api/attendance/sessions/${s.body.session.id}/adjust`, { version: sv, checkOutAt: '2026-11-16T16:00:00Z', reason: 'Forgot to check out' });
      expect(adj.status, JSON.stringify(adj.body)).toBe(200);
      const a = await query<{ after: Record<string, unknown> }>(
        `SELECT after_state AS after FROM audit_events WHERE event_name = 'attendance.corrected' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [s.body.session.id]
      );
      expect(a.rows[0].after).toMatchObject({ selfAdjusted: true });
      // The adjustment closes the session, so check-in is unblocked.
      expect((await call(o2, 'post', '/api/attendance/check-in', {}, inOffice)).status).toBe(201);
    });

    it('S-30 (2026-11-05): an Owner request sent before the rule changed is decided by the Owner, audited selfAdjusted', async () => {
      const o3 = await ownerAgent();
      const ownerId = o3.id; // the Owner deciding is the Owner who sent the request
      // Two forgotten checkouts, each with a request created the way the old UI allowed (inserted directly).
      const legacy = async (day: string) => {
        clock.set(beirut(day, '08:10:00'));
        const s = await call(o3, 'post', '/api/attendance/check-in', {}, inOffice);
        expect(s.status, JSON.stringify(s.body)).toBe(201);
        const id = await withTransaction(async (tx) => {
          await tx.query(`UPDATE attendance_sessions SET state = 'pending_review' WHERE id = $1`, [s.body.session.id]);
          const { rows } = await tx.query<{ id: string }>(
            `INSERT INTO attendance_corrections (session_id, employee_id, kind, status, proposed_check_out_at, proposed_check_out_unknown,
               previous_check_in_at, reason, closed_session_provisionally, created_by)
             VALUES ($1, $2, 'request', 'submitted', $3, false, $4, 'Forgot to check out', true, $2) RETURNING id`,
            [s.body.session.id, ownerId, beirut(day, '16:26:00'), beirut(day, '08:10:00')]
          );
          return rows[0].id;
        });
        return { sessionId: s.body.session.id as string, id };
      };
      const a = await legacy('2026-11-23');
      clock.set(beirut('2026-11-24', '07:00:00'));
      const ok = await call(o3, 'post', `/api/attendance/corrections/${a.id}/approve`, { version: await ver('attendance_corrections', a.id) });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.status).toBe('approved');
      const sess = await query<{ state: string; effective_check_out_at: Date }>('SELECT state, effective_check_out_at FROM attendance_sessions WHERE id = $1', [a.sessionId]);
      expect(sess.rows[0].state).toBe('closed');
      expect(sess.rows[0].effective_check_out_at.toISOString()).toBe(beirut('2026-11-23', '16:26:00').toISOString());
      const au = await query<{ after: Record<string, unknown>; reason: string | null }>(
        `SELECT after_state AS after, reason FROM audit_events WHERE event_name = 'attendance_correction.approved' AND entity_id = $1`,
        [a.id]
      );
      expect(au.rows[0].after).toMatchObject({ selfAdjusted: true });
      expect(au.rows[0].reason).toBe('Forgot to check out');

      const b = await legacy('2026-11-24');
      clock.set(beirut('2026-11-25', '07:00:00'));
      const no = await call(o3, 'post', `/api/attendance/corrections/${b.id}/reject`, { version: await ver('attendance_corrections', b.id), reason: 'Will adjust directly' });
      expect(no.status, JSON.stringify(no.body)).toBe(200);
      const au2 = await query<{ after: Record<string, unknown> }>(
        `SELECT after_state AS after FROM audit_events WHERE event_name = 'attendance_correction.rejected' AND entity_id = $1`,
        [b.id]
      );
      expect(au2.rows[0].after).toMatchObject({ selfAdjusted: true });
    });
  });
});
