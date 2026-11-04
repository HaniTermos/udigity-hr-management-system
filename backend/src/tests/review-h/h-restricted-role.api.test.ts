/**
 * Review 2026-11-04, agent H: D-01 / D-02 end to end under a REAL restricted login.
 *
 * Every other DB test connects as the test superuser (only `runtimeRole.test.ts` probes `SET ROLE
 * udigity_app` inside a rolled-back transaction), so no API path was ever exercised under the least-privilege
 * grants of migration 998. This file creates a LOGIN role exactly like devops/postgres/init/10-app-role.sh
 * (member of `udigity_app`, NOSUPERUSER, grants re-applied by `udigity_apply_app_grants()`), points the app
 * at it and drives the main write paths through HTTP and the worker functions, then probes that DELETE /
 * UPDATE on history tables are refused for that same connection.
 */
import crypto from 'crypto';
import pg from 'pg';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? '';
const LOGIN = 'udigity_api_h_review';
const LOGIN_PW = crypto.randomBytes(18).toString('base64url');
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
const phone = () => ({ countryCode: '+961', number: `7${Math.floor(1_000_000 + Math.random() * 8_999_999)}` });

/** The SQL block of devops/postgres/init/10-app-role.sh for an existing database, for login LOGIN. */
async function createRestrictedLogin(admin: pg.Client): Promise<void> {
  await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') THEN CREATE ROLE udigity_app NOLOGIN NOINHERIT; END IF; END $$`);
  await admin.query('ALTER ROLE udigity_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
  await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${LOGIN}') THEN CREATE ROLE ${LOGIN} LOGIN; END IF; END $$`);
  await admin.query(`ALTER ROLE ${LOGIN} LOGIN PASSWORD '${LOGIN_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT`);
  await admin.query(`GRANT udigity_app TO ${LOGIN}`);
  await admin.query('GRANT USAGE ON SCHEMA public TO udigity_app');
  await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO udigity_app');
  await admin.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO udigity_app');
  await admin.query('REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM udigity_app');
  await admin.query('GRANT SELECT, INSERT ON audit_events TO udigity_app');
  await admin.query('REVOKE INSERT, UPDATE, DELETE ON schema_migrations FROM udigity_app');
  await admin.query('SELECT public.udigity_apply_app_grants()');
  const db = (await admin.query<{ d: string }>('SELECT current_database() AS d')).rows[0].d;
  await admin.query(`GRANT CONNECT ON DATABASE "${db}" TO udigity_app`);
  await admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE DELETE, TRUNCATE ON TABLES FROM udigity_app');
  await admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO udigity_app');
  await admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO udigity_app');
}

function restrictedUrl(): string {
  const u = new URL(ADMIN_URL);
  u.username = LOGIN;
  u.password = LOGIN_PW;
  return u.toString();
}

type Mods = {
  app: typeof import('../../app.js').app;
  pool: typeof import('../../db/pool.js').pool;
  query: typeof import('../../db/pool.js').query;
  config: typeof import('../../config/index.js').config;
  clock: typeof import('../../modules/platform/clock.js').clock;
  relayOutboxOnce: typeof import('../../modules/platform/service.js').relayOutboxOnce;
  retentionPurge: typeof import('../../modules/platform/retention.js').retentionPurge;
  cleanupSessions: typeof import('../../modules/platform/retention.js').cleanupSessions;
  dispatchDueDeliveries: typeof import('../../modules/notifications/service.js').dispatchDueDeliveries;
  setAttendanceFlagOverridesForTests: typeof import('../../modules/attendance/service.js').setAttendanceFlagOverridesForTests;
};

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
}

describe.skipIf(!hasTestDb)('H: D-01/D-02 app paths under a real restricted login (10-app-role.sh + migration 998)', { timeout: 180_000 }, () => {
  let admin: pg.Client;
  let m: Mods;
  let owner: Agent;
  let de: Agent;
  let cc: Agent;
  let dv: Agent;

  const cookieFrom = (res: request.Response) =>
    (([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${m.config.session.cookieName}=`)) ?? '').split(';')[0];
  const call = (a: Agent, method: 'get' | 'post' | 'patch' | 'put', path: string, body?: object) => {
    const r = request(m.app)[method](path).set('Cookie', a.cookie);
    if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
    return body ? r.send(body) : r;
  };
  /** Accounts are created by the admin connection (test setup only); everything after goes through the app. */
  async function account(role: string): Promise<{ id: string; email: string }> {
    const email = `h.rr.${role}.${uniq()}@test.local`;
    const { rows } = await admin.query<{ id: string }>(`INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`, [email, `HRR ${role}`, role]);
    await admin.query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
    return { id: rows[0].id, email };
  }
  async function signIn(role: string): Promise<Agent> {
    const e = await account(role);
    const r = await request(m.app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: e.email, password: PASSWORD });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return { cookie: cookieFrom(r), csrf: r.body.csrfToken, id: e.id };
  }
  const ver = async (table: string, id: string) => (await m.query<{ version: number }>(`SELECT version FROM ${table} WHERE id = $1`, [id])).rows[0].version;
  async function relayAll() {
    for (let i = 0; i < 500; i++) if ((await m.relayOutboxOnce()).claimed === 0) break;
  }
  async function refusedCode(sql: string): Promise<string | null> {
    try {
      await m.query(sql);
      return null;
    } catch (e) {
      return (e as { code?: string }).code ?? 'unknown';
    }
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await createRestrictedLogin(admin);
    process.env.TEST_DATABASE_URL = restrictedUrl(); // config honours only TEST_DATABASE_URL in tests
    const [{ app }, poolMod, { config }, { clock }, platform, retention, notif, att] = await Promise.all([
      import('../../app.js'),
      import('../../db/pool.js'),
      import('../../config/index.js'),
      import('../../modules/platform/clock.js'),
      import('../../modules/platform/service.js'),
      import('../../modules/platform/retention.js'),
      import('../../modules/notifications/service.js'),
      import('../../modules/attendance/service.js'),
    ]);
    m = {
      app, pool: poolMod.pool, query: poolMod.query, config, clock,
      relayOutboxOnce: platform.relayOutboxOnce, retentionPurge: retention.retentionPurge, cleanupSessions: retention.cleanupSessions,
      dispatchDueDeliveries: notif.dispatchDueDeliveries, setAttendanceFlagOverridesForTests: att.setAttendanceFlagOverridesForTests,
    };
    const who = await m.query<{ u: string; su: boolean }>(`SELECT current_user AS u, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su`);
    expect(who.rows[0]).toEqual({ u: LOGIN, su: false });

    // Owner with an enrolled factor (secret stored through the app's own code path, as the restricted login).
    const o = await account('owner');
    const { withTransaction } = await import('../../db/pool.js');
    const { storeEnrolledSecret } = await import('../../modules/identity/twoFactor.js');
    const { DEV_TOTP_SECRET } = await import('../../db/seed.js');
    await withTransaction((tx) => storeEnrolledSecret(tx, o.id, DEV_TOTP_SECRET));
    const s = await request(m.app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: o.email, password: PASSWORD });
    const v = await request(m.app).post('/api/auth/2fa/verify').set('Cookie', cookieFrom(s)).set('Origin', ORIGIN).set('X-CSRF-Token', s.body.csrfToken)
      .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
    expect(v.status, JSON.stringify(v.body)).toBe(200);
    owner = { cookie: cookieFrom(v), csrf: v.body.csrfToken, id: o.id };
    de = await signIn('data_entry');
    cc = await signIn('call_center');
    dv = await signIn('developer');
  });

  afterAll(async () => {
    m?.clock.set(null);
    m?.setAttendanceFlagOverridesForTests({});
    await m?.pool.end();
    if (admin) {
      await admin.query(`REASSIGN OWNED BY ${LOGIN} TO CURRENT_USER`).catch(() => undefined);
      await admin.query(`DROP OWNED BY ${LOGIN}`).catch(() => undefined);
      await admin.end();
    }
    process.env.TEST_DATABASE_URL = ADMIN_URL;
  });

  it('business create → edit (phone removed) → duplicate blocked → archive → restore, all as the restricted login', async () => {
    const x = phone();
    const y = phone();
    const body = { name: `HRR biz ${uniq()}`, category: 'Other', phones: [x, y], social: [{ platform: 'instagram', handle: `@hrr${uniq()}`, followers: null, lastPost: null }], website: null, confirmSimilar: true };
    const c = await call(de, 'post', '/api/businesses', body);
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const e = await call(de, 'patch', `/api/businesses/${c.body.id}`, { version: c.body.version, phones: [y], notes: 'edited' });
    expect(e.status, JSON.stringify(e.body)).toBe(200);
    const d = await call(de, 'post', '/api/businesses', { ...body, name: `HRR other ${uniq()}`, phones: [x], social: [{ platform: 'instagram', handle: `@hrr${uniq()}`, followers: null, lastPost: null }] });
    expect(d.status).toBe(409);
    expect(d.body.code).toBe('DUPLICATE_BLOCKED');
    const a = await call(owner, 'post', `/api/businesses/${c.body.id}/archive`, { version: e.body.version, reason: 'closed down' });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    const r = await call(owner, 'post', `/api/businesses/${c.body.id}/restore`, { version: a.body.version, reason: 'reopened' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const hist = await call(owner, 'get', `/api/businesses/${c.body.id}/history`);
    expect(hist.status).toBe(200);
    expect(hist.body.items.length).toBeGreaterThanOrEqual(3);
  });

  it('calling → accepted → developer → payment + signature → closure request → Owner verify → project + task, as the restricted login', async () => {
    const c = await call(de, 'post', '/api/businesses', { name: `HRR deal ${uniq()}`, category: 'Other', phones: [phone()], social: [{ platform: 'instagram', handle: `@hrr${uniq()}`, followers: null, lastPost: null }], website: null, confirmSimilar: true });
    expect(c.status).toBe(201);
    const biz = c.body.id;
    expect((await call(owner, 'post', '/api/calling-assignments/assign', { businessIds: [biz], assigneeId: cc.id })).status).toBe(200);
    const res = await call(cc, 'post', '/api/reservations', { businessId: biz });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const st = (await m.query<{ version: number }>('SELECT version FROM business_calling_states WHERE business_id = $1', [biz])).rows[0].version;
    const att = await call(cc, 'post', '/api/calling/attempts', {
      businessId: biz, reservationId: res.body.id, leaseToken: res.body.leaseToken, stateVersion: st, outcome: 'accepted', clientNeedsNote: 'Needs an online booking site',
    });
    expect(att.status, JSON.stringify(att.body)).toBe(201);
    const dealId = att.body.dealId as string;
    expect((await call(owner, 'post', `/api/deals/${dealId}/developer`, { version: await ver('deals', dealId), developerId: dv.id })).status).toBe(200);
    expect((await call(dv, 'post', `/api/deals/${dealId}/payment`, { version: await ver('deals', dealId), date: '2026-10-20', reference: 'PAY-H' })).status).toBe(200);
    expect((await call(dv, 'post', `/api/deals/${dealId}/signature`, { version: await ver('deals', dealId), date: '2026-10-21', reference: 'AGR-H' })).status).toBe(200);
    expect((await call(dv, 'post', `/api/deals/${dealId}/closure-request`, { version: await ver('deals', dealId), note: 'ready' })).status).toBe(200);
    const verified = await call(owner, 'post', `/api/deals/${dealId}/closure-verify`, { version: await ver('deals', dealId) });
    expect(verified.status, JSON.stringify(verified.body)).toBe(200);
    expect(verified.body.deal.stage).toBe('closed');
    await relayAll();
    const { rows: p } = await m.query<{ id: string; version: number }>('SELECT id, version FROM projects WHERE deal_id = $1', [dealId]);
    expect(p).toHaveLength(1);
    expect((await call(owner, 'post', `/api/projects/${p[0].id}/developers`, { version: p[0].version, developerIds: [dv.id] })).status).toBe(200);
    const t = await call(dv, 'post', '/api/tasks', { projectId: p[0].id, title: 'Build pages' });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    expect((await call(dv, 'patch', `/api/tasks/${t.body.task.id}`, { version: t.body.task.version, status: 'done' })).status).toBe(200);
    const s = await call(dv, 'post', `/api/projects/${p[0].id}/status`, { version: await ver('projects', p[0].id), to: 'in_progress' });
    expect(s.status, JSON.stringify(s.body)).toBe(200);
  });

  it('attendance: settings, check-in, break, check-out, correction request, Owner approve, as the restricted login', async () => {
    m.setAttendanceFlagOverridesForTests({ 'attendance.breaksEnabled': true });
    const cur = await call(owner, 'get', '/api/attendance/settings');
    const put = await call(owner, 'put', '/api/attendance/settings', {
      version: cur.body.current?.versionNo ?? 0, timezone: 'Asia/Beirut', workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], shiftStart: '09:00',
      graceMinutes: 10, verificationMode: 'ip', officeIps: ['127.0.0.1', '::1', '::ffff:127.0.0.1'], holidays: [], holidaysConfirmed: true, missingCheckoutFlagHours: 6,
    });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    const emp = await signIn('data_entry');
    m.clock.set(new Date('2026-11-02T09:05:00+02:00'));
    const ci = await call(emp, 'post', '/api/attendance/check-in', {});
    expect(ci.status, JSON.stringify(ci.body)).toBe(201);
    expect((await call(emp, 'post', '/api/attendance/breaks/start', { breakType: 'unpaid' })).status).toBe(201);
    m.clock.set(new Date('2026-11-02T09:35:00+02:00'));
    expect((await call(emp, 'post', '/api/attendance/breaks/end', {})).status).toBe(200);
    m.clock.set(new Date('2026-11-02T18:10:00+02:00'));
    const co = await call(emp, 'post', '/api/attendance/check-out', { summary: { workCompleted: 'Entered twenty businesses' } });
    expect(co.status, JSON.stringify(co.body)).toBe(200);
    m.clock.set(new Date('2026-11-03T10:00:00+02:00'));
    const req = await call(emp, 'post', '/api/attendance/corrections', { sessionId: ci.body.session.id, proposedCheckInAt: '2026-11-02T08:55:00+02:00', reason: 'Reader was down' });
    expect(req.status, JSON.stringify(req.body)).toBe(201);
    const ap = await call(owner, 'post', `/api/attendance/corrections/${req.body.id}/approve`, { version: req.body.version });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    const s = await call(emp, 'get', `/api/attendance/sessions/${ci.body.session.id}`);
    expect(s.body.session).toMatchObject({ checkInAt: '2026-11-02T07:05:00.000Z', effectiveCheckInAt: '2026-11-02T06:55:00.000Z', adjusted: true });
    m.clock.set(null);
  });

  it('custom role edit (role_permissions delete), password reset e-mail, relay, dispatch and the retention purge run as the restricted login', async () => {
    const id = `hrr_${uniq().replace(/\W/g, '')}`;
    const mk = await call(owner, 'post', '/api/access/roles', { id, name: 'HRR', permissions: [{ action: 'business.read', dataScope: 'global' }, { action: 'business.list', dataScope: 'global' }] });
    expect(mk.status, JSON.stringify(mk.body)).toBe(201);
    const ed = await call(owner, 'patch', `/api/access/roles/${id}`, { version: mk.body.role.version, permissions: [{ action: 'business.read', dataScope: 'self' }] });
    expect(ed.status, JSON.stringify(ed.body)).toBe(200);
    const target = await account('developer');
    expect((await request(m.app).post('/api/auth/password-reset/request').set('Origin', ORIGIN).send({ email: target.email })).status).toBe(202);
    await relayAll();
    for (let i = 0; i < 50; i++) if ((await m.dispatchDueDeliveries()).claimed === 0) break;
    expect((await call(de, 'post', '/api/auth/logout')).status).toBe(200);
    // Far-future "now": every window has passed, so each purge statement really deletes rows.
    const far = new Date(Date.now() + 400 * 86_400_000);
    const purged = await m.retentionPurge(m.pool, far);
    expect(Object.values(purged as unknown as Record<string, number>).some((n) => Number(n) > 0)).toBe(true);
    await expect(m.cleanupSessions(m.pool, far)).resolves.toBeDefined();
  });

  it('the same restricted connection is refused hard deletes and history rewrites (42501), and history rows survived the paths above', async () => {
    for (const sql of [
      'DELETE FROM businesses WHERE false',
      'DELETE FROM deals WHERE false',
      'DELETE FROM employees WHERE false',
      'DELETE FROM credentials WHERE false',
      'DELETE FROM call_attempts WHERE false',
      'DELETE FROM attendance_sessions WHERE false',
      'DELETE FROM attendance_corrections WHERE false',
      'DELETE FROM projects WHERE false',
      'DELETE FROM tasks WHERE false',
      'DELETE FROM custom_roles WHERE false',
      'DELETE FROM business_phone_registry WHERE false',
      'UPDATE deal_changes SET id = id WHERE false',
      'UPDATE business_edit_history SET id = id WHERE false',
      'UPDATE call_attempts SET id = id WHERE false',
      'UPDATE attendance_exceptions SET id = id WHERE false',
      'UPDATE audit_events SET id = id WHERE false',
      'UPDATE business_phone_registry SET removed_at = NULL WHERE false',
      'TRUNCATE audit_events',
      'TRUNCATE sessions',
      'ALTER TABLE businesses DISABLE TRIGGER ALL',
      'CREATE TABLE h_probe (id int)',
    ]) {
      expect(await refusedCode(sql), sql).toBe('42501');
    }
    const ok = await m.query<{ n: number }>(`SELECT count(*)::int AS n FROM business_edit_history`);
    expect(ok.rows[0].n).toBeGreaterThan(0);
  });
});
