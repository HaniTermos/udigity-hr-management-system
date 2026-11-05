/**
 * FX-MAIL: set-password links end to end (TEST_DATABASE_URL only; memory / log transports, no network).
 * Invitation (E-01, purpose `credential_setup`, created by POST /api/employees) and password reset
 * (E-03, purpose `password_reset`): the link uses the configured public origin, invalid / expired /
 * already-used tokens answer RESET_LINK_INVALID and never open a session, a good link sets the password
 * and the new password signs in. The raw token never reaches logs, audit rows or outbox payloads.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { app } from '../app.js';
import { pool, query } from '../db/pool.js';
import { config } from '../config/index.js';
import { DEV_TOTP_SECRET } from '../db/seed.js';
import { relayOutboxOnce } from '../modules/platform/service.js';
import { dispatchDueDeliveries } from '../modules/notifications/service.js';
import { LogEmailTransport, mailSink, setEmailTransport } from '../modules/notifications/transport.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const SEED_OWNER = 'udigity@gmail.com';
const PASSWORD = 'Password123!';
const NEW_PASSWORD = 'a brand new passphrase';
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

function cookieFrom(res: request.Response): string {
  const c = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`));
  return c ? c.split(';')[0] : '';
}

/** True when the response hands out a usable session cookie (a cleared cookie has an empty value). */
function opensSession(res: request.Response): boolean {
  const c = cookieFrom(res);
  return c.length > `${config.session.cookieName}=`.length;
}

async function login(email: string, password: string): Promise<request.Response> {
  return request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
}

async function ownerAgent(): Promise<{ cookie: string; csrf: string }> {
  await query(
    `UPDATE two_factor_factors SET last_used_step = NULL, failed_count = 0, locked_until = NULL, failed_window_started_at = NULL
      WHERE employee_id = (SELECT id FROM employees WHERE LOWER(email) = LOWER($1))`,
    [SEED_OWNER]
  );
  const s = await login(SEED_OWNER, PASSWORD);
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', cookieFrom(s))
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', s.body.csrfToken)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken };
}

/**
 * Relay the whole backlog (earlier files share the DB), then dispatch until no due email is left: one J-02
 * pass claims only the 25 oldest rows, so on a reused DB this test's own email could stay unclaimed.
 */
async function deliverAll(): Promise<void> {
  for (let i = 0; i < 500; i++) if ((await relayOutboxOnce()).claimed === 0) break;
  for (let i = 0; i < 100; i++) if ((await dispatchDueDeliveries()).claimed === 0) break;
}

/** The one captured message to `email`: its template and the raw token in its link. */
function linkFor(email: string): { template: string; url: URL; token: string } {
  const msgs = mailSink.messages().filter((m) => m.to.toLowerCase() === email.toLowerCase());
  expect(msgs).toHaveLength(1);
  const href = /https?:\/\/\S+reset-password\?token=[^\s"<]+/.exec(msgs[0].text)![0];
  const url = new URL(href);
  return { template: msgs[0].template, url, token: url.searchParams.get('token')! };
}

function complete(token: unknown, newPassword = NEW_PASSWORD): request.Test {
  return request(app).post('/api/auth/password-reset/complete').set('Origin', ORIGIN).send({ token, newPassword });
}

async function credentialHash(employeeId: string): Promise<string | null> {
  const { rows } = await query<{ password_hash: string }>('SELECT password_hash FROM credentials WHERE employee_id = $1', [employeeId]);
  return rows[0]?.password_hash ?? null;
}

// 60 s per test: draining another file's backlog on a reused DB can take longer than the 5 s default.
describe.skipIf(!hasTestDb)('FX-MAIL set-password links (invitation and password reset)', { timeout: 60_000 }, () => {
  let owner: { cookie: string; csrf: string };

  beforeAll(async () => {
    owner = await ownerAgent();
  });
  beforeEach(() => {
    setEmailTransport(null);
    mailSink.clear();
  });
  afterEach(() => {
    setEmailTransport(null);
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await pool.end();
  });

  async function invite(): Promise<{ id: string; email: string }> {
    const email = `fxmail.invite.${uniq()}@test.local`;
    const res = await request(app)
      .post('/api/employees')
      .set('Cookie', owner.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', owner.csrf)
      .send({ email, fullName: 'Invited Person', role: 'developer' });
    expect(res.status).toBe(201);
    return { id: res.body.id, email };
  }

  async function resetAccount(): Promise<{ id: string; email: string }> {
    const email = `fxmail.reset.${uniq()}@test.local`;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'Reset Person', 'developer', true) RETURNING id`,
      [email]
    );
    await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
    const r = await request(app).post('/api/auth/password-reset/request').set('Origin', ORIGIN).send({ email });
    expect(r.status).toBe(202);
    return { id: rows[0].id, email };
  }

  async function deliveryState(employeeId: string, template: string): Promise<{ state: string; sent_at: Date | null }> {
    const { rows } = await query<{ state: string; sent_at: Date | null }>(
      'SELECT state, sent_at FROM notification_deliveries WHERE recipient_id = $1 AND template = $2',
      [employeeId, template]
    );
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  it('invitation: link on the configured origin; set password → no session; sign-in works; link single use', async () => {
    const emp = await invite();
    await deliverAll();
    const { template, url, token } = linkFor(emp.email);
    expect(template).toBe('security.credential_setup');
    expect(url.origin).toBe(config.publicAppUrl);
    expect(url.pathname).toBe('/reset-password');
    expect(await deliveryState(emp.id, 'security.credential_setup')).toMatchObject({ state: 'captured', sent_at: null });
    expect((await login(emp.email, NEW_PASSWORD)).status).toBe(401); // no password before set-up

    const done = await complete(token);
    expect(done.status).toBe(200);
    expect(opensSession(done)).toBe(false);
    const signIn = await login(emp.email, NEW_PASSWORD);
    expect(signIn.status).toBe(200);
    expect(opensSession(signIn)).toBe(true);

    const again = await complete(token, 'another new passphrase');
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('RESET_LINK_INVALID');
    expect(opensSession(again)).toBe(false);
    expect((await login(emp.email, 'another new passphrase')).status).toBe(401);
  });

  it('invitation: an expired link is refused and sets no password', async () => {
    const emp = await invite();
    await deliverAll();
    const { token } = linkFor(emp.email);
    await query(`UPDATE security_tokens SET expires_at = now() - interval '1 minute' WHERE employee_id = $1 AND purpose = 'credential_setup'`, [emp.id]);
    const res = await complete(token);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESET_LINK_INVALID');
    expect(opensSession(res)).toBe(false);
    expect(await credentialHash(emp.id)).toBeNull();
    expect((await login(emp.email, NEW_PASSWORD)).status).toBe(401);
  });

  it('invitation: a re-issued invitation invalidates the earlier link', async () => {
    const emp = await invite();
    await deliverAll();
    const first = linkFor(emp.email).token;
    // A second credential-setup token supersedes the first (identity issueCredentialSetup).
    await query(`UPDATE security_tokens SET superseded_at = now() WHERE employee_id = $1 AND purpose = 'credential_setup'`, [emp.id]);
    const res = await complete(first);
    expect(res.body.code).toBe('RESET_LINK_INVALID');
    expect(await credentialHash(emp.id)).toBeNull();
  });

  it('password reset: success, then the old password and the used link both fail', async () => {
    const emp = await resetAccount();
    await deliverAll();
    const { template, url, token } = linkFor(emp.email);
    expect(template).toBe('security.password_reset');
    expect(url.origin).toBe(config.publicAppUrl);
    expect(await deliveryState(emp.id, 'security.password_reset')).toMatchObject({ state: 'captured' });

    const done = await complete(token);
    expect(done.status).toBe(200);
    expect(opensSession(done)).toBe(false);
    expect((await login(emp.email, PASSWORD)).status).toBe(401);
    expect((await login(emp.email, NEW_PASSWORD)).status).toBe(200);
    const again = await complete(token, 'another new passphrase');
    expect(again.body.code).toBe('RESET_LINK_INVALID');
    expect(opensSession(again)).toBe(false);
  });

  it('password reset: an expired link is refused and the old password keeps working', async () => {
    const emp = await resetAccount();
    await deliverAll();
    const { token } = linkFor(emp.email);
    const before = await credentialHash(emp.id);
    await query(`UPDATE security_tokens SET expires_at = now() - interval '1 minute' WHERE employee_id = $1 AND purpose = 'password_reset'`, [emp.id]);
    const res = await complete(token);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESET_LINK_INVALID');
    expect(opensSession(res)).toBe(false);
    expect(await credentialHash(emp.id)).toBe(before);
    expect((await login(emp.email, PASSWORD)).status).toBe(200);
  });

  it('invalid tokens (unknown, malformed, wrong type) are refused without a session', async () => {
    const emp = await resetAccount();
    await deliverAll();
    const { token } = linkFor(emp.email);
    const before = await credentialHash(emp.id);

    const unknown = await complete('f'.repeat(64));
    expect(unknown.status).toBe(400);
    expect(unknown.body.code).toBe('RESET_LINK_INVALID');
    for (const bad of [token.slice(0, 63), `${token}&x=1`, token.toUpperCase(), '', 42, null]) {
      const res = await complete(bad);
      expect(res.status, String(bad)).toBe(400);
      expect(opensSession(res)).toBe(false);
    }
    expect(opensSession(unknown)).toBe(false);
    expect(await credentialHash(emp.id)).toBe(before);
    // The real link still works afterwards (failed attempts do not burn it).
    expect((await complete(token)).status).toBe(200);
  });

  it('the raw token is never in logs (log transport), audit rows or outbox payloads', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const emp = await invite();
    setEmailTransport(new LogEmailTransport('no-reply@udigity.test'));
    await deliverAll();
    expect(await deliveryState(emp.id, 'security.credential_setup')).toMatchObject({ state: 'captured' });
    const lines = [...info.mock.calls, ...error.mock.calls].map((c) => c.map(String).join(' '));
    const line = lines.find((l) => l.includes('template=security.credential_setup') && l.includes(`to=*@test.local`));
    expect(line).toBeDefined();
    expect(line).toContain(`link=${config.publicAppUrl}/reset-password?token=[redacted]`);
    expect(line).not.toMatch(/token=[a-f0-9]{64}/);
    for (const l of lines) expect(l).not.toMatch(/token=[a-f0-9]{64}/);

    // Audit and outbox rows for this account carry ids only.
    const { rows: audits } = await query<{ p: string }>(`SELECT COALESCE(payload::text, '') AS p FROM audit_events WHERE entity_id = $1`, [emp.id]);
    const { rows: events } = await query<{ p: string }>(`SELECT payload::text AS p FROM outbox_events WHERE aggregate_id = $1`, [emp.id]);
    for (const r of [...audits, ...events]) expect(r.p).not.toMatch(/[a-f0-9]{64}/);
    // The stash is cleared once the message left the transport.
    const { rows: secrets } = await query<{ ciphertext: string | null }>(
      `SELECT s.ciphertext FROM notification_secrets s JOIN security_tokens t ON t.id = s.ref_id WHERE t.employee_id = $1`,
      [emp.id]
    );
    expect(secrets).toEqual([{ ciphertext: null }]);
  });
});
