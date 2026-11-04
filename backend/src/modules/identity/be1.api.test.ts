/**
 * BE1 Increment 2 API tests (DB). Run only with TEST_DATABASE_URL (BE1: udigity_test_be1).
 * Covers: SEC-3 (AU-8 enrollment token + re-auth, AU-13 encryption at rest, AU-9 recovery codes),
 * settings + flags, audit read, employees create/edit/open-items/status with E-01/E-02, `/me`
 * capabilities, DEV-R5 grants. Every endpoint has a per-role matrix test (authz-matrix §4.1).
 * Rows are uniquely named and never deleted (FKs RESTRICT, audit append-only).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../../app.js';
import { pool, query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEMO_LABEL } from '../../shared/flags.js';
import { runSystemCommand } from '../../shared/tx.js';
import { DEV_TOTP_SECRET } from '../../db/seed.js';
import { getSetting } from '../admin/service.js';
import { runBootstrap } from './bootstrap.js';
import { revokeSessionsConsumer } from './service.js';
import { getEmployeeContact } from '../employees/service.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const SEED_OWNER = 'udigity@gmail.com';

type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';
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

function call(a: Pick<Agent, 'cookie' | 'csrf'>, method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
  return body ? r.send(body) : r;
}

async function freshStep(employeeId: string) {
  await query(
    `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL WHERE employee_id = $1`,
    [employeeId]
  );
}

async function employeeId(email: string): Promise<string> {
  const { rows } = await query<{ id: string }>('SELECT id FROM employees WHERE LOWER(email) = LOWER($1)', [email]);
  return rows[0].id;
}

/** Seeded Owner with completed 2FA. */
async function ownerAgent(): Promise<Agent> {
  const id = await employeeId(SEED_OWNER);
  await freshStep(id);
  const s = await login(SEED_OWNER);
  const v = await call(s, 'post', '/api/auth/2fa/verify', { token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id, email: SEED_OWNER };
}

async function makeEmployee(role: Role, password = PASSWORD): Promise<{ id: string; email: string }> {
  const email = `be1.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'BE1 Test', $2, true) RETURNING id`,
    [email, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(password, 4)]);
  return { id: rows[0].id, email };
}

async function agentFor(role: Exclude<Role, 'owner'>): Promise<Agent> {
  const e = await makeEmployee(role);
  const s = await login(e.email);
  expect(s.res.status).toBe(200);
  return { cookie: s.cookie, csrf: s.csrf, ...e };
}

/** An Owner session still in pending 2FA (seeded Owner, not verified). */
async function pendingOwner(): Promise<Agent> {
  const s = await login(SEED_OWNER);
  return { cookie: s.cookie, csrf: s.csrf, id: await employeeId(SEED_OWNER), email: SEED_OWNER };
}

async function outboxCount(name: string, aggregateId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM outbox_events WHERE name = $1 AND aggregate_id = $2',
    [name, aggregateId]
  );
  return Number(rows[0].n);
}

async function auditCount(eventName: string, entityId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM audit_events WHERE event_name = $1 AND entity_id = $2',
    [eventName, entityId]
  );
  return Number(rows[0].n);
}

describe.skipIf(!hasTestDb)('BE1 Increment 2 (DB)', () => {
  let owner: Agent;
  let de: Agent;
  let cc: Agent;
  let dv: Agent;

  beforeAll(async () => {
    owner = await ownerAgent();
    de = await agentFor('data_entry');
    cc = await agentFor('call_center');
    dv = await agentFor('developer');
  });

  afterAll(async () => {
    await pool.end();
  });

  // -------------------------------------------------------------------------------------------
  // Per-role matrix (authz §4.1): every BE1 endpoint × 4 roles + Owner pending 2FA.
  // -------------------------------------------------------------------------------------------
  describe('role matrix', () => {
    const SOME_ID = '00000000-0000-4000-8000-000000000001';
    type Row = { method: 'get' | 'post' | 'patch'; path: string; allowed: Role[]; body?: object };
    const rows: Row[] = [
      { method: 'get', path: '/api/settings', allowed: ['owner'] },
      { method: 'get', path: '/api/settings/flags', allowed: ['owner'] },
      { method: 'patch', path: '/api/settings', allowed: ['owner'], body: { version: 1, values: {} } },
      { method: 'get', path: '/api/audit-events', allowed: ['owner'] },
      { method: 'get', path: '/api/employees', allowed: ['owner'] },
      { method: 'post', path: '/api/employees', allowed: ['owner'], body: {} },
      { method: 'get', path: '/api/employees/me', allowed: ['owner', 'data_entry', 'call_center', 'developer'] },
      { method: 'get', path: `/api/employees/${SOME_ID}`, allowed: ['owner'] },
      { method: 'patch', path: `/api/employees/${SOME_ID}`, allowed: ['owner'], body: {} },
      { method: 'get', path: `/api/employees/${SOME_ID}/open-items`, allowed: ['owner'] },
      { method: 'patch', path: `/api/employees/${SOME_ID}/status`, allowed: ['owner'], body: {} },
      { method: 'post', path: '/api/auth/2fa/recovery-codes', allowed: ['owner'], body: {} },
      { method: 'post', path: '/api/auth/2fa/enrollment-tokens', allowed: ['owner'], body: {} },
      // V-01: own password change and own profile edit (authz §3.1/§3.2, Own). `{}` → 400 behind the guard.
      { method: 'post', path: '/api/auth/password/change', allowed: ['owner', 'data_entry', 'call_center', 'developer'], body: {} },
      { method: 'patch', path: '/api/employees/me', allowed: ['owner', 'data_entry', 'call_center', 'developer'], body: {} },
    ];
    const agents = (): Record<Role, Agent> => ({ owner, data_entry: de, call_center: cc, developer: dv });

    for (const row of rows) {
      it(`${row.method.toUpperCase()} ${row.path}`, async () => {
        for (const role of ['owner', 'data_entry', 'call_center', 'developer'] as Role[]) {
          const res = await call(agents()[role], row.method, row.path, row.body);
          if (row.allowed.includes(role)) {
            expect(res.status, `${role} allowed`).not.toBe(403);
            expect(res.status, `${role} allowed`).not.toBe(401);
          } else {
            expect(res.status, `${role} denied`).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_ROLE');
            // Denials carry no data.
            expect(Object.keys(res.body).sort()).toEqual(['code', 'error']);
          }
        }
        // Owner with pending 2FA: every new route is refused (R11-a demonstration default).
        const pending = await call(await pendingOwner(), row.method, row.path, row.body);
        expect(pending.status).toBe(403);
        expect(pending.body.code).toBe('OWNER_2FA_REQUIRED');
      });
    }
  });

  // -------------------------------------------------------------------------------------------
  // SEC-3
  // -------------------------------------------------------------------------------------------
  describe('SEC-3: Owner 2FA enrollment (AU-8), encryption (AU-13), recovery codes (AU-9)', () => {
    let newOwner: { id: string; email: string; password: string; token: string };
    let totpSecret = '';
    let recoveryCodes: string[] = [];

    it('bootstrap CLI creates an Owner with a random password and a one-time enrollment token', async () => {
      const email = `be1.owner.${uniq()}@test.local`;
      const r = await runBootstrap({ email, name: 'Bootstrap Owner', reset2fa: false, encryptExisting: false });
      expect(r.kind).toBe('created');
      if (r.kind !== 'created') return;
      expect(r.password.length).toBeGreaterThanOrEqual(24);
      newOwner = { id: r.employeeId, email, password: r.password, token: r.enrollmentToken };
      const { rows } = await query<{ token_hash: string; issued_via: string }>(
        `SELECT token_hash, issued_via FROM security_tokens WHERE employee_id = $1 AND purpose = 'two_factor_enrollment'`,
        [r.employeeId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].token_hash).not.toContain(r.enrollmentToken); // hashed
      expect(rows[0].issued_via).toBe('cli');
      expect(await auditCount('two_factor.enrollment_token_issued', r.employeeId)).toBe(1);
    });

    it('password alone cannot enroll: start needs the token and a fresh password', async () => {
      const s = await login(newOwner.email, newOwner.password);
      expect(s.res.body.twoFactorStep).toBe('enroll');

      const noToken = await call(s, 'post', '/api/auth/2fa/enroll/start', {});
      expect(noToken.status).toBe(400);
      expect(noToken.body.code).toBe('VALIDATION_ERROR');

      const otherToken = (await runBootstrap({ email: SEED_OWNER, reset2fa: false, encryptExisting: false }).catch(() => null)) ?? null;
      expect(otherToken).toBeNull(); // enrolled Owner: CLI refuses without --reset-2fa

      const wrongToken = await call(s, 'post', '/api/auth/2fa/enroll/start', {
        enrollmentToken: 'A'.repeat(43),
        currentPassword: newOwner.password,
      });
      expect(wrongToken.body.code).toBe('ENROLLMENT_TOKEN_INVALID');

      const wrongPw = await call(s, 'post', '/api/auth/2fa/enroll/start', {
        enrollmentToken: newOwner.token,
        currentPassword: 'not the password',
      });
      expect(wrongPw.body.code).toBe('REAUTH_FAILED');

      // Confirm without start: no factor exists → not available.
      const early = await call(s, 'post', '/api/auth/2fa/enroll/confirm', { token: '123456' });
      expect(early.body.code).toBe('2FA_NOT_CONFIGURED');
    });

    it('a token issued for another Owner does not work', async () => {
      const other = await runBootstrap({ email: `be1.owner2.${uniq()}@test.local`, name: 'Other', reset2fa: false, encryptExisting: false });
      if (other.kind !== 'created') throw new Error('expected created');
      const s = await login(newOwner.email, newOwner.password);
      const res = await call(s, 'post', '/api/auth/2fa/enroll/start', {
        enrollmentToken: other.enrollmentToken,
        currentPassword: newOwner.password,
      });
      expect(res.body.code).toBe('ENROLLMENT_TOKEN_INVALID');
    });

    it('token + password + code enrolls; the secret is encrypted at rest; recovery codes shown once', async () => {
      const s = await login(newOwner.email, newOwner.password);
      const start = await call(s, 'post', '/api/auth/2fa/enroll/start', {
        enrollmentToken: newOwner.token,
        currentPassword: newOwner.password,
      });
      expect(start.status).toBe(200);
      totpSecret = start.body.secret;

      const { rows } = await query<{ secret: string | null; secret_ciphertext: string; secret_key_id: string }>(
        'SELECT secret, secret_ciphertext, secret_key_id FROM two_factor_factors WHERE employee_id = $1',
        [newOwner.id]
      );
      expect(rows[0].secret).toBeNull();
      expect(rows[0].secret_ciphertext).not.toContain(totpSecret);
      expect(rows[0].secret_key_id).toBeTruthy();

      const confirm = await call(s, 'post', '/api/auth/2fa/enroll/confirm', { token: authenticator.generate(totpSecret) });
      expect(confirm.status).toBe(200);
      recoveryCodes = confirm.body.recoveryCodes;
      expect(recoveryCodes).toHaveLength(10);
      const { rows: tok } = await query<{ used_at: Date | null }>(
        `SELECT used_at FROM security_tokens WHERE employee_id = $1 AND purpose = 'two_factor_enrollment'`,
        [newOwner.id]
      );
      expect(tok[0].used_at).not.toBeNull();
      const { rows: codes } = await query<{ code_hash: string }>('SELECT code_hash FROM two_factor_recovery_codes WHERE employee_id = $1', [newOwner.id]);
      expect(codes).toHaveLength(10);
      for (const c of codes) expect(c.code_hash.startsWith('$2')).toBe(true); // bcrypt, never plaintext
      expect(await auditCount('two_factor.enrolled', newOwner.id)).toBe(1);
      // No secret, token or code in any audit row of this Owner.
      const { rows: audits } = await query<{ j: string }>(
        `SELECT (payload::text || COALESCE(before_state::text,'') || COALESCE(after_state::text,'')) AS j FROM audit_events WHERE entity_id = $1::text OR actor_id = $1::uuid`,
        [newOwner.id]
      );
      for (const a of audits) {
        expect(a.j).not.toContain(totpSecret);
        expect(a.j).not.toContain(newOwner.token);
        for (const c of recoveryCodes) expect(a.j).not.toContain(c);
      }
    });

    it('a recovery code signs in once; reuse fails; E-04 outbox event', async () => {
      const s = await login(newOwner.email, newOwner.password);
      const ok = await call(s, 'post', '/api/auth/2fa/recover', { code: recoveryCodes[0].toUpperCase() });
      expect(ok.status).toBe(200);
      expect(ok.body.recoveryCodesRemaining).toBe(9);
      const active = { cookie: cookieFrom(ok), csrf: ok.body.csrfToken };
      expect((await call(active, 'get', '/api/auth/me')).body.user.sessionState).toBe('active');
      expect(await outboxCount('two_factor.recovery_succeeded', newOwner.id)).toBe(1);

      const s2 = await login(newOwner.email, newOwner.password);
      const reuse = await call(s2, 'post', '/api/auth/2fa/recover', { code: recoveryCodes[0] });
      expect(reuse.body.code).toBe('INVALID_2FA_TOKEN');
      // recover is not allowed on an active session
      expect((await call(active, 'post', '/api/auth/2fa/recover', { code: recoveryCodes[1] })).body.code).toBe('2FA_NOT_PENDING');
    });

    it('regenerating recovery codes needs a current TOTP code and voids the old batch', async () => {
      await freshStep(newOwner.id);
      const s = await login(newOwner.email, newOwner.password);
      const v = await call(s, 'post', '/api/auth/2fa/recover', { code: recoveryCodes[1] });
      const active = { cookie: cookieFrom(v), csrf: v.body.csrfToken };
      expect((await call(active, 'post', '/api/auth/2fa/recovery-codes', { token: '000000' })).body.code).toBe('INVALID_2FA_TOKEN');
      const regen = await call(active, 'post', '/api/auth/2fa/recovery-codes', { token: authenticator.generate(totpSecret) });
      expect(regen.status).toBe(200);
      expect(regen.body.recoveryCodes).toHaveLength(10);
      const s2 = await login(newOwner.email, newOwner.password);
      expect((await call(s2, 'post', '/api/auth/2fa/recover', { code: recoveryCodes[2] })).body.code).toBe('INVALID_2FA_TOKEN');
      const status = await call(active, 'get', '/api/auth/2fa/status');
      expect(status.body.recoveryCodesRemaining).toBe(10);
    });

    it('an active Owner issues an enrollment token for another Owner with fresh re-auth', async () => {
      const target = await runBootstrap({ email: `be1.owner3.${uniq()}@test.local`, name: 'Target', reset2fa: false, encryptExisting: false });
      if (target.kind !== 'created') throw new Error('expected created');
      const base = { employeeId: target.employeeId, currentPassword: PASSWORD };

      await freshStep(owner.id);
      expect((await call(owner, 'post', '/api/auth/2fa/enrollment-tokens', { ...base, token: '000000' })).body.code).toBe('REAUTH_FAILED');
      const wrongPw = await call(owner, 'post', '/api/auth/2fa/enrollment-tokens', { ...base, currentPassword: 'nope', token: authenticator.generate(DEV_TOTP_SECRET) });
      expect(wrongPw.body.code).toBe('REAUTH_FAILED');
      const nonOwner = await call(owner, 'post', '/api/auth/2fa/enrollment-tokens', { ...base, employeeId: cc.id, token: authenticator.generate(DEV_TOTP_SECRET) });
      expect([400, 409]).toContain(nonOwner.status); // replay guard (400) or not eligible (409); never a token
      expect(nonOwner.body.enrollmentToken).toBeUndefined();

      await freshStep(owner.id);
      const ok = await call(owner, 'post', '/api/auth/2fa/enrollment-tokens', { ...base, token: authenticator.generate(DEV_TOTP_SECRET) });
      expect(ok.status).toBe(201);
      expect(ok.body.enrollmentToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      // The CLI token was superseded; the new one enrolls.
      const s = await login(target.employeeId ? (await query<{ email: string }>('SELECT email FROM employees WHERE id = $1', [target.employeeId])).rows[0].email : '', target.password);
      const old = await call(s, 'post', '/api/auth/2fa/enroll/start', { enrollmentToken: target.enrollmentToken, currentPassword: target.password });
      expect(old.body.code).toBe('ENROLLMENT_TOKEN_INVALID');
      const start = await call(s, 'post', '/api/auth/2fa/enroll/start', { enrollmentToken: ok.body.enrollmentToken, currentPassword: target.password });
      expect(start.status).toBe(200);
    });

    it('legacy plaintext secret is encrypted on first use', async () => {
      const e = await makeEmployee('owner');
      const legacy = authenticator.generateSecret();
      await query(`INSERT INTO two_factor_factors (employee_id, factor_type, secret, is_enrolled) VALUES ($1, 'totp', $2, true)`, [e.id, legacy]);
      const s = await login(e.email);
      const v = await call(s, 'post', '/api/auth/2fa/verify', { token: authenticator.generate(legacy) });
      expect(v.status).toBe(200);
      const { rows } = await query<{ secret: string | null; secret_ciphertext: string | null }>(
        'SELECT secret, secret_ciphertext FROM two_factor_factors WHERE employee_id = $1',
        [e.id]
      );
      expect(rows[0].secret).toBeNull();
      expect(rows[0].secret_ciphertext).toBeTruthy();
    });

    it('operator --reset-2fa un-enrolls, voids codes, ends sessions, audits', async () => {
      const s = await login(newOwner.email, newOwner.password);
      expect(s.res.status).toBe(200);
      const r = await runBootstrap({ email: newOwner.email, reset2fa: true, reason: 'Lost phone, identity verified by call', encryptExisting: false });
      expect(r.kind).toBe('token_issued');
      expect((await call(s, 'get', '/api/auth/me')).status).toBe(401);
      expect(await auditCount('two_factor.reset_by_operator', newOwner.id)).toBe(1);
      const again = await login(newOwner.email, newOwner.password);
      expect(again.res.body.twoFactorStep).toBe('enroll');
    });

    it('AT-5: login.failed caps the stored email at 254 characters', async () => {
      const long = `${'x'.repeat(240)}@t.local`;
      await login(long, 'whatever');
      const { rows } = await query<{ e: string }>(
        `SELECT payload->>'email' AS e FROM audit_events WHERE event_name = 'login.failed' ORDER BY created_at DESC LIMIT 1`
      );
      expect(rows[0].e.length).toBeLessThanOrEqual(254);
    });
  });

  // -------------------------------------------------------------------------------------------
  // /me capabilities
  // -------------------------------------------------------------------------------------------
  it('V-01: every role changes only its own password; other sessions end; wrong current password → 401', async () => {
    for (const role of ['data_entry', 'call_center', 'developer'] as const) {
      const e = await makeEmployee(role);
      const a = await login(e.email);
      const b = await login(e.email);
      const wrong = await call(a, 'post', '/api/auth/password/change', { currentPassword: 'nope-nope-nope', newPassword: 'N3w-Password-123!' });
      expect(wrong.status, role).toBe(401);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
      const ok = await call(a, 'post', '/api/auth/password/change', { currentPassword: PASSWORD, newPassword: 'N3w-Password-123!' });
      expect(ok.status, role).toBe(200);
      // E-09 (review 2026-11-04): the change rotates this session's token; the old cookie stops working.
      expect((await call(a, 'get', '/api/auth/me')).status).toBe(401);
      expect((await call({ cookie: cookieFrom(ok), csrf: a.csrf }, 'get', '/api/auth/me')).status).toBe(200);
      expect((await call(b, 'get', '/api/auth/me')).status).toBe(401);
      expect((await login(e.email)).res.status).toBe(401);
      expect((await login(e.email, 'N3w-Password-123!')).res.status).toBe(200);
      expect(await auditCount('password.changed', e.id)).toBe(1);
    }
    // The capability is listed for every role (from the matrix row).
    expect((await call(de, 'get', '/api/auth/me')).body.capabilities).toContain('auth.password.change');
    expect((await call(owner, 'get', '/api/auth/me')).body.capabilities).toContain('auth.password.change');
  });

  it('GET /api/auth/me returns capabilities per role', async () => {
    const o = await call(owner, 'get', '/api/auth/me');
    expect(o.body.capabilities).toEqual(expect.arrayContaining(['employee.create', 'settings.update', 'audit.read']));
    const c = await call(cc, 'get', '/api/auth/me');
    expect(c.body.capabilities).not.toContain('employee.create');
    expect(c.body.capabilities).toContain('settings.read_public');
    expect(c.body.capabilities).not.toContain('settings.read');
    const p = await call(await pendingOwner(), 'get', '/api/auth/me');
    expect(p.body.capabilities).toEqual([]);
  });

  // -------------------------------------------------------------------------------------------
  // Settings + flags
  // -------------------------------------------------------------------------------------------
  describe('settings', () => {
    it('GET: Owner gets every SET row with the demo label; others only the timezone', async () => {
      const o = await call(owner, 'get', '/api/settings');
      expect(o.status).toBe(200);
      expect(o.body.version).toBeGreaterThanOrEqual(1);
      expect(o.body.settings.length).toBeGreaterThan(10);
      for (const r of o.body.settings) expect(r.label).toBe(DEMO_LABEL);
      expect(o.body.company).toHaveProperty(['company.timezone']);
      const d = await call(de, 'get', '/api/settings/public');
      expect(d.status).toBe(200);
      expect(d.body.settings).toBeUndefined();
      expect(d.body.policies).toBeUndefined();
      expect(Object.keys(d.body.company)).toEqual(['company.timezone', 'company.name']);
    });

    it('R3: /settings/public serves derived values to every role; /settings is Owner-only; pending Owner gets neither (R11-a)', async () => {
      // authz-matrix §3 legend: under R11-a a pending Owner session can call only the auth routes.
      expect((await call(await pendingOwner(), 'get', '/api/settings/public')).status).toBe(403);
      for (const a of [owner, de, cc, dv]) {
        const r = await call(a, 'get', '/api/settings/public');
        expect(r.status).toBe(200);
        expect(Object.keys(r.body.company)).toEqual(['company.timezone', 'company.name']);
        expect(r.body.settings).toBeUndefined();
        expect(r.body.policies).toBeUndefined();
        expect(r.body.label).toBe(DEMO_LABEL);
      }
      for (const a of [de, cc, dv]) {
        const r = await call(a, 'get', '/api/settings');
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
      const p = await call(await pendingOwner(), 'get', '/api/settings');
      expect(p.body.code).toBe('OWNER_2FA_REQUIRED');
    });

    it('GET /flags: every registry row labelled "Demonstration alternative — not approved"', async () => {
      const r = await call(owner, 'get', '/api/settings/flags');
      expect(r.status).toBe(200);
      expect(r.body.flags.length).toBeGreaterThanOrEqual(70);
      for (const f of r.body.flags) {
        expect(f.label).toBe(DEMO_LABEL);
        expect(f.label).toContain('Demonstration alternative — not approved');
      }
      const tz = r.body.flags.find((f: { key: string }) => f.key === 'company.timezone');
      expect(tz.kind).toBe('SET');
    });

    it('PATCH: validates, saves with version, audits before/after, getSetting reads it, 409 on stale', async () => {
      const cur = await call(owner, 'get', '/api/settings');
      const v = cur.body.version as number;

      const bad = await call(owner, 'patch', '/api/settings', { version: v, values: { 'company.timezone': 'Mars/Base' } });
      expect(bad.status).toBe(400);
      expect(bad.body.details['company.timezone']).toBeDefined();
      const unknown = await call(owner, 'patch', '/api/settings', { version: v, values: { 'nope.key': 1 } });
      expect(unknown.status).toBe(400);
      const attendance = await call(owner, 'patch', '/api/settings', { version: v, values: { 'attendance.graceMinutes': 5 } });
      expect(attendance.body.details['attendance.graceMinutes']).toEqual(['Not editable here']);
      const strict = await call(owner, 'patch', '/api/settings', { version: v, values: { 'company.timezone': 'UTC' }, extra: 1 });
      expect(strict.status).toBe(400);

      const tz = cur.body.company['company.timezone'] === 'Asia/Beirut' ? 'Europe/Paris' : 'Asia/Beirut';
      const ok = await call(owner, 'patch', '/api/settings', { version: v, company: { 'company.timezone': tz }, policies: { 'reservation.leaseSeconds': 240 } });
      expect(ok.status).toBe(200);
      expect(ok.body.version).toBe(v + 1);
      expect(ok.body.company['company.timezone']).toBe(tz);
      expect(await getSetting(pool, 'company.timezone')).toBe(tz);
      expect(await getSetting(pool, 'reservation.leaseSeconds')).toBe(240);
      const { rows } = await query<{ after_state: Record<string, unknown> }>(
        `SELECT after_state FROM audit_events WHERE event_name = 'settings.updated' ORDER BY created_at DESC LIMIT 1`
      );
      expect(rows[0].after_state['company.timezone']).toBe(tz);

      const stale = await call(owner, 'patch', '/api/settings', { version: v, values: { 'company.timezone': 'UTC' } });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('VERSION_CONFLICT');
      expect(stale.body.details.currentVersion).toBe(v + 1);

      // null resets to the env default
      const reset = await call(owner, 'patch', '/api/settings', { version: v + 1, values: { 'reservation.leaseSeconds': null } });
      expect(reset.status).toBe(200);
      expect(await getSetting(pool, 'reservation.leaseSeconds')).toBe(300);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Audit read
  // -------------------------------------------------------------------------------------------
  describe('audit read', () => {
    it('paged, filtered, read-only, placeholder names flagged', async () => {
      const r = await call(owner, 'get', '/api/audit-events?event=session.*&pageSize=5');
      expect(r.status).toBe(200);
      expect(r.body.pageSize).toBe(5);
      expect(r.body.items.length).toBeLessThanOrEqual(5);
      expect(r.body.total).toBeGreaterThan(0);
      for (const i of r.body.items) expect(i.eventName.startsWith('session.')).toBe(true);
      const byEntity = await call(owner, 'get', `/api/audit-events?entityRef=${cc.id}&event=session.created`);
      for (const i of byEntity.body.items) expect(i.entityId).toBe(cc.id);
      const enrolled = await call(owner, 'get', '/api/audit-events?event=two_factor.enrolled&pageSize=1');
      if (enrolled.body.items[0]) expect(enrolled.body.items[0].placeholderName).toBe(true);
      const byDay = await call(owner, 'get', `/api/audit-events?from=${new Date().toISOString().slice(0, 10)}&pageSize=1`);
      expect(byDay.status).toBe(200);
      expect((await call(owner, 'get', '/api/audit-events?actorId=not-a-uuid')).status).toBe(400);
      expect((await call(owner, 'get', '/api/audit-events?sort=1;drop')).status).toBe(400); // C-11: unknown sort is a 400
      // No update/delete route exists.
      expect((await call(owner, 'patch', `/api/audit-events/${r.body.items[0].id}`, {})).status).toBe(404);
      expect((await call(owner, 'delete', `/api/audit-events/${r.body.items[0].id}`)).status).toBe(404);
    });

    it('DEV-R5: udigity_app may only SELECT/INSERT audit_events', async () => {
      const { rows } = await query<{ ins: boolean; upd: boolean; del: boolean; biz: boolean }>(
        `SELECT has_table_privilege('udigity_app', 'audit_events', 'INSERT') AS ins,
                has_table_privilege('udigity_app', 'audit_events', 'UPDATE') AS upd,
                has_table_privilege('udigity_app', 'audit_events', 'DELETE') AS del,
                has_table_privilege('udigity_app', 'employees', 'UPDATE') AS biz`
      );
      expect(rows[0]).toEqual({ ins: true, upd: false, del: false, biz: true });
      await expect(
        withTransaction(async (c) => {
          await c.query('SET LOCAL ROLE udigity_app');
          await c.query(`DELETE FROM audit_events WHERE false`);
        })
      ).rejects.toThrow(/permission denied/);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Employees
  // -------------------------------------------------------------------------------------------
  describe('employees', () => {
    it('POST creates (E-01: credential-setup token + outbox), validates, rejects duplicates', async () => {
      const email = `be1.new.${uniq()}@test.local`;
      const res = await call(owner, 'post', '/api/employees', { email: email.toUpperCase(), fullName: '  New Person ', role: 'developer', jobTitle: 'Dev' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ email, fullName: 'New Person', role: 'developer', isActive: true, version: 1, twoFactorEnrolled: false });
      expect(await outboxCount('account.created', res.body.id)).toBe(1);
      expect(await auditCount('account.created', res.body.id)).toBe(1);
      const { rows } = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM security_tokens WHERE employee_id = $1 AND purpose = 'credential_setup' AND used_at IS NULL`,
        [res.body.id]
      );
      expect(rows[0].n).toBe('1');
      const { rows: payload } = await query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM outbox_events WHERE name = 'account.created' AND aggregate_id = $1`,
        [res.body.id]
      );
      expect(Object.keys(payload[0].payload)).toEqual(['securityTokenId']); // ids only

      const dup = await call(owner, 'post', '/api/employees', { email, fullName: 'Dup', role: 'developer' });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('CONFLICT_DUPLICATE');
      const badRole = await call(owner, 'post', '/api/employees', { email: `x.${uniq()}@t.local`, fullName: 'X', role: 'admin' });
      expect(badRole.status).toBe(400);
      const mass = await call(owner, 'post', '/api/employees', { email: `y.${uniq()}@t.local`, fullName: 'Y', role: 'developer', isActive: false, version: 9 });
      expect(mass.status).toBe(400);
    });

    it('GET list is paged and filterable; GET :id 404/400', async () => {
      const list = await call(owner, 'get', `/api/employees?q=${encodeURIComponent(cc.email)}&pageSize=10`);
      expect(list.status).toBe(200);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0]).toMatchObject({ id: cc.id, role: 'call_center' });
      expect(list.body.items[0].sessions.activeCount).toBeGreaterThanOrEqual(1);
      expect(list.body.employees).toEqual(list.body.items);
      const filtered = await call(owner, 'get', '/api/employees?role=owner&status=active&pageSize=100');
      for (const e of filtered.body.items) expect(e.role).toBe('owner');
      expect((await call(owner, 'get', `/api/employees/${cc.id}`)).body.email).toBe(cc.email);
      expect((await call(owner, 'get', '/api/employees/00000000-0000-4000-8000-00000000abcd')).status).toBe(404);
      expect((await call(owner, 'get', '/api/employees/not-a-uuid')).status).toBe(400);
      const me = await call(dv, 'get', '/api/employees/me');
      expect(me.body.employee.id).toBe(dv.id);
    });

    it('PATCH edits with version; role change ends the target sessions (E-02); guards', async () => {
      const t = await agentFor('call_center');
      const cur = await call(owner, 'get', `/api/employees/${t.id}`);
      const v = cur.body.version as number;

      const edit = await call(owner, 'patch', `/api/employees/${t.id}`, { version: v, department: 'Sales', phone: '+961 1 111111' });
      expect(edit.status).toBe(200);
      expect(edit.body).toMatchObject({ department: 'Sales', version: v + 1 });
      expect((await call(t, 'get', '/api/auth/me')).status).toBe(200); // no role change: session kept

      const stale = await call(owner, 'patch', `/api/employees/${t.id}`, { version: v, department: 'X' });
      expect(stale.status).toBe(409);
      expect(stale.body.details.currentVersion).toBe(v + 1);
      const mass = await call(owner, 'patch', `/api/employees/${t.id}`, { version: v + 1, isActive: false });
      expect(mass.status).toBe(400);

      const role = await call(owner, 'patch', `/api/employees/${t.id}`, { version: v + 1, role: 'developer', reason: 'Moved team' });
      expect(role.status).toBe(200);
      expect(role.body.role).toBe('developer');
      expect((await call(t, 'get', '/api/auth/me')).status).toBe(401);
      expect(await outboxCount('account.role_changed', t.id)).toBe(1);
      expect(await auditCount('account.role_changed', t.id)).toBe(1);

      const self = await call(owner, 'patch', `/api/employees/${owner.id}`, {
        version: (await call(owner, 'get', `/api/employees/${owner.id}`)).body.version,
        role: 'developer',
      });
      expect(self.status).toBe(409);
      expect((await call(owner, 'patch', '/api/employees/00000000-0000-4000-8000-00000000abcd', { version: 1, fullName: 'x' })).status).toBe(404);
    });

    it('PATCH status deactivates (E-02 outbox + sessions ended), reactivates', async () => {
      const t = await agentFor('developer');
      const v = (await call(owner, 'get', `/api/employees/${t.id}`)).body.version as number;
      const off = await call(owner, 'patch', `/api/employees/${t.id}/status`, { isActive: false, version: v, reason: 'Left' });
      expect(off.status).toBe(200);
      expect(off.body.employee.isActive).toBe(false);
      expect(await outboxCount('account.deactivated', t.id)).toBe(1);
      expect((await call(t, 'get', '/api/auth/me')).status).toBe(401);
      const on = await call(owner, 'patch', `/api/employees/${t.id}/status`, { isActive: true, version: v + 1 });
      expect(on.body.employee.isActive).toBe(true);
    });

    it('D20 (approved): reactivation does not restore the old password or MFA; a new credential-setup invitation is issued', async () => {
      const t = await agentFor('developer');
      const email = (await call(owner, 'get', `/api/employees/${t.id}`)).body.email as string;
      await query(`INSERT INTO two_factor_factors (employee_id, factor_type, secret, is_enrolled) VALUES ($1, 'totp', 'JBSWY3DPEHPK3PXP', true)`, [t.id]);
      await query(`INSERT INTO two_factor_recovery_codes (employee_id, batch_id, code_hash) VALUES ($1, gen_random_uuid(), 'x')`, [t.id]);
      const v = (await call(owner, 'get', `/api/employees/${t.id}`)).body.version as number;
      expect((await call(owner, 'patch', `/api/employees/${t.id}/status`, { isActive: false, version: v })).status).toBe(200);
      const on = await call(owner, 'patch', `/api/employees/${t.id}/status`, { isActive: true, version: v + 1 });
      expect(on.status).toBe(200);
      expect(on.body.employee).toMatchObject({ isActive: true, twoFactorEnrolled: false });
      // Old password no longer signs in; the TOTP factor and open recovery codes are gone.
      expect((await login(email)).res.status).not.toBe(200);
      const { rows: f } = await query<{ n: number }>('SELECT count(*)::int AS n FROM two_factor_factors WHERE employee_id = $1', [t.id]);
      expect(f[0].n).toBe(0);
      const { rows: rc } = await query<{ n: number }>('SELECT count(*)::int AS n FROM two_factor_recovery_codes WHERE employee_id = $1 AND superseded_at IS NULL AND used_at IS NULL', [t.id]);
      expect(rc[0].n).toBe(0);
      // Exactly one open credential-setup token, delivered through the existing invitation (E-01) outbox event.
      const { rows: tok } = await query<{ id: string }>(
        `SELECT id FROM security_tokens WHERE employee_id = $1 AND purpose = 'credential_setup' AND used_at IS NULL AND superseded_at IS NULL`,
        [t.id]
      );
      expect(tok).toHaveLength(1);
      const { rows: ob } = await query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM outbox_events WHERE name = 'account.created' AND aggregate_id = $1`,
        [t.id]
      );
      expect(ob.map((r) => r.payload)).toEqual([{ securityTokenId: tok[0].id, reactivated: true }]);
      expect(await auditCount('account.credentials_invalidated', t.id)).toBe(1);
      // Never the raw token: only ids in the audit payload.
      const { rows: au } = await query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM audit_events WHERE event_name = 'account.credentials_invalidated' AND entity_id = $1`,
        [t.id]
      );
      expect(Object.keys(au[0].payload).sort()).toEqual(['endedSessions', 'mfaRemoved', 'passwordInvalidated', 'securityTokenId']);
      expect(au[0].payload).toMatchObject({ passwordInvalidated: true, mfaRemoved: true });
    });

    it('E-02 consumer revokes all sessions and is idempotent', async () => {
      const t = await agentFor('data_entry');
      const event = {
        id: '00000000-0000-4000-8000-000000000e02',
        name: 'account.role_changed' as const,
        aggregateType: 'employee',
        aggregateId: t.id,
        payload: {},
        createdAt: new Date(),
        attempt: 1,
      };
      await runSystemCommand('test', (ctx) => revokeSessionsConsumer.handle(ctx, event));
      expect((await call(t, 'get', '/api/auth/me')).status).toBe(401);
      const before = await auditCount('session.revoked', t.id);
      await runSystemCommand('test', (ctx) => revokeSessionsConsumer.handle(ctx, event));
      expect(await auditCount('session.revoked', t.id)).toBe(before);
    });

    it('GET open-items reports unavailable modules as null, never a guessed 0', async () => {
      const r = await call(owner, 'get', `/api/employees/${cc.id}/open-items`);
      expect(r.status).toBe(200);
      expect(r.body.unavailable).toEqual(expect.arrayContaining(['assignments', 'corrections']));
      // Shipped modules report real counts (BE4-R5: deals, projects/tasks; BE1: attendance; BE3: follow-ups).
      expect(r.body).toMatchObject({ deals: 0, projects: 0, openTasks: 0, openAttendanceSessions: 0, followUps: 0 });
      for (const k of r.body.unavailable) expect(r.body[k]).toBeNull();
      expect((await call(owner, 'get', '/api/employees/00000000-0000-4000-8000-00000000abcd/open-items')).status).toBe(404);
    });

    it('BE5-R2 getEmployeeContact returns id/email/name/active only', async () => {
      const c = await getEmployeeContact(pool, cc.id);
      expect(c).toEqual({ id: cc.id, email: cc.email, fullName: 'BE1 Test', isActive: true });
      expect(await getEmployeeContact(pool, '00000000-0000-4000-8000-00000000abcd')).toBeNull();
    });
  });
});
