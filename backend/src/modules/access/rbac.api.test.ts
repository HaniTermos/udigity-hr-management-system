/**
 * Custom roles (migration 014) — TURNED OFF in v1. API contract on the Docker test DB.
 *
 * Fixed v1 scope (docs/policy-baseline-2026-10-29.md, approved): four roles (Owner, Data Entry, Call Center,
 * Developer), no custom-role management. The custom_roles / role_permissions data is KEPT, the feature is off.
 *
 * Changed expectations: this suite used to prove that the Owner could create custom roles and that their grants
 * opened access. It now proves the refusals: role create/update/delete is allowed to nobody, employees can only
 * be created or updated with one of the four roles (service + migration 993 CHECK), a stored custom-role grant
 * is never honoured, the system roles are never widened, and the seeds create no custom-role employee.
 * The grant-semantics tests (catalog grantability, data_scope listing, cache reload, IC-16 versions, delete
 * rules) have no v1 equivalent and are skipped below with that reason.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { dynamicRoleCache } from './dynamicService.js';

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
function call(a: Pick<Agent, 'cookie' | 'csrf'>, method: Method, path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
  return body ? r.send(body) : r;
}

async function employee(role: string): Promise<Agent> {
  const email = `${role.replace(/[^a-z0-9]/g, '')}.${uniq()}@udigity.demo`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `Test ${role}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  const l = await login(email);
  expect(l.res.status).toBe(200);
  return { cookie: l.cookie, csrf: l.csrf, id: rows[0].id, email };
}

describe.skipIf(!hasTestDb)('Custom roles are off in v1 (fixed four roles)', () => {
  let owner: Agent;
  let dataEntry: Agent;
  const roleId = `hr_${Date.now().toString(36)}`;

  beforeAll(async () => {
    await query(
      `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL
       WHERE employee_id = (SELECT id FROM employees WHERE LOWER(email) = LOWER($1))`,
      [SEED_OWNER]
    );
    const step1 = await login(SEED_OWNER);
    expect(step1.res.status).toBe(200);
    const step2 = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', step1.cookie)
      .set('X-CSRF-Token', step1.csrf)
      .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
    expect(step2.status).toBe(200);
    const { rows } = await query<{ id: string }>('SELECT id FROM employees WHERE LOWER(email) = LOWER($1)', [SEED_OWNER]);
    owner = { cookie: cookieFrom(step2), csrf: step2.body.csrfToken as string, id: rows[0].id, email: SEED_OWNER };
    dataEntry = await employee('data_entry');
    // A kept custom-role row from before v1 (data is not dropped): it must stay unusable.
    await query(`INSERT INTO custom_roles (id, name, is_system) VALUES ($1, 'Legacy HR', false) ON CONFLICT (id) DO NOTHING`, [roleId]);
    await query(`INSERT INTO role_permissions (role_id, action, data_scope) VALUES ($1, 'business.read', 'global') ON CONFLICT DO NOTHING`, [roleId]);
  });

  it('role create / update / delete are refused for the Owner (allowed to nobody)', async () => {
    const create = await call(owner, 'post', '/api/access/roles', { id: `x_${uniq().replace(/\W/g, '')}`, name: 'X', permissions: [] });
    expect(create.status).toBe(403);
    expect(create.body.code).toBe('FORBIDDEN_ROLE');
    expect((await call(owner, 'patch', `/api/access/roles/${roleId}`, { name: 'Y', permissions: [] })).body.code).toBe('FORBIDDEN_ROLE');
    expect((await call(owner, 'delete', `/api/access/roles/${roleId}`)).body.code).toBe('FORBIDDEN_ROLE');
    for (const a of [dataEntry]) expect((await call(a, 'post', '/api/access/roles', { id: 'z', name: 'Z', permissions: [] })).status).toBe(403);
    const { rows } = await query<{ n: number }>('SELECT count(*)::int AS n FROM custom_roles WHERE id = $1', [roleId]);
    expect(rows[0].n).toBe(1); // kept, not dropped
  });

  it('employee create / update accept only owner, data_entry, call_center, developer', async () => {
    const bad = await call(owner, 'post', '/api/employees', { email: `hr.${uniq()}@udigity.demo`, fullName: 'HR Person', role: roleId });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
    expect(bad.body.details).toHaveProperty('role');
    const ok = await call(owner, 'post', '/api/employees', { email: `cc.${uniq()}@udigity.demo`, fullName: 'CC Person', role: 'call_center' });
    expect(ok.status).toBe(201);
    const upd = await call(owner, 'patch', `/api/employees/${ok.body.id ?? ok.body.employee?.id}`, { version: ok.body.version ?? ok.body.employee?.version, role: roleId });
    expect(upd.status).toBe(400);
    expect(upd.body.details).toHaveProperty('role');
  });

  it('migration 993: the database refuses a new employee row with a custom role (CHECK ... NOT VALID)', async () => {
    await expect(
      query(`INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'x', $2, true)`, [`db.${uniq()}@udigity.demo`, roleId])
    ).rejects.toMatchObject({ code: '23514', constraint: 'employees_role_v1_check' });
    const { rows } = await query<{ convalidated: boolean }>(`SELECT convalidated FROM pg_constraint WHERE conname = 'employees_role_v1_check'`);
    expect(rows).toEqual([{ convalidated: false }]);
  });

  it('a stored custom-role grant is never honoured, and the four system roles are never widened', async () => {
    await query(`INSERT INTO role_permissions (role_id, action, data_scope) VALUES ('data_entry', 'employee.list', 'global') ON CONFLICT DO NOTHING`);
    try {
      await dynamicRoleCache.reload(pool);
      expect(dynamicRoleCache.grantFor('data_entry', 'employee.list')).toBeNull();
      const r = await call(dataEntry, 'get', '/api/employees');
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('FORBIDDEN_ROLE');
    } finally {
      await query(`DELETE FROM role_permissions WHERE role_id = 'data_entry'`);
      await dynamicRoleCache.reload(pool);
    }
  });

  it('the seeds create no custom-role employee (seed.ts roles are the four v1 roles)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../db/seed.ts', import.meta.url)), 'utf8');
    const roles = new Set([...src.matchAll(/\brole: '([a-z_]+)'/g)].map((m) => m[1]));
    expect(roles.size).toBeGreaterThan(0);
    for (const r of roles) expect(['owner', 'data_entry', 'call_center', 'developer']).toContain(r);
    expect(src).not.toMatch(/custom_roles|role_permissions/);
  });
});

describe.skip('v1-disabled: custom-role grant semantics (catalog grantability, data_scope lists, cache reload, IC-16 versions, delete rules) — custom roles are not part of v1', () => {
  it('kept for a future, explicitly approved re-enablement', () => {});
});
