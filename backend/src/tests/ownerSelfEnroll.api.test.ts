/**
 * Owner 2026-11-05: the Owner turns 2FA on from Settings with a password re-check (no enrollment token); until
 * then the session reaches nothing but the 2FA steps. Custom-role holders still need an Owner-issued token.
 * Plus the production guards: the public test TOTP secret is refused, demo accounts are reported, and the
 * development-only plaintext SMTP switch never applies in production.
 */
import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../app.js';
import { pool, query, withTransaction } from '../db/pool.js';
import { config } from '../config/index.js';
import { DEV_TOTP_SECRET } from '../db/seed.js';
import { isRefusedTestSecret, issueEnrollmentToken, storeEnrolledSecret } from '../modules/identity/twoFactor.js';
import { countDemoAccounts, warnIfDemoAccounts } from '../shared/productionDataCheck.js';
import { loadEmailConfig } from '../modules/notifications/emailConfig.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Correct-Horse-Battery-71';
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  email: string;
}
const cookieFrom = (res: request.Response): string =>
  (([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`)) ?? '').split(';')[0];

function call(a: Agent, method: 'get' | 'post', path: string, body?: object) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') r.set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf).set('Idempotency-Key', crypto.randomUUID());
  return body ? r.send(body) : r;
}
async function makeEmployee(role: string): Promise<{ id: string; email: string }> {
  const email = `self.enrol.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
    [email, `SE ${role}`, role]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}
async function signIn(email: string): Promise<{ res: request.Response; agent: Agent & { id: string } }> {
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  return { res, agent: { cookie: cookieFrom(res), csrf: res.body.csrfToken, id: '', email } };
}

describe('production guards (unit)', () => {
  it('the public test TOTP secret is refused in production only', () => {
    expect(isRefusedTestSecret('production', DEV_TOTP_SECRET)).toBe(true);
    expect(isRefusedTestSecret('production', DEV_TOTP_SECRET.toLowerCase())).toBe(true);
    expect(isRefusedTestSecret('production', authenticator.generateSecret())).toBe(false);
    expect(isRefusedTestSecret('development', DEV_TOTP_SECRET)).toBe(false);
    expect(isRefusedTestSecret('test', DEV_TOTP_SECRET)).toBe(false);
  });

  it('plaintext SMTP to a local catcher is allowed in development only, never in production', () => {
    const env = { SMTP_HOST: 'mailpit', SMTP_PORT: '1025', SMTP_FROM: 'hr@udigity.local', SMTP_DEV_ALLOW_PLAINTEXT: 'true', EMAIL_ALLOW_REAL_SEND: 'true' };
    expect(loadEmailConfig(env, 'development').smtp?.allowPlaintext).toBe(true);
    expect(loadEmailConfig(env, 'production').smtp?.allowPlaintext).toBe(false);
    expect(loadEmailConfig({ ...env, SMTP_DEV_ALLOW_PLAINTEXT: undefined }, 'development').smtp?.allowPlaintext).toBe(false);
  });
});

describe.skipIf(!hasTestDb)('Owner sets up 2FA from Settings (API)', { timeout: 120_000 }, () => {
  let activeOwner: Agent;

  beforeAll(async () => {
    const e = await makeEmployee('owner');
    await withTransaction((tx) => storeEnrolledSecret(tx, e.id, DEV_TOTP_SECRET));
    const { res, agent } = await signIn(e.email);
    expect(res.status).toBe(200);
    const v = await request(app).post('/api/auth/2fa/verify').set('Cookie', agent.cookie).set('Origin', ORIGIN).set('X-CSRF-Token', agent.csrf)
      .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
    expect(v.status, JSON.stringify(v.body)).toBe(200);
    activeOwner = { cookie: cookieFrom(v) || agent.cookie, csrf: v.body.csrfToken ?? agent.csrf, ...e };
  });
  afterAll(async () => {
    await pool.end();
  });

  it('first sign-in: no data before 2FA; password-only setup; then Owner tools open (audited selfEnrolled)', async () => {
    const e = await makeEmployee('owner');
    const { res, agent } = await signIn(e.email);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ requires2FA: true, twoFactorStep: 'enroll' });

    // Nothing but the 2FA steps: no shared data, no admin data.
    for (const path of ['/api/businesses', '/api/employees', '/api/attendance/me/today']) {
      const r = await call(agent, 'get', path);
      expect(r.status, path).toBe(403);
      expect(r.body.code, path).toBe('OWNER_2FA_REQUIRED');
    }

    expect((await call(agent, 'post', '/api/auth/2fa/enroll/start', { currentPassword: 'not-the-password-1' })).body.code).toBe('REAUTH_FAILED');
    const start = await call(agent, 'post', '/api/auth/2fa/enroll/start', { currentPassword: PASSWORD });
    expect(start.status, JSON.stringify(start.body)).toBe(200);
    expect(start.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(start.body.otpauthUrl).toContain('otpauth://totp/');

    const confirm = await call(agent, 'post', '/api/auth/2fa/enroll/confirm', { token: authenticator.generate(start.body.secret) });
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(200);
    expect(confirm.body.recoveryCodes?.length).toBeGreaterThan(0);
    const after = { ...agent, cookie: cookieFrom(confirm) || agent.cookie, csrf: confirm.body.csrfToken ?? agent.csrf };

    expect((await call(after, 'get', '/api/auth/me')).body.user.sessionState).toBe('active');
    expect((await call(after, 'get', '/api/employees')).status).toBe(200);

    const au = await query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM audit_events WHERE event_name = 'two_factor.enrolled' AND actor_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [e.id]
    );
    expect(au.rows[0].payload).toMatchObject({ selfEnrolled: true, enrollmentTokenId: null });

    // The next sign-in asks for the code, as for any enrolled Owner.
    expect((await signIn(e.email)).res.body).toMatchObject({ requires2FA: true, twoFactorStep: 'verify' });
  });

  it('a custom-role holder still needs the Owner-issued token', async () => {
    const roleId = `self_enrol_${Math.random().toString(36).slice(2, 8)}`;
    const role = await call(activeOwner, 'post', '/api/access/roles', {
      id: roleId,
      name: `Self enrol ${roleId}`,
      description: 'test role',
      permissions: [{ action: 'business.list', dataScope: 'self' }],
    });
    expect(role.status, JSON.stringify(role.body)).toBe(201);
    const e = await makeEmployee(roleId);
    const issued = await withTransaction((tx) => issueEnrollmentToken(tx, { employeeId: e.id, issuedBy: activeOwner.id, issuedVia: 'owner_session' }));

    const { res, agent } = await signIn(e.email);
    expect(res.body).toMatchObject({ requires2FA: true, twoFactorStep: 'enroll' });
    const noToken = await call(agent, 'post', '/api/auth/2fa/enroll/start', { currentPassword: PASSWORD });
    expect(noToken.status).toBe(400);
    expect(noToken.body.code).toBe('ENROLLMENT_TOKEN_INVALID');
    const withToken = await call(agent, 'post', '/api/auth/2fa/enroll/start', { currentPassword: PASSWORD, enrollmentToken: issued.token });
    expect(withToken.status, JSON.stringify(withToken.body)).toBe(200);
  });

  it('demo accounts (@udigity.demo) are reported in production only, by count', async () => {
    await makeEmployee('call_center').then((e) => query(`UPDATE employees SET email = $1 WHERE id = $2`, [`demo.${uniq()}@udigity.demo`, e.id]));
    expect(await countDemoAccounts(pool)).toBeGreaterThan(0);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await warnIfDemoAccounts(pool, 'development')).toBe(0);
      expect(spy).not.toHaveBeenCalled();
      expect(await warnIfDemoAccounts(pool, 'production')).toBeGreaterThan(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).not.toMatch(/@udigity\.demo\b.*@/); // count only, no addresses
    } finally {
      spy.mockRestore();
    }
  });
});
