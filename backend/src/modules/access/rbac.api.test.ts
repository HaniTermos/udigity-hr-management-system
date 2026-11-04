/**
 * Custom roles (migration 014; authz-matrix.md §3.11) — API contract on the Docker test DB.
 *
 * Proves: the catalog says what is grantable; grants are validated against the matrix (unknown,
 * nobody and unmarked admin rows are refused); a custom role holds nothing but its grants; grantable
 * admin rows still need the holder's second factor; `data_scope` is enforced by the engine; the four
 * system roles are never widened by `role_permissions`; the grant cache is loaded from the database
 * (restart) and changes only after commit; permission updates end the holders' sessions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { DynamicRoleCache, dynamicRoleCache } from './dynamicService.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const SEED_OWNER = 'udigity@gmail.com';
const ZERO = '00000000-0000-0000-0000-000000000000';

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

async function employee(role: string, department: string | null = null): Promise<Agent> {
  const email = `${role.replace(/[^a-z0-9]/g, '')}.${uniq()}@udigity.demo`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, department, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [email, `Test ${role}`, role, department]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  const l = await login(email);
  expect(l.res.status).toBe(200);
  return { cookie: l.cookie, csrf: l.csrf, id: rows[0].id, email };
}

describe.skipIf(!hasTestDb)('Custom roles (migration 014, matrix §3.11)', () => {
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
  });

  it('catalog: Owner only; every matrix action with its grantability (admin rows only when marked)', async () => {
    expect((await request(app).get('/api/access/permissions')).status).toBe(401);
    const denied = await call(dataEntry, 'get', '/api/access/permissions');
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('FORBIDDEN_ROLE');

    const res = await call(owner, 'get', '/api/access/permissions');
    expect(res.status).toBe(200);
    const byAction = new Map<string, { requiresAdmin: boolean; grantable: boolean; allowedScopes: string[]; module: string }>(
      res.body.permissions.map((p: { action: string }) => [p.action, p])
    );
    expect(byAction.size).toBeGreaterThan(40);
    expect(byAction.get('role.create')).toMatchObject({ module: 'Role & Permissions', requiresAdmin: true, grantable: false, allowedScopes: [] });
    expect(byAction.get('employee.create')).toMatchObject({ requiresAdmin: true, grantable: false });
    expect(byAction.get('business.delete')).toMatchObject({ grantable: false });
    expect(byAction.get('business.read')).toMatchObject({ requiresAdmin: false, grantable: true });
    expect(byAction.get('business.read')?.allowedScopes).toEqual(['self', 'department', 'global', 'assigned_only']);
    // Review 2026-11-04 E-02 / S-26: the former §3.11 grantable admin rows are Owner-only.
    for (const a of ['employee.list', 'employee.read', 'employee.read_open_items', 'attendance.correction.review', 'attendance.adjust',
      'attendance.retroactive_create', 'attendance.remote_exception.grant', 'attendance.failed_checkout.review', 'attendance.overview.read']) {
      expect(byAction.get(a), a).toMatchObject({ requiresAdmin: true, grantable: false, allowedScopes: [] });
    }
  });

  it('system roles are listed and described by the matrix, never by role_permissions', async () => {
    const list = await call(owner, 'get', '/api/access/roles');
    expect(list.status).toBe(200);
    const ids = list.body.roles.map((r: { id: string }) => r.id);
    for (const id of ['owner', 'call_center', 'data_entry', 'developer']) expect(ids).toContain(id);

    const cc = await call(owner, 'get', '/api/access/roles/call_center');
    expect(cc.status).toBe(200);
    expect(cc.body.role.isSystem).toBe(true);
    const actions = cc.body.role.permissions.map((p: { action: string }) => p.action);
    expect(actions).toContain('calling.queue.read');
    expect(actions).not.toContain('employee.list');
  });

  it('grants are validated against the matrix: unknown, nobody and unmarked admin rows are refused (400, nothing written)', async () => {
    const attempt = (permissions: object[]) => call(owner, 'post', '/api/access/roles', { id: roleId, name: 'HR', permissions });
    for (const [action, why] of [
      ['nope.action', /not an action/],
      ['business.delete', /nobody/],
      ['employee.create', /Owner-only administrative/],
      ['role.update', /Owner-only administrative/],
      ['settings.update', /Owner-only administrative/],
      ['audit.read', /Owner-only administrative/],
    ] as const) {
      const r = await attempt([{ action: 'business.read' }, { action }]);
      expect(r.status, action).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(r.body.details.grants)).toMatch(why);
    }
    expect((await attempt([{ action: 'not a name' }])).status).toBe(400);
    expect((await attempt([{ action: 'business.read' }, { action: 'business.read', dataScope: 'self' }])).status).toBe(400); // duplicate
    expect((await attempt([{ action: 'business.read', dataScope: 'everything' }])).status).toBe(400);
    const { rows } = await query('SELECT 1 FROM custom_roles WHERE id = $1', [roleId]);
    expect(rows).toHaveLength(0);
    for (const id of ['owner', 'data_entry', 'call_center', 'developer']) {
      expect((await call(owner, 'post', '/api/access/roles', { id, name: 'X', permissions: [] })).status).toBe(400);
    }
  });

  it('S-26 (E-02): an Owner-only admin row is refused on create (400), whatever the scope', async () => {
    for (const action of ['attendance.overview.read', 'employee.list', 'attendance.adjust']) {
      const r = await call(owner, 'post', '/api/access/roles', { id: `x_${uniq().replace(/\W/g, '')}`, name: 'X', permissions: [{ action, dataScope: 'global' }] });
      expect(r.status, action).toBe(400);
    }
  });

  it('creates a custom role with validated grants; duplicate id → 409', async () => {
    const res = await call(owner, 'post', '/api/access/roles', {
      id: roleId,
      name: 'Human Resources',
      description: 'Attendance review and own-created directory records.',
      permissions: [
        { action: 'business.list', dataScope: 'self' },
        { action: 'business.read', dataScope: 'self' },
        { action: 'deal.read', dataScope: 'global' },
        { action: 'attendance.read', dataScope: 'department' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toMatchObject({ id: roleId, isSystem: false });
    expect(res.body.role.permissions).toHaveLength(4);
    expect(dynamicRoleCache.grantFor(roleId, 'business.list')).toBe('self');

    const dup = await call(owner, 'post', '/api/access/roles', { id: roleId, name: 'Again', permissions: [] });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('CONFLICT_DUPLICATE');
    const audit = await query(`SELECT 1 FROM audit_events WHERE event_name = 'role.created' AND entity_id = $1`, [roleId]);
    expect(audit.rows).toHaveLength(1);
  });

  it('a holder gets exactly its grants: non-granted → FORBIDDEN_ROLE; granted → through; a stored Owner-only row is ignored', async () => {
    const hr = await employee(roleId);
    const me = await call(hr, 'get', '/api/auth/me');
    expect(me.status).toBe(200);

    expect((await call(hr, 'get', '/api/access/roles')).body.code).toBe('FORBIDDEN_ROLE');
    expect((await call(hr, 'get', '/api/employees')).body.code).toBe('FORBIDDEN_ROLE'); // admin, not granted
    expect((await call(hr, 'get', '/api/search?q=anything')).body.code).toBe('FORBIDDEN_ROLE'); // not granted
    expect((await call(hr, 'get', `/api/deals/${ZERO}`)).status).toBe(404); // granted: past the role gate

    // E-02 / S-26: an Owner-only row stored before the fix (written directly here) is ignored at check
    // time: the cache drops it at load and the route answers FORBIDDEN_ROLE.
    await query(`INSERT INTO role_permissions (role_id, action, data_scope) VALUES ($1, 'attendance.overview.read', 'global') ON CONFLICT DO NOTHING`, [roleId]);
    await dynamicRoleCache.reload();
    expect(dynamicRoleCache.grantFor(roleId, 'attendance.overview.read')).toBeNull();
    const overview = await call(hr, 'get', '/api/attendance/overview');
    expect(overview.status).toBe(403);
    expect(overview.body.code).toBe('FORBIDDEN_ROLE');
    await query(`DELETE FROM role_permissions WHERE role_id = $1 AND action = 'attendance.overview.read'`, [roleId]);
  });

  it('data_scope is enforced by the engine: `self` lists own-created businesses only; `global` lists every visible one', async () => {
    const hr = await employee(roleId);
    // Letters only: `q` also matches phone digits (3+ digits in the term), so a base36 tag with digits
    // could match some other business's phone and inflate the count (UDI-10 flake).
    const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
    const tag = `rbac${letters(10)}`;
    const biz = async (createdBy: string) => {
      const name = `${tag}${letters(4)}`;
      const { rows } = await query<{ id: string }>(
        `INSERT INTO businesses (name, normalized_name, name_key, created_by)
         VALUES ($1::varchar, lower($1::varchar), lower($1::varchar), $2::uuid) RETURNING id`,
        [name, createdBy]
      );
      return rows[0].id;
    };
    const mine = await biz(hr.id);
    const theirs = await biz(dataEntry.id);

    const list = await call(hr, 'get', `/api/businesses?q=${encodeURIComponent(tag)}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items.map((b: { id: string }) => b.id)).toEqual([mine]);
    expect((await call(hr, 'get', `/api/businesses/${mine}`)).status).toBe(200);
    const foreign = await call(hr, 'get', `/api/businesses/${theirs}`);
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe('PERMISSION_DENIED');
    expect(foreign.body.name).toBeUndefined();

    // Widen to global: the holders' sessions end (re-login), then both rows are visible.
    const upd = await call(owner, 'patch', `/api/access/roles/${roleId}`, {
      permissions: [
        { action: 'business.list', dataScope: 'global' },
        { action: 'business.read', dataScope: 'global' },
        { action: 'deal.read', dataScope: 'global' },
      ],
    });
    expect(upd.status).toBe(200);
    expect((await call(hr, 'get', '/api/auth/me')).status).toBe(401);
    const again = await login(hr.email);
    const list2 = await call({ cookie: again.cookie, csrf: again.csrf }, 'get', `/api/businesses?q=${encodeURIComponent(tag)}`);
    expect(list2.body.total).toBe(2);
    expect((await call({ cookie: again.cookie, csrf: again.csrf }, 'get', `/api/businesses/${theirs}`)).status).toBe(200);
    // Owner decision 2026-10-29: even a `global` grant does not bypass the elapsed 15-day window or archiving.
    const holder = { cookie: again.cookie, csrf: again.csrf };
    const old = await biz(dataEntry.id);
    await query(`UPDATE businesses SET created_at = now() - interval '15 days 1 minute' WHERE id = $1`, [old]);
    const archived = await biz(dataEntry.id);
    await query(`UPDATE businesses SET archived_at = now(), archived_by = $2 WHERE id = $1`, [archived, owner.id]);
    expect((await call(holder, 'get', `/api/businesses/${old}`)).body.code).toBe('HIDDEN_BY_POLICY');
    expect((await call(holder, 'get', `/api/businesses/${archived}`)).status).toBe(404);
    const list3 = await call(holder, 'get', `/api/businesses?q=${encodeURIComponent(tag)}`);
    expect(list3.body.items.map((b: { id: string }) => b.id).sort()).toEqual([mine, theirs].sort());
    // Dropped grant → gone at once.
    expect((await call({ cookie: again.cookie, csrf: again.csrf }, 'get', '/api/attendance/overview')).body.code).toBe('FORBIDDEN_ROLE');
  });

  it('IC-16: every committed change bumps version; a stale version → 409 VERSION_CONFLICT { currentVersion }', async () => {
    const r0 = await call(owner, 'get', `/api/access/roles/${roleId}`);
    const v = r0.body.role.version as number;
    expect(v).toBeGreaterThanOrEqual(2); // created at 1, bumped by the permissions update above
    const stale = await call(owner, 'patch', `/api/access/roles/${roleId}`, { version: v - 1, name: 'Stale' });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
    expect(stale.body.details.currentVersion).toBe(v);
    const ok = await call(owner, 'patch', `/api/access/roles/${roleId}`, { version: v, name: 'Human Resources (v2)' });
    expect(ok.status).toBe(200);
    expect(ok.body.role.version).toBe(v + 1);
    const list = await call(owner, 'get', '/api/access/roles');
    expect(list.body.roles.find((r: { id: string }) => r.id === roleId).version).toBe(v + 1);
  });

  it('the four system roles are never widened by role_permissions', async () => {
    await query(`INSERT INTO role_permissions (role_id, action, data_scope) VALUES ('data_entry', 'employee.list', 'global') ON CONFLICT DO NOTHING`);
    try {
      await dynamicRoleCache.reload(pool);
      expect(dynamicRoleCache.grantFor('data_entry', 'employee.list')).toBeNull();
      const r = await call(dataEntry, 'get', '/api/employees');
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('FORBIDDEN_ROLE');
      const upd = await call(owner, 'patch', '/api/access/roles/data_entry', { permissions: [{ action: 'business.read' }] });
      expect(upd.status).toBe(400);
    } finally {
      await query(`DELETE FROM role_permissions WHERE role_id = 'data_entry'`);
      await dynamicRoleCache.reload(pool);
    }
  });

  it('cache: a refused update leaves the committed grants (no phantom grants); a fresh process loads them from the database', async () => {
    const before = await query<{ action: string }>('SELECT action FROM role_permissions WHERE role_id = $1 ORDER BY action', [roleId]);
    const refused = await call(owner, 'patch', `/api/access/roles/${roleId}`, {
      permissions: [{ action: 'business.read' }, { action: 'employee.update' }],
    });
    expect(refused.status).toBe(400);
    const after = await query<{ action: string }>('SELECT action FROM role_permissions WHERE role_id = $1 ORDER BY action', [roleId]);
    expect(after.rows).toEqual(before.rows);
    expect(dynamicRoleCache.grantFor(roleId, 'employee.update')).toBeNull();
    expect(dynamicRoleCache.grantFor(roleId, 'deal.read')).toBe('global');

    const fresh = new DynamicRoleCache();
    expect(fresh.isLoaded()).toBe(false);
    fresh.attach(pool);
    await fresh.ensureReady();
    expect(fresh.grantFor(roleId, 'deal.read')).toBe('global');
    expect(fresh.grantFor(roleId, 'attendance.overview.read')).toBeNull();
    expect(fresh.grantFor('call_center', 'calling.queue.read')).toBeNull(); // system roles are matrix-only
  });

  // Changed expectation (D20, no hard deletes): "delete" deactivates. The row and its permissions are kept; the
  // role disappears from the list/detail, cannot be assigned, and its grants are no longer honoured.
  it('delete = deactivate: system roles never; held roles 409 with a clear message; then 204, hidden, kept, unassignable', async () => {
    expect((await call(owner, 'delete', '/api/access/roles/call_center')).status).toBe(400);
    const assigned = await call(owner, 'delete', `/api/access/roles/${roleId}`);
    expect(assigned.status).toBe(409);
    expect(assigned.body.code).toBe('STATE_CONFLICT');
    expect(assigned.body.error).toMatch(/still held by \d+ employee/);
    await query(`UPDATE employees SET role = 'data_entry' WHERE role = $1`, [roleId]);
    expect((await call(owner, 'delete', `/api/access/roles/${roleId}`)).status).toBe(204);
    expect((await call(owner, 'get', `/api/access/roles/${roleId}`)).status).toBe(404);
    expect((await call(owner, 'get', '/api/access/roles')).body.roles.map((r: { id: string }) => r.id)).not.toContain(roleId);
    expect(dynamicRoleCache.grantFor(roleId, 'deal.read')).toBeNull();
    const { rows } = await query<{ deactivated: boolean; perms: number }>(
      `SELECT r.deactivated_at IS NOT NULL AS deactivated, (SELECT count(*)::int FROM role_permissions p WHERE p.role_id = r.id) AS perms
         FROM custom_roles r WHERE r.id = $1`,
      [roleId]
    );
    expect(rows[0].deactivated).toBe(true);
    expect(rows[0].perms).toBeGreaterThan(0);
    const reuse = await call(owner, 'post', '/api/employees', { email: `gone.${uniq()}@udigity.demo`, fullName: 'Gone Role', role: roleId });
    expect(reuse.status).toBe(400);
    expect(reuse.body.details).toHaveProperty('role');
  });

  it('employees: create/update accept an existing custom role and the four system roles; an unknown role is refused', async () => {
    const id = `ops_${Date.now().toString(36)}`;
    expect((await call(owner, 'post', '/api/access/roles', { id, name: 'Operations', permissions: [{ action: 'attendance.read', dataScope: 'self' }] })).status).toBe(201);
    const made = await call(owner, 'post', '/api/employees', { email: `ops.${uniq()}@udigity.demo`, fullName: 'Ops Person', role: id });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(made.body.role).toBe(id);
    const sys = await call(owner, 'patch', `/api/employees/${made.body.id}`, { version: made.body.version, role: 'developer' });
    expect(sys.status).toBe(200);
    const bad = await call(owner, 'post', '/api/employees', { email: `bad.${uniq()}@udigity.demo`, fullName: 'Bad Role', role: 'no_such_role' });
    expect(bad.status).toBe(400);
    expect(bad.body.details).toHaveProperty('role');
  });
});
