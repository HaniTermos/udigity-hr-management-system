/**
 * BE4 Increment 5 API tests (DB): deals, meetings, projects/tasks. Run only with TEST_DATABASE_URL
 * (BE4: udigity_test_be4). Covers SEQ-14 (closure + provisioning) under both DEC-006 modes, DEC-005
 * both branches, F2 both branches (E-14 consumer + J-07 retry, manual create), OQ-15 reopen both
 * branches, remove-fact, the P7 open-task warning, meetings SM, BE3 read ops, a per-role route matrix
 * and list leakage. Every flag value used is a "Demonstration alternative — not approved".
 *
 * The access_facts delivery columns come from migration 903 (BL-15, the [BE4-R4] contract).
 * Rows are uniquely named and never deleted (FKs RESTRICT, audit append-only).
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
import { runSystemCommand } from '../../shared/tx.js';
import { storeEnrolledSecret } from '../identity/twoFactor.js';
import { setRuleFlagOverridesForTests } from '../access/schemas.js';
import { clock } from '../platform/clock.js';
import { relayOutboxOnce, runDueJobs } from '../platform/service.js';
import { setProvisioningFaultForTests } from '../projects/service.js';
import { HttpError } from '../../shared/errors.js';
import { createAcceptedOpportunity, findNotProceedingDeal, findOpenDeal, listOpportunities, setDeliveryPolicyForTests, type DeliveryPolicy } from './service.js';

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

function call(a: Agent, method: 'get' | 'post' | 'patch', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  return body ? r.send(body) : r;
}

async function makeEmployee(role: Role): Promise<{ id: string; email: string }> {
  const email = `be4.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `BE4 ${role}`, role]
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

/** A fresh Owner with an enrolled TOTP factor: verified session + a second session left in pending 2FA. */
async function ownerAgents(): Promise<{ owner: Agent; pending: Agent }> {
  const e = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, e.id, DEV_TOTP_SECRET));
  const pend = await login(e.email);
  const s = await login(e.email);
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', s.cookie)
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', s.csrf)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return {
    owner: { cookie: cookieFrom(v), csrf: v.body.csrfToken, id: e.id, role: 'owner' },
    pending: { cookie: pend.cookie, csrf: pend.csrf, id: e.id, role: 'owner' },
  };
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await query<{ n: string }>(sql, params);
  return Number(rows[0].n);
}
const outboxCount = (name: string, aggregateId: string) =>
  count('SELECT COUNT(*)::text AS n FROM outbox_events WHERE name = $1 AND aggregate_id = $2', [name, aggregateId]);
const auditCount = (eventName: string, entityId: string) =>
  count('SELECT COUNT(*)::text AS n FROM audit_events WHERE event_name = $1 AND entity_id = $2', [eventName, entityId]);

async function relayAll(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const r = await relayOutboxOnce();
    if (r.claimed === 0) return;
  }
}

function policy(p: Partial<DeliveryPolicy>): void {
  setDeliveryPolicyForTests(p);
  setRuleFlagOverridesForTests(p.developerPreClosure ? { 'deals.developerPreClosure': p.developerPreClosure } : {});
}

describe.skipIf(!hasTestDb)('BE4 Increment 5 — delivery (DB)', () => {
  let owner: Agent;
  let pendingOwner: Agent;
  let de: Agent;
  let cc: Agent;
  let cc2: Agent;
  let dv: Agent;
  let dv2: Agent;

  /** Business assigned to `cc` + accepted attempt + deal through the E5 op (as MOD-calls does). */
  async function newDeal(opts: { developer?: Agent | null; agent?: Agent } = {}) {
    const agent = opts.agent ?? cc;
    const { rows: b } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`BE4 Biz ${uniq()}`, owner.id]);
    const businessId = b[0].id;
    await query(`INSERT INTO calling_assignments (business_id, assignee_id, assigned_by) VALUES ($1, $2, $3)`, [businessId, agent.id, owner.id]);
    const dealId = await acceptedDeal(businessId, agent, opts.developer === undefined ? dv : opts.developer);
    return { businessId, dealId };
  }

  async function acceptedDeal(businessId: string, agent: Agent, developer: Agent | null): Promise<string> {
    const { rows: a } = await query<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
      [businessId, agent.id, crypto.randomUUID()]
    );
    const r = await runSystemCommand('test.accept', (ctx) =>
      createAcceptedOpportunity(ctx, {
        businessId,
        callAttemptId: a[0].id,
        acceptingAgentId: agent.id,
        clientNeedsNote: 'Needs a booking portal',
        ...(developer ? { developerId: developer.id } : {}),
      })
    );
    return r.dealId;
  }

  async function getDeal(a: Agent, id: string) {
    return call(a, 'get', `/api/deals/${id}`);
  }

  async function version(id: string): Promise<number> {
    const { rows } = await query<{ version: number }>('SELECT version FROM deals WHERE id = $1', [id]);
    return rows[0].version;
  }

  async function cmd(a: Agent, id: string, verb: string, body: object = {}) {
    return call(a, 'post', `/api/deals/${id}/${verb}`, { version: await version(id), ...body });
  }

  /** accepted → paid → signed_and_paid by the assigned Developer (order independent, OQ-05). */
  async function recordBothFacts(a: Agent, id: string) {
    const p = await cmd(a, id, 'payment', { date: '2026-10-20', reference: 'PAY-1' });
    expect(p.status).toBe(200);
    expect(p.body.deal.stage).toBe('paid');
    const s = await cmd(a, id, 'signature', { date: '2026-10-21', reference: 'AGR-1' });
    expect(s.status).toBe(200);
    expect(s.body.deal.stage).toBe('signed_and_paid');
  }

  async function closedDealWithProject(): Promise<{ dealId: string; projectId: string; businessId: string }> {
    policy({ closureMode: 'direct' });
    const { dealId, businessId } = await newDeal();
    await recordBothFacts(dv, dealId);
    expect((await cmd(dv, dealId, 'finalize')).status).toBe(200);
    await relayAll();
    const { rows } = await query<{ id: string }>('SELECT id FROM projects WHERE deal_id = $1', [dealId]);
    expect(rows).toHaveLength(1);
    policy({});
    return { dealId, projectId: rows[0].id, businessId };
  }

  beforeAll(async () => {
    ({ owner, pending: pendingOwner } = await ownerAgents());
    de = await agentFor('data_entry');
    cc = await agentFor('call_center');
    cc2 = await agentFor('call_center');
    dv = await agentFor('developer');
    dv2 = await agentFor('developer');
  });

  afterEach(() => {
    policy({});
    clock.set(null);
    setProvisioningFaultForTests(null);
  });

  afterAll(async () => {
    // Leave no pending outbox rows for the next suite's relay (it claims in batches, oldest first).
    clock.set(null);
    await relayAll();
    await pool.end();
  });

  // -------------------------------------------------------------------------------------------
  // Per-role route matrix (authz-matrix §3.8): allowed roles pass the gate, others get FORBIDDEN_ROLE.
  // -------------------------------------------------------------------------------------------
  describe('role matrix', () => {
    const X = '00000000-0000-4000-8000-0000000000aa';
    const v = { version: 1 };
    type Row = { method: 'get' | 'post' | 'patch'; path: string; allowed: Role[]; body?: object };
    const rows: Row[] = [
      { method: 'get', path: '/api/deals', allowed: ['owner', 'call_center', 'developer'] },
      { method: 'get', path: `/api/deals/${X}`, allowed: ['owner', 'call_center', 'developer'] },
      { method: 'post', path: `/api/deals/${X}/developer`, allowed: ['owner', 'call_center'], body: { ...v, developerId: X } },
      { method: 'get', path: '/api/deals/developers', allowed: ['owner', 'call_center'] }, // BL-11
      { method: 'post', path: `/api/deals/${X}/signature`, allowed: ['owner', 'developer'], body: { ...v, date: '2026-10-01', reference: 'R' } },
      { method: 'post', path: `/api/deals/${X}/payment`, allowed: ['owner', 'developer'], body: { ...v, date: '2026-10-01', reference: 'R' } },
      { method: 'post', path: `/api/deals/${X}/remove-fact`, allowed: ['owner', 'developer'], body: { ...v, fact: 'payment', reason: 'typo' } },
      { method: 'post', path: `/api/deals/${X}/closure-request`, allowed: ['developer'], body: v },
      { method: 'post', path: `/api/deals/${X}/closure-verify`, allowed: ['owner'], body: v },
      { method: 'post', path: `/api/deals/${X}/closure-reject`, allowed: ['owner'], body: { ...v, reason: 'missing' } },
      { method: 'post', path: `/api/deals/${X}/finalize`, allowed: ['owner', 'developer'], body: v },
      { method: 'post', path: `/api/deals/${X}/not-proceeding`, allowed: ['owner', 'developer'], body: { ...v, reason: 'client left' } },
      { method: 'post', path: `/api/deals/${X}/reopen`, allowed: ['owner'], body: { ...v, reason: 'client back' } },
      { method: 'get', path: `/api/meetings?dealId=${X}`, allowed: ['owner', 'call_center', 'developer'] },
      { method: 'post', path: '/api/meetings', allowed: ['owner', 'call_center', 'developer'], body: { dealId: X, startsAt: '2030-01-01T10:00:00Z', attendeeIds: [X] } },
      { method: 'patch', path: `/api/meetings/${X}`, allowed: ['owner', 'call_center', 'developer'], body: { ...v, startsAt: '2030-01-01T10:00:00Z' } },
      { method: 'post', path: `/api/meetings/${X}/held`, allowed: ['owner', 'call_center', 'developer'], body: { ...v, discoveryNotes: 'n' } },
      { method: 'post', path: `/api/meetings/${X}/missed`, allowed: ['owner', 'call_center', 'developer'], body: v },
      { method: 'post', path: `/api/meetings/${X}/cancel`, allowed: ['owner', 'call_center', 'developer'], body: { ...v, reason: 'nope' } },
      { method: 'get', path: '/api/projects', allowed: ['owner', 'developer'] },
      { method: 'post', path: '/api/projects', allowed: ['owner', 'developer'], body: { dealId: X } },
      { method: 'get', path: `/api/projects/${X}`, allowed: ['owner', 'developer'] },
      { method: 'patch', path: `/api/projects/${X}`, allowed: ['owner', 'developer'], body: { ...v, name: 'n' } },
      { method: 'post', path: `/api/projects/${X}/status`, allowed: ['owner', 'developer'], body: { ...v, to: 'in_progress' } },
      { method: 'post', path: `/api/projects/${X}/reopen`, allowed: ['owner'], body: { ...v, reason: 'rework' } },
      { method: 'post', path: `/api/projects/${X}/developers`, allowed: ['owner'], body: { ...v, developerIds: [] } },
      { method: 'post', path: `/api/projects/${X}/provision-retry`, allowed: ['owner'], body: {} },
      { method: 'get', path: `/api/tasks?projectId=${X}`, allowed: ['owner', 'developer'] },
      { method: 'post', path: '/api/tasks', allowed: ['owner', 'developer'], body: { projectId: X, title: 't' } },
      { method: 'patch', path: `/api/tasks/${X}`, allowed: ['owner', 'developer'], body: { ...v, title: 't' } },
    ];
    const agents = (): Record<Role, Agent> => ({ owner, data_entry: de, call_center: cc, developer: dv });

    it.each(rows)('$method $path', async (row) => {
      for (const role of ['owner', 'data_entry', 'call_center', 'developer'] as Role[]) {
        const res = await call(agents()[role], row.method, row.path, row.body);
        if (row.allowed.includes(role)) {
          expect(res.body.code, `${role} ${row.path}`).not.toBe('FORBIDDEN_ROLE');
          expect([200, 400, 404, 409], `${role} ${row.path} → ${res.status} ${res.body.code}`).toContain(res.status);
        } else {
          expect(res.status, `${role} ${row.path}`).toBe(403);
          expect(res.body.code).toBe('FORBIDDEN_ROLE');
        }
      }
    });

    it('BL-11: GET /api/deals/developers lists active Developers only (id + name)', async () => {
      const r = await call(cc, 'get', '/api/deals/developers');
      expect(r.status).toBe(200);
      const ids = (r.body.items as { id: string; name: string }[]).map((i) => i.id);
      expect(ids).toEqual(expect.arrayContaining([dv.id, dv2.id]));
      expect(ids).not.toContain(cc.id);
      expect(Object.keys(r.body.items[0]).sort()).toEqual(['id', 'name']);
    });

    it('admin-only commands need a completed Owner 2FA session', async () => {
      for (const path of [`/api/deals/${X}/closure-verify`, `/api/deals/${X}/reopen`, `/api/projects/${X}/provision-retry`]) {
        const res = await call(pendingOwner, 'post', path, { ...v, reason: 'because' });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('OWNER_2FA_REQUIRED');
      }
    });
  });

  // -------------------------------------------------------------------------------------------
  // E5 + BE3 read ops
  // -------------------------------------------------------------------------------------------
  describe('createAcceptedOpportunity and read ops (BE3)', () => {
    it('replay returns the same deal; DEC-017 blocks a second open deal; audit counted once', async () => {
      const { businessId, dealId } = await newDeal({ developer: null });
      const { rows: a } = await query<{ accepted_attempt_id: string }>('SELECT accepted_attempt_id FROM deals WHERE id = $1', [dealId]);
      const again = await runSystemCommand('test.accept', (ctx) =>
        createAcceptedOpportunity(ctx, { businessId, callAttemptId: a[0].accepted_attempt_id, acceptingAgentId: cc.id, clientNeedsNote: 'x' })
      );
      expect(again).toEqual({ dealId, created: false, developerAssigned: false });
      await expect(acceptedDeal(businessId, cc, null)).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT_DUPLICATE' } satisfies Partial<HttpError>);
      expect(await auditCount('accepted_opportunity.created', dealId)).toBe(1);
      expect(await findOpenDeal(pool, businessId)).toEqual({ dealId, stage: 'accepted_opportunity' });
    });

    it('listOpportunities is scoped (assigned CC sees it, another CC does not); findNotProceedingDeal', async () => {
      const { businessId, dealId } = await newDeal({ developer: null });
      const p = { employeeId: cc.id, role: 'call_center' as const, sessionState: 'active' as const };
      const mine = await listOpportunities(pool, p, { page: 1, pageSize: 100, developerAssigned: false });
      expect(mine.items.map((o) => o.dealId)).toContain(dealId);
      const other = await listOpportunities(pool, { ...p, employeeId: cc2.id }, { page: 1, pageSize: 100 });
      expect(other.items.map((o) => o.dealId)).not.toContain(dealId);
      expect(await findNotProceedingDeal(pool, businessId)).toBeNull();
      expect((await cmd(owner, dealId, 'not-proceeding', { reason: 'Client chose another vendor' })).status).toBe(200);
      expect(await findNotProceedingDeal(pool, businessId)).toMatchObject({ dealId, businessId, reason: 'Client chose another vendor' });
      // CC-007 asks for open deals only: a not-proceeding deal is no longer an opportunity.
      const open = await listOpportunities(pool, p, { page: 1, pageSize: 100, openOnly: true });
      expect(open.items.map((o) => o.dealId)).not.toContain(dealId);
      expect(open.items.every((o) => o.stage !== 'closed' && o.stage !== 'not_proceeding')).toBe(true);
      const all = await listOpportunities(pool, p, { page: 1, pageSize: 100 });
      expect(all.items.map((o) => o.dealId)).toContain(dealId);
    });
  });

  // -------------------------------------------------------------------------------------------
  // SEQ-14 under both DEC-006 modes
  // -------------------------------------------------------------------------------------------
  describe('SEQ-14 closure + provisioning', () => {
    it('direct (Alt A): the assigned Developer finalizes; missing fact named; project auto-provisioned once', async () => {
      policy({ closureMode: 'direct' });
      const { dealId } = await newDeal();
      const early = await cmd(dv, dealId, 'finalize');
      expect(early.status).toBe(409);
      expect(early.body.details).toEqual({ missing: ['signature', 'payment'] });
      await recordBothFacts(dv, dealId);
      expect((await cmd(dv, dealId, 'closure-request')).body.code).toBe('STATE_CONFLICT');
      const stale = await call(dv, 'post', `/api/deals/${dealId}/finalize`, { version: 1 });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('VERSION_CONFLICT');
      const fin = await cmd(dv, dealId, 'finalize');
      expect(fin.status).toBe(200);
      expect(fin.body.deal.stage).toBe('closed');
      expect(fin.body.deal.closure.mode).toBe('direct');
      expect(fin.body.deal.projectProvisioning).toBe('pending');
      expect((await cmd(dv, dealId, 'finalize')).status).toBe(200); // repeat = no-op
      expect(await outboxCount('deal.closed', dealId)).toBe(1);
      expect(await auditCount('deal.closed', dealId)).toBe(1);
      await relayAll();
      await relayAll();
      const { rows } = await query<{ id: string; status: string; provisioned_by: string }>('SELECT id, status, provisioned_by FROM projects WHERE deal_id = $1', [dealId]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: 'scheduled', provisioned_by: 'auto' });
      expect(await count('SELECT COUNT(*)::text AS n FROM project_developer_assignments WHERE project_id = $1', [rows[0].id])).toBe(0);
      expect(await auditCount('project.provisioned', rows[0].id)).toBe(1);
      const d = await getDeal(owner, dealId);
      expect(d.body.deal.projectProvisioning).toBe('provisioned');
      expect(d.body.deal.projectId).toBe(rows[0].id);
    });

    it('ownerVerify (Alt B, default): Developer finalize denied; request → reject (reason) → request → verify closes', async () => {
      const { dealId } = await newDeal();
      await recordBothFacts(dv, dealId);
      const denied = await cmd(dv, dealId, 'finalize');
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('PERMISSION_DENIED');
      const req1 = await cmd(dv, dealId, 'closure-request', { note: 'All set' });
      expect(req1.status).toBe(200);
      expect(req1.body.deal.openClosureReview.status).toBe('requested');
      expect(await outboxCount('deal.closure_requested', dealId)).toBe(1);
      expect((await cmd(dv, dealId, 'closure-request')).status).toBe(200); // one open request: no-op
      expect(await outboxCount('deal.closure_requested', dealId)).toBe(1);
      const rej = await cmd(owner, dealId, 'closure-reject', { reason: 'Payment reference is wrong' });
      expect(rej.status).toBe(200);
      expect(rej.body.deal.stage).toBe('signed_and_paid');
      expect(rej.body.deal.lastRejectedReview.rejectReason).toBe('Payment reference is wrong');
      expect(await outboxCount('deal.closure_rejected', dealId)).toBe(1);
      expect((await cmd(owner, dealId, 'closure-verify')).body.code).toBe('STATE_CONFLICT'); // nothing requested
      expect((await cmd(dv, dealId, 'closure-request')).status).toBe(200);
      const ver = await cmd(owner, dealId, 'closure-verify');
      expect(ver.status).toBe(200);
      expect(ver.body.deal.stage).toBe('closed');
      expect(ver.body.deal.closure.mode).toBe('ownerVerify');
      expect(await outboxCount('deal.closed', dealId)).toBe(1);
      await relayAll();
      expect(await count('SELECT COUNT(*)::text AS n FROM projects WHERE deal_id = $1', [dealId])).toBe(1);
    });

    it('ownerVerify: the Owner may finalize directly without a request; direct mode refuses verify/reject', async () => {
      const { dealId } = await newDeal();
      await recordBothFacts(owner, dealId);
      expect((await cmd(owner, dealId, 'finalize')).body.deal.stage).toBe('closed');
      policy({ closureMode: 'direct' });
      const { dealId: d2 } = await newDeal();
      await recordBothFacts(dv, d2);
      expect((await cmd(owner, d2, 'closure-verify')).body.code).toBe('STATE_CONFLICT');
      expect((await cmd(owner, d2, 'closure-reject', { reason: 'nope nope' })).body.code).toBe('STATE_CONFLICT');
    });

    it('F2 auto: provisioning failure keeps the closure, records E-15, J-07 retries with backoff; Owner retry works', async () => {
      policy({ closureMode: 'direct' });
      const { dealId } = await newDeal();
      await recordBothFacts(dv, dealId);
      setProvisioningFaultForTests((id) => {
        if (id === dealId) throw new Error('simulated');
      });
      expect((await cmd(dv, dealId, 'finalize')).status).toBe(200);
      await relayAll();
      expect(await count('SELECT COUNT(*)::text AS n FROM projects WHERE deal_id = $1', [dealId])).toBe(0);
      const { rows: st } = await query<{ attempts: number; last_error_code: string; next_attempt_at: Date }>(
        'SELECT attempts, last_error_code, next_attempt_at FROM project_provisioning_states WHERE deal_id = $1',
        [dealId]
      );
      expect(st[0]).toMatchObject({ attempts: 1, last_error_code: 'PROVISIONING_ERROR' });
      expect(await outboxCount('project.provisioning_failed', dealId)).toBe(1);
      expect(await count(`SELECT COUNT(*)::text AS n FROM background_jobs WHERE kind = 'projects.provision_retry' AND payload->>'dealId' = $1`, [dealId])).toBe(1);
      expect((await getDeal(owner, dealId)).body.deal).toMatchObject({ stage: 'closed', projectProvisioning: 'failed' });
      const list = await call(owner, 'get', '/api/projects?pageSize=5');
      expect(list.body.unprovisioned.find((u: { dealId: string }) => u.dealId === dealId)).toMatchObject({ provisioning: 'failed', attempts: 1 });
      // J-07: still failing → second attempt scheduled; then success.
      clock.set(new Date(Date.now() + 2 * 60_000));
      await runDueJobs(['projects.provision_retry']);
      expect((await query<{ attempts: number }>('SELECT attempts FROM project_provisioning_states WHERE deal_id = $1', [dealId])).rows[0].attempts).toBe(2);
      setProvisioningFaultForTests(null);
      clock.set(new Date(Date.now() + 10 * 60_000));
      await runDueJobs(['projects.provision_retry']);
      expect(await count('SELECT COUNT(*)::text AS n FROM projects WHERE deal_id = $1', [dealId])).toBe(1);
      expect((await getDeal(owner, dealId)).body.deal.projectProvisioning).toBe('provisioned');

      // Owner retry (inline attempt) on another failed deal.
      clock.set(null);
      const { dealId: d2 } = await newDeal();
      await recordBothFacts(dv, d2);
      setProvisioningFaultForTests((id) => {
        if (id === d2) throw new Error('simulated');
      });
      await cmd(dv, d2, 'finalize');
      await relayAll();
      const failed = await call(owner, 'post', `/api/projects/${d2}/provision-retry`, {});
      expect(failed.status).toBe(200);
      expect(failed.body).toMatchObject({ project: null, provisioning: { state: 'failed', attempts: 2 } });
      setProvisioningFaultForTests(null);
      const ok = await call(owner, 'post', `/api/projects/${d2}/provision-retry`, {});
      expect(ok.status).toBe(200);
      expect(ok.body.provisioning.state).toBe('provisioned');
      expect(ok.body.project.status).toBe('scheduled');
      expect((await call(dv, 'post', `/api/projects/${d2}/provision-retry`, {})).body.code).toBe('FORBIDDEN_ROLE');
    });

    it('F2 manual: no auto project, no J-07; Owner/assigned Developer create once; auto mode refuses manual create', async () => {
      policy({ closureMode: 'direct', autoProvision: false });
      const { dealId } = await newDeal();
      await recordBothFacts(dv, dealId);
      await cmd(dv, dealId, 'finalize');
      await relayAll();
      expect(await count('SELECT COUNT(*)::text AS n FROM projects WHERE deal_id = $1', [dealId])).toBe(0);
      expect(await count(`SELECT COUNT(*)::text AS n FROM background_jobs WHERE kind = 'projects.provision_retry' AND payload->>'dealId' = $1`, [dealId])).toBe(0);
      expect((await getDeal(owner, dealId)).body.deal.projectProvisioning).toBe('pending');
      expect((await call(owner, 'post', `/api/projects/${dealId}/provision-retry`, {})).body.code).toBe('STATE_CONFLICT');
      expect((await call(dv2, 'post', '/api/projects', { dealId })).body.code).toBe('PERMISSION_DENIED');
      const created = await call(dv, 'post', '/api/projects', { dealId, name: 'Booking portal', targetDate: '2030-01-31' });
      expect(created.status).toBe(201);
      expect(created.body.project).toMatchObject({ status: 'scheduled', provisionedBy: 'manual', name: 'Booking portal', developers: [] });
      const dup = await call(owner, 'post', '/api/projects', { dealId });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('CONFLICT_DUPLICATE');
      policy({ autoProvision: true });
      expect((await call(owner, 'post', '/api/projects', { dealId })).body.code).toBe('STATE_CONFLICT');
    });
  });

  // -------------------------------------------------------------------------------------------
  // DEC-005 both branches
  // -------------------------------------------------------------------------------------------
  describe('DEC-005 deals.developerPreClosure', () => {
    it('assigned: the assigned Developer reads, records facts and schedules; another Developer cannot', async () => {
      const { dealId } = await newDeal();
      const r = await getDeal(dv, dealId);
      expect(r.status).toBe(200);
      expect(r.body.deal.allowed).toMatchObject({ recordSignature: true, recordPayment: true, scheduleMeeting: true, verifyClosure: false });
      expect((await getDeal(dv2, dealId)).status).toBe(403);
      expect((await cmd(dv2, dealId, 'signature', { date: '2026-10-01', reference: 'X' })).status).toBe(403);
      const list = await call(dv, 'get', '/api/deals?pageSize=100&scope=assigned_to_me');
      expect(list.body.items.map((d: { id: string }) => d.id)).toContain(dealId);
      expect((await call(dv, 'get', '/api/deals?closedWithinDays=30&pageSize=100')).body.items.map((d: { id: string }) => d.id)).not.toContain(dealId);
      const list2 = await call(dv2, 'get', '/api/deals?pageSize=100');
      expect(list2.body.items.map((d: { id: string }) => d.id)).not.toContain(dealId);
    });

    it('closedOnly: the Developer sees only closed deals, cannot record facts or schedule; the Owner records', async () => {
      policy({ developerPreClosure: 'closedOnly', closureMode: 'direct' });
      const { dealId } = await newDeal();
      expect((await getDeal(dv, dealId)).status).toBe(403);
      expect((await cmd(dv, dealId, 'signature', { date: '2026-10-01', reference: 'X' })).body.code).toBe('PERMISSION_DENIED');
      const m = await call(dv, 'post', '/api/meetings', { dealId, startsAt: '2030-01-01T10:00:00Z', attendeeIds: [dv.id] });
      expect(m.status).toBe(403);
      const list = await call(dv, 'get', '/api/deals?pageSize=100');
      expect(list.body.items.map((d: { id: string }) => d.id)).not.toContain(dealId);
      await recordBothFacts(owner, dealId);
      expect((await cmd(dv, dealId, 'finalize')).body.code).toBe('PERMISSION_DENIED');
      expect((await cmd(owner, dealId, 'finalize')).status).toBe(200);
      const after = await getDeal(dv, dealId);
      expect(after.status).toBe(200);
      expect(after.body.deal.stage).toBe('closed');
      expect(after.body.access).toBe('context_limited');
    });
  });

  // -------------------------------------------------------------------------------------------
  // Remove fact, not proceeding, OQ-15 reopen (both branches)
  // -------------------------------------------------------------------------------------------
  describe('remove-fact, not-proceeding and OQ-15 reopen', () => {
    it('Owner removes a fact (reason, history kept, open review rejected); the Developer cannot', async () => {
      const { dealId } = await newDeal();
      await recordBothFacts(dv, dealId);
      await cmd(dv, dealId, 'closure-request');
      expect((await cmd(dv, dealId, 'remove-fact', { fact: 'payment', reason: 'Entered in error' })).body.code).toBe('PERMISSION_DENIED');
      const r = await cmd(owner, dealId, 'remove-fact', { fact: 'payment', reason: 'Entered in error' });
      expect(r.status).toBe(200);
      expect(r.body.deal.stage).toBe('signed');
      expect(r.body.deal.facts.payment).toBeNull();
      expect(r.body.deal.openClosureReview).toBeNull();
      const h = await call(owner, 'get', `/api/deals/${dealId}/history`);
      const removed = h.body.items.find((i: { type: string }) => i.type === 'fact_removed');
      expect(removed.before).toMatchObject({ paymentReference: 'PAY-1', stage: 'signed_and_paid' });
      expect(removed.reason).toBe('Entered in error');
      expect((await cmd(owner, dealId, 'remove-fact', { fact: 'payment', reason: 'Entered in error' })).status).toBe(200); // no-op
    });

    it('not-proceeding cancels the deal\'s Scheduled meetings through the outbox (reason "Deal not proceeding")', async () => {
      const { dealId } = await newDeal();
      const m = await call(cc, 'post', '/api/meetings', { dealId, title: 'Discovery', startsAt: '2030-02-01T10:00:00Z', attendeeIds: [cc.id, dv.id] });
      expect(m.status).toBe(201);
      const np = await cmd(dv, dealId, 'not-proceeding', { reason: 'Budget frozen' });
      expect(np.body.deal.stage).toBe('not_proceeding');
      expect(np.body.deal.notProceeding.reason).toBe('Budget frozen');
      expect(await outboxCount('deal.not_proceeding', dealId)).toBe(1);
      await relayAll();
      const after = await call(owner, 'get', `/api/meetings/${m.body.meeting.id}`);
      expect(after.body.meeting).toMatchObject({ status: 'cancelled', cancelReason: 'Deal not proceeding' });
      expect((await cmd(dv, dealId, 'not-proceeding', { reason: 'Budget frozen' })).status).toBe(403); // DV no longer reads it
      expect((await cmd(owner, dealId, 'not-proceeding', { reason: 'Budget frozen' })).status).toBe(200); // no-op
    });

    it('reopen, OQ-15 default accepted_opportunity: facts cleared, old values kept in deal_changes', async () => {
      const { dealId } = await newDeal();
      await cmd(dv, dealId, 'signature', { date: '2026-10-02', reference: 'AGR-9' });
      await cmd(dv, dealId, 'not-proceeding', { reason: 'Paused by client' });
      expect((await cmd(dv, dealId, 'reopen', { reason: 'Client is back' })).body.code).toBe('FORBIDDEN_ROLE');
      const r = await cmd(owner, dealId, 'reopen', { reason: 'Client is back' });
      expect(r.status).toBe(200);
      expect(r.body.deal.stage).toBe('accepted_opportunity');
      expect(r.body.deal.facts.signature).toBeNull();
      const { rows } = await query<{ before_value: { signatureReference: string }; after_value: { reopenTarget: string } }>(
        `SELECT before_value, after_value FROM deal_changes WHERE deal_id = $1 AND change_type = 'reopened'`,
        [dealId]
      );
      expect(rows[0].before_value.signatureReference).toBe('AGR-9');
      expect(rows[0].after_value.reopenTarget).toBe('accepted_opportunity');
      expect(await auditCount('deal.reopened', dealId)).toBe(1);
    });

    it('reopen, OQ-15 alternative previous_stage: the stage is rebuilt from the kept facts', async () => {
      policy({ reopenTarget: 'previous_stage' });
      const { dealId } = await newDeal();
      await cmd(dv, dealId, 'signature', { date: '2026-10-02', reference: 'AGR-10' });
      await cmd(owner, dealId, 'not-proceeding', { reason: 'Paused by client' });
      const r = await cmd(owner, dealId, 'reopen', { reason: 'Client is back' });
      expect(r.body.deal.stage).toBe('signed');
      expect(r.body.deal.facts.signature.reference).toBe('AGR-10');
    });

    it('reopen is refused while the business has another open deal (DEC-017); closed deals never reopen', async () => {
      const { businessId, dealId } = await newDeal();
      await cmd(owner, dealId, 'not-proceeding', { reason: 'Paused by client' });
      await acceptedDeal(businessId, cc, null);
      const r = await cmd(owner, dealId, 'reopen', { reason: 'Client is back' });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('CONFLICT_DUPLICATE');
      const { dealId: closed } = await closedDealWithProject();
      expect((await cmd(owner, closed, 'reopen', { reason: 'Client is back' })).body.code).toBe('STATE_CONFLICT');
    });

    it('DEC-018: an amount needs a configured currency list (409 POLICY_NOT_CONFIGURED while empty)', async () => {
      const { dealId } = await newDeal();
      const r = await cmd(dv, dealId, 'payment', { date: '2026-10-03', reference: 'DEP-1', amount: 100, currency: 'USD' });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('POLICY_NOT_CONFIGURED');
    });

    it('Call Center assigns a Developer on its business; leakage: another CC neither reads nor lists it', async () => {
      const { dealId } = await newDeal({ developer: null });
      const a = await cmd(cc, dealId, 'developer', { developerId: dv2.id });
      expect(a.status).toBe(200);
      expect(a.body.deal.assignedDeveloperId).toBe(dv2.id);
      expect(await outboxCount('opportunity.developer_assigned', dealId)).toBe(1);
      expect((await getDeal(cc2, dealId)).status).toBe(403);
      const l = await call(cc2, 'get', '/api/deals?pageSize=100');
      expect(l.body.items.map((d: { id: string }) => d.id)).not.toContain(dealId);
      expect((await getDeal(de, dealId)).body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  // -------------------------------------------------------------------------------------------
  // Meetings (SM-MEETING-001)
  // -------------------------------------------------------------------------------------------
  describe('meetings', () => {
    it('schedule, reschedule, held/missed guards, cancel; validation; deal listing', async () => {
      const { dealId } = await newDeal();
      const past = await call(cc, 'post', '/api/meetings', { dealId, startsAt: '2020-01-01T10:00:00Z', attendeeIds: [cc.id] });
      expect(past.status).toBe(400);
      const none = await call(cc, 'post', '/api/meetings', { dealId, startsAt: '2030-01-01T10:00:00Z', attendeeIds: [] });
      expect(none.status).toBe(400);
      const c = await call(dv, 'post', '/api/meetings', { dealId, title: 'Kickoff', startsAt: '2030-01-01T10:00:00Z', attendeeIds: [dv.id, cc.id] });
      expect(c.status).toBe(201);
      const m = c.body.meeting;
      expect(m).toMatchObject({ status: 'scheduled', upcoming: true, rescheduleCount: 0 });
      expect(m.attendees).toHaveLength(2);
      expect(await outboxCount('meeting.scheduled', m.id)).toBe(1);
      expect((await call(dv2, 'post', '/api/meetings', { dealId, startsAt: '2030-01-01T10:00:00Z', attendeeIds: [dv2.id] })).status).toBe(403);
      expect((await call(cc, 'post', `/api/meetings/${m.id}/held`, { version: m.version, discoveryNotes: 'n' })).body.code).toBe('STATE_CONFLICT');
      const rs = await call(cc, 'patch', `/api/meetings/${m.id}`, { version: m.version, startsAt: '2030-01-02T10:00:00Z', reason: 'Client asked' });
      expect(rs.status).toBe(200);
      expect(rs.body.meeting.rescheduleCount).toBe(1);
      expect(await outboxCount('meeting.rescheduled', m.id)).toBe(1);
      // Move the start into the past (test fixture) to record outcomes.
      await query(`UPDATE meetings SET starts_at = now() - interval '1 hour' WHERE id = $1`, [m.id]);
      const missed = await call(cc, 'post', `/api/meetings/${m.id}/missed`, { version: rs.body.meeting.version, note: 'No show' });
      expect(missed.body.meeting.status).toBe('missed');
      const back = await call(cc, 'patch', `/api/meetings/${m.id}`, { version: missed.body.meeting.version, startsAt: '2030-01-03T10:00:00Z' });
      expect(back.body.meeting).toMatchObject({ status: 'scheduled', rescheduleCount: 2 });
      await query(`UPDATE meetings SET starts_at = now() - interval '1 hour' WHERE id = $1`, [m.id]);
      const held = await call(dv, 'post', `/api/meetings/${m.id}/held`, { version: back.body.meeting.version, discoveryNotes: 'Wants online booking' });
      expect(held.body.meeting).toMatchObject({ status: 'held', discoveryNotes: 'Wants online booking' });
      expect((await call(dv, 'post', `/api/meetings/${m.id}/cancel`, { version: held.body.meeting.version, reason: 'late' })).body.code).toBe('STATE_CONFLICT');
      const byDeal = await call(owner, 'get', `/api/meetings?dealId=${dealId}`);
      expect(byDeal.body.items.map((x: { id: string }) => x.id)).toContain(m.id);
      expect((await call(owner, 'get', '/api/meetings')).status).toBe(400); // range or dealId required

      const c2 = await call(owner, 'post', '/api/meetings', { dealId, startsAt: '2030-03-01T10:00:00Z', attendeeIds: [owner.id] });
      expect((await call(owner, 'post', `/api/meetings/${c2.body.meeting.id}/cancel`, { version: 1 })).status).toBe(400); // reason required
      const cancel = await call(owner, 'post', `/api/meetings/${c2.body.meeting.id}/cancel`, { version: 1, reason: 'Client cancelled' });
      expect(cancel.body.meeting.status).toBe('cancelled');
      expect((await call(owner, 'post', `/api/meetings/${c2.body.meeting.id}/cancel`, { version: 1, reason: 'Client cancelled' })).status).toBe(200);
      const range = await call(cc, 'get', '/api/meetings?from=2030-02-15T00:00:00Z&to=2030-03-15T00:00:00Z');
      expect(range.body.items.map((x: { id: string }) => x.id)).toContain(c2.body.meeting.id);
      const leak = await call(cc2, 'get', '/api/meetings?from=2030-02-15T00:00:00Z&to=2030-03-15T00:00:00Z');
      expect(leak.body.items.map((x: { id: string }) => x.id)).not.toContain(c2.body.meeting.id);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Projects and tasks: transitions, reasons, P7 open-task warning, Completed read-only, reopen
  // -------------------------------------------------------------------------------------------
  describe('projects and tasks', () => {
    async function project(a: Agent, id: string) {
      return (await call(a, 'get', `/api/projects/${id}`)).body.project;
    }
    async function status(a: Agent, id: string, body: object) {
      const p = await project(owner, id);
      return call(a, 'post', `/api/projects/${id}/status`, { version: p.version, ...body });
    }

    it('assignment (Owner), Developer confinement, transitions with required notes, tasks, P7 warning, completed, reopen', async () => {
      const { projectId, dealId } = await closedDealWithProject();
      expect((await call(dv, 'get', `/api/projects/${projectId}`)).body.code).toBe('PERMISSION_DENIED'); // not yet assigned
      const asg = await call(owner, 'post', `/api/projects/${projectId}/developers`, { version: (await project(owner, projectId)).version, developerIds: [dv.id] });
      expect(asg.status).toBe(200);
      expect(asg.body.project.developers.map((d: { id: string }) => d.id)).toEqual([dv.id]);
      expect((await call(dv, 'get', `/api/projects/${projectId}`)).status).toBe(200);
      expect((await call(dv2, 'get', `/api/projects/${projectId}`)).status).toBe(403);
      const listDv2 = await call(dv2, 'get', '/api/projects?pageSize=100');
      expect(listDv2.body.items.map((p: { id: string }) => p.id)).not.toContain(projectId);
      const listDv = await call(dv, 'get', '/api/projects?scope=assigned_to_me&pageSize=100');
      expect(listDv.body.items.map((p: { id: string }) => p.id)).toContain(projectId);
      expect(listDv.body.workload).toMatchObject({ activeProjects: expect.any(Number) });

      expect((await status(dv, projectId, { to: 'delivered' })).body.code).toBe('STATE_CONFLICT');
      expect((await status(dv, projectId, { to: 'blocked' })).status).toBe(400); // note required
      const blocked = await status(dv, projectId, { to: 'blocked', note: 'Waiting on hosting access' });
      expect(blocked.body.project).toMatchObject({ status: 'blocked', statusNote: 'Waiting on hosting access' });
      expect((await status(dv, projectId, { to: 'in_progress' })).body.project.status).toBe('in_progress');

      const t1 = await call(dv, 'post', '/api/tasks', { projectId, title: 'Content upload', clientDependency: true, clientDependencyNote: 'Client sends copy' });
      expect(t1.status).toBe(201);
      expect(t1.body.task).toMatchObject({ status: 'todo', clientDependency: true });
      const t2 = await call(dv, 'post', '/api/tasks', { projectId, title: 'Build booking page', isMilestone: true });
      const done = await call(dv, 'patch', `/api/tasks/${t2.body.task.id}`, { version: 1, status: 'done' });
      expect(done.body.task.status).toBe('done');
      expect((await call(dv, 'patch', `/api/tasks/${t1.body.task.id}`, { version: 1, status: 'cancelled' })).status).toBe(400); // reason
      const reopenTask = await call(dv, 'patch', `/api/tasks/${t2.body.task.id}`, { version: done.body.task.version, status: 'in_progress' });
      expect(reopenTask.body.task.status).toBe('in_progress');
      const done2 = await call(dv, 'patch', `/api/tasks/${t2.body.task.id}`, { version: reopenTask.body.task.version, status: 'done' });
      expect(done2.body.task.status).toBe('done');

      // P7: Record delivered with 1 open task → warning, nothing changes.
      const tasksBefore = (await query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY id', [projectId])).rows;
      const before = await project(owner, projectId);
      const warn = await status(dv, projectId, { to: 'delivered' });
      expect(warn.status).toBe(422);
      expect(warn.body.code).toBe('RULE_VIOLATION');
      expect(warn.body.details).toMatchObject({
        code: 'OPEN_TASKS_WARNING',
        from: 'in_progress',
        to: 'delivered',
        openTaskCount: 1,
        openTasks: [{ id: t1.body.task.id, title: 'Content upload', status: 'todo', clientDependency: true }],
      });
      const unchanged = await project(owner, projectId);
      expect(unchanged).toMatchObject({ status: 'in_progress', version: before.version });
      // Confirmed: only the project row + history change; tasks and the deal are untouched.
      const dealBefore = (await getDeal(owner, dealId)).body.deal;
      const ok = await status(dv, projectId, { to: 'delivered', acknowledgeOpenTasks: true });
      expect(ok.status).toBe(200);
      expect(ok.body.project.status).toBe('delivered');
      expect(ok.body.project.taskCounts.open).toBe(1);
      expect((await query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY id', [projectId])).rows).toEqual(tasksBefore);
      expect((await getDeal(owner, dealId)).body.deal).toMatchObject({ stage: 'closed', version: dealBefore.version });
      const { rows: ch } = await query<{ open_task_count: number }>(
        `SELECT open_task_count FROM project_changes WHERE project_id = $1 AND change_type = 'status_changed' ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      );
      expect(ch[0].open_task_count).toBe(1);

      // Completed: same warning, then read-only; Owner reopen with reason.
      expect((await status(owner, projectId, { to: 'completed' })).body.details.code).toBe('OPEN_TASKS_WARNING');
      const completed = await status(owner, projectId, { to: 'completed', acknowledgeOpenTasks: true });
      expect(completed.body.project).toMatchObject({ status: 'completed', readOnly: true, allowedNextStatuses: [] });
      expect((await call(dv, 'post', '/api/tasks', { projectId, title: 'Late task' })).body.code).toBe('STATE_CONFLICT');
      expect((await call(dv, 'patch', `/api/tasks/${t1.body.task.id}`, { version: 1, title: 'x' })).body.code).toBe('STATE_CONFLICT');
      expect((await status(dv, projectId, { to: 'in_progress' })).body.code).toBe('STATE_CONFLICT');
      expect((await call(dv, 'post', `/api/projects/${projectId}/reopen`, { version: completed.body.project.version, reason: 'Rework' })).body.code).toBe('FORBIDDEN_ROLE');
      const re = await call(owner, 'post', `/api/projects/${projectId}/reopen`, { version: completed.body.project.version, reason: 'Client found a bug' });
      expect(re.body.project).toMatchObject({ status: 'in_progress', completedAt: null });
      expect(await auditCount('project.reopened', projectId)).toBe(1);
    });

    it('no warning when no task is open; cancelled task is final; tasks list', async () => {
      const { projectId } = await closedDealWithProject();
      await call(owner, 'post', `/api/projects/${projectId}/developers`, { version: (await project(owner, projectId)).version, developerIds: [dv.id, dv2.id] });
      await status(owner, projectId, { to: 'in_progress' });
      const t = await call(dv2, 'post', '/api/tasks', { projectId, title: 'Optional extra' });
      const cancelled = await call(dv2, 'patch', `/api/tasks/${t.body.task.id}`, { version: 1, status: 'cancelled', cancelReason: 'Out of scope' });
      expect(cancelled.body.task).toMatchObject({ status: 'cancelled', cancelReason: 'Out of scope', allowedNextStatuses: [] });
      expect((await call(dv2, 'patch', `/api/tasks/${t.body.task.id}`, { version: cancelled.body.task.version, status: 'todo' })).body.code).toBe('STATE_CONFLICT');
      const delivered = await status(dv, projectId, { to: 'delivered' });
      expect(delivered.status).toBe(200);
      expect(delivered.body.project.status).toBe('delivered');
      const tasks = await call(dv, 'get', `/api/tasks?projectId=${projectId}`);
      expect(tasks.body.items).toHaveLength(1);
      expect((await call(cc, 'get', `/api/tasks?projectId=${projectId}`)).body.code).toBe('FORBIDDEN_ROLE');
    });
  });
});
