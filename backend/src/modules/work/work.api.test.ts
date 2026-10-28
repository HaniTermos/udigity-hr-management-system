/**
 * MOD-work DB API tests (TEST_DATABASE_URL only).
 * Covers /api/targets and /api/work-items lifecycle, role permissions, and concurrency.
 */
import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { storeEnrolledSecret } from '../identity/twoFactor.js';

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
  const email = `work.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `Work ${role}`, role]
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

describe.skipIf(!hasTestDb)('MOD-work API (/api/targets & /api/work-items)', () => {
  let owner: Agent;
  let dev: Agent;
  let cc: Agent;

  beforeAll(async () => {
    owner = await ownerAgent();
    dev = await agentFor('developer');
    cc = await agentFor('call_center');
  });

  afterAll(async () => {
    // pool cleanup handled by global setup or test runner
  });

  it('Owner sets target for employee and reads it; employee reads own target', async () => {
    // Owner creates target for developer
    const res = await call(owner, 'post', '/api/targets', {
      employeeId: dev.id,
      metric: 'projects_completed',
      targetValue: 5,
      period: 'monthly',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    expect(res.status).toBe(201);
    expect(res.body.metric).toBe('projects_completed');
    expect(res.body.targetValue).toBe(5);
    const targetId = res.body.id;

    // Developer reads targets
    const devList = await call(dev, 'get', '/api/targets');
    expect(devList.status).toBe(200);
    expect(devList.body.items.some((t: { id: string }) => t.id === targetId)).toBe(true);

    // Call Center agent does not see dev target
    const ccList = await call(cc, 'get', '/api/targets');
    expect(ccList.status).toBe(200);
    expect(ccList.body.items.some((t: { id: string }) => t.id === targetId)).toBe(false);

    // Owner updates target
    const updateRes = await call(owner, 'patch', `/api/targets/${targetId}`, {
      targetValue: 8,
      version: res.body.version,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.targetValue).toBe(8);
  });

  it('Manages work items (create, list, patch status)', async () => {
    // Create work item
    const res = await call(owner, 'post', '/api/work-items', {
      title: 'Review production logs',
      description: 'Check background worker and health checks',
      assigneeId: dev.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Review production logs');
    expect(res.body.status).toBe('open');
    const itemId = res.body.id;

    // List work items
    const list = await call(dev, 'get', '/api/work-items');
    expect(list.status).toBe(200);
    expect(list.body.items.some((i: { id: string }) => i.id === itemId)).toBe(true);

    // Patch status
    const patchRes = await call(dev, 'patch', `/api/work-items/${itemId}`, {
      status: 'in_progress',
      version: res.body.version,
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe('in_progress');
  });

  // R2-03 (security review): PATCH /work-items/:id is limited to the assignee or the Owner.
  describe('R2-03 work-item access', () => {
    let de: Agent;
    beforeAll(async () => {
      de = await agentFor('data_entry');
    });

    async function newItem(assigneeId: string) {
      const r = await call(owner, 'post', '/api/work-items', { title: `R2-03 ${uniq()}`, assigneeId });
      expect(r.status).toBe(201);
      return r.body as { id: string; version: number };
    }

    it('role matrix: list = every role; create = Owner only (others 403 FORBIDDEN_ROLE)', async () => {
      for (const a of [owner, dev, cc, de]) expect((await call(a, 'get', '/api/work-items')).status).toBe(200);
      for (const a of [dev, cc, de]) {
        const r = await call(a, 'post', '/api/work-items', { title: 'x', assigneeId: a.id });
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('another role cannot read or patch an item that is not theirs: 404 with no data; nothing changes', async () => {
      const item = await newItem(dev.id);
      for (const a of [cc, de]) {
        const r = await call(a, 'patch', `/api/work-items/${item.id}`, { status: 'completed', version: item.version });
        expect(r.status).toBe(404);
        expect(Object.keys(r.body).sort()).toEqual(expect.not.arrayContaining(['id', 'title', 'details']));
        const list = await call(a, 'get', '/api/work-items');
        expect(list.body.items.some((i: { id: string }) => i.id === item.id)).toBe(false);
      }
      const { rows } = await query<{ status: string; version: number }>('SELECT status, version FROM work_items WHERE id = $1', [item.id]);
      expect(rows[0]).toEqual({ status: 'open', version: item.version });
    });

    it('the assignee and the Owner may patch; each change is audited in the same transaction', async () => {
      const item = await newItem(dev.id);
      const created = await query('SELECT 1 FROM audit_events WHERE event_name = $1 AND entity_id = $2', ['work_item.created', item.id]);
      expect(created.rowCount).toBe(1);
      const mine = await call(dev, 'patch', `/api/work-items/${item.id}`, { status: 'in_progress', version: item.version });
      expect(mine.status).toBe(200);
      const byOwner = await call(owner, 'patch', `/api/work-items/${item.id}`, { status: 'completed', version: mine.body.version });
      expect(byOwner.status).toBe(200);
      const { rows } = await query<{ actor_id: string }>(
        'SELECT actor_id FROM audit_events WHERE event_name = $1 AND entity_id = $2 ORDER BY created_at, id',
        ['work_item.updated', item.id]
      );
      expect(rows.map((r) => r.actor_id)).toEqual([dev.id, owner.id]);
    });

    it('stale version → 409 VERSION_CONFLICT with details.current (BL-09)', async () => {
      const item = await newItem(dev.id);
      await call(dev, 'patch', `/api/work-items/${item.id}`, { status: 'in_progress', version: item.version });
      const stale = await call(dev, 'patch', `/api/work-items/${item.id}`, { status: 'completed', version: item.version });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('VERSION_CONFLICT');
      expect(stale.body.details.current).toMatchObject({ id: item.id, status: 'in_progress', version: item.version + 1 });
    });
  });
});
