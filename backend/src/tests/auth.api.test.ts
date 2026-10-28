/**
 * DB-backed API tests. Run ONLY against a dedicated test database named by TEST_DATABASE_URL
 * (globalSetup migrates and seeds it). Skipped entirely when TEST_DATABASE_URL is not set, so they
 * can never write to the development database. They create uniquely-named rows and never delete
 * employees or audit rows (FKs are RESTRICT and audit is append-only).
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../app.js';
import { pool, query } from '../db/pool.js';
import { config } from '../config/index.js';
import { relayOutboxOnce } from '../modules/platform/service.js';
import { dispatchDueDeliveries } from '../modules/notifications/service.js';
import { mailSink } from '../modules/notifications/transport.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const OWNER_EMAIL = 'udigity@gmail.com';
const AGENT_EMAIL = 'maya.khoury@udigity.demo';
const PASSWORD = 'Password123!';
const SEEDED_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const ORIGIN = 'http://localhost:3000';

interface Agent {
  cookie: string;
  csrf: string;
  body: Record<string, unknown>;
  status: number;
}

function sessionCookieFrom(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const c = cookies.find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
}

async function login(email: string, password = PASSWORD): Promise<Agent> {
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
  return { cookie: sessionCookieFrom(res), csrf: res.body.csrfToken, body: res.body, status: res.status };
}

async function uniqueEmployee(role: string, isActive = true): Promise<{ id: string; email: string }> {
  const email = `test.${role}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Test User', $2, $3) RETURNING id`,
    [email, role, isActive]
  );
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}

describe.skipIf(!hasTestDb)('Identity API against TEST_DATABASE_URL', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('GET /healthz and /readyz', async () => {
    expect((await request(app).get('/healthz')).status).toBe(200);
    const ready = await request(app).get('/readyz');
    expect(ready.status).toBe(200);
    expect(ready.body.error).toBeUndefined();
  });

  it('generic failure for unknown email, wrong password and deactivated account', async () => {
    const inactive = await uniqueEmployee('call_center', false);
    const a = await login('nobody@test.local');
    const b = await login(AGENT_EMAIL, 'WrongPassword999!');
    const c = await login(inactive.email);
    for (const r of [a, b, c]) {
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('non-owner login: cookie only, CSRF required for logout, session ends', async () => {
    const s = await login(AGENT_EMAIL);
    expect(s.status).toBe(200);
    expect(s.body.token).toBeUndefined();
    const me = await request(app).get('/api/auth/me').set('Cookie', s.cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.sessionState).toBe('active');

    const noCsrf = await request(app).post('/api/auth/logout').set('Cookie', s.cookie).set('Origin', ORIGIN);
    expect(noCsrf.status).toBe(403);
    const out = await request(app).post('/api/auth/logout').set('Cookie', s.cookie).set('Origin', ORIGIN).set('X-CSRF-Token', s.csrf);
    expect(out.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', s.cookie)).status).toBe(401);

    const forbidden = await request(app).get('/api/employees').set('Cookie', (await login(AGENT_EMAIL)).cookie);
    expect(forbidden.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('Owner: pending 2FA is restricted (R11-a working default), verify rotates the session', async () => {
    const s = await login(OWNER_EMAIL);
    expect(s.body.requires2FA).toBe(true);
    expect((await request(app).get('/api/employees').set('Cookie', s.cookie)).body.code).toBe('OWNER_2FA_REQUIRED');

    const bad = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', s.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', s.csrf)
      .send({ token: '000000' });
    expect([400, 401]).toContain(bad.status);

    // Fresh step so the replay guard does not reject a code used by an earlier run.
    await query(`UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL
                 WHERE employee_id = (SELECT id FROM employees WHERE email = $1)`, [OWNER_EMAIL]);
    const s2 = await login(OWNER_EMAIL);
    const ok = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', s2.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', s2.csrf)
      .send({ token: authenticator.generate(SEEDED_TOTP_SECRET) });
    expect(ok.status).toBe(200);
    const rotated = sessionCookieFrom(ok);
    expect(rotated).not.toBe(s2.cookie);
    expect((await request(app).get('/api/auth/me').set('Cookie', s2.cookie)).status).toBe(401);
    const list = await request(app).get('/api/employees').set('Cookie', rotated);
    expect(list.status).toBe(200);
    expect(list.body.employees[0].version).toBeDefined();
  });

  it('password reset: E-03 email via outbox, single-use hashed token, all sessions ended', async () => {
    const emp = await uniqueEmployee('developer');
    const before = await login(emp.email);
    mailSink.clear();

    const r = await request(app).post('/api/auth/password-reset/request').set('Origin', ORIGIN).send({ email: emp.email });
    expect(r.status).toBe(202);
    const unknown = await request(app).post('/api/auth/password-reset/request').set('Origin', ORIGIN).send({ email: 'x@test.local' });
    expect(unknown.body).toEqual(r.body);
    // E-03: outbox relay → security delivery → J-02 dispatch into the test mail sink (no real email).
    // Relay until the backlog is drained: earlier suites in the same DB may have left events queued.
    for (let i = 0; i < 500; i++) if ((await relayOutboxOnce()).claimed === 0) break;
    await dispatchDueDeliveries();
    const sent = mailSink.messages().filter((m) => m.to.toLowerCase() === emp.email.toLowerCase());
    expect(sent).toHaveLength(1);
    const link = sent[0].text.match(/https?:\/\/\S+reset-password\?token=[^\s"<]+/)![0];
    const token = decodeURIComponent(new URL(link).searchParams.get('token')!);
    const stored = await query('SELECT 1 FROM security_tokens WHERE token_hash = $1', [token]);
    expect(stored.rowCount).toBe(0); // raw token is never stored

    const done = await request(app)
      .post('/api/auth/password-reset/complete')
      .set('Origin', ORIGIN)
      .send({ token, newPassword: 'a brand new passphrase' });
    expect(done.status).toBe(200);
    const again = await request(app)
      .post('/api/auth/password-reset/complete')
      .set('Origin', ORIGIN)
      .send({ token, newPassword: 'another new passphrase' });
    expect(again.body.code).toBe('RESET_LINK_INVALID');
    expect((await request(app).get('/api/auth/me').set('Cookie', before.cookie)).status).toBe(401);
    expect((await login(emp.email, 'a brand new passphrase')).status).toBe(200);
  });

  it('audit rows cannot be updated or deleted', async () => {
    await expect(query(`UPDATE audit_events SET event_name = 'x' WHERE false OR true`)).rejects.toThrow(/append-only/);
  });
});
