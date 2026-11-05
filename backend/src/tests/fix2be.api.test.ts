/**
 * FIX2-BE (review 2026-11-04 final backend batch). Pure tests always run; DB tests only with TEST_DATABASE_URL.
 *  H-02 pair reset on success · H-03 AUTOFILL_RUNNING · H-06 per-recipient ops alerts · S-29 assigned Developer's
 *  open deals · S-30 self-decision guard (custom roles) · T-01 GCM tag length · controls: common / email-name
 *  passwords, meetings validation, page bound, security notices, own sessions list + revoke one, denied admin
 *  audit, failed sign-in surge alert, Clear-Site-Data, per-purpose keys with legacy / previous-secret fallback.
 */
import crypto from 'crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { config } from '../config/index.js';
import { pool, query, withTransaction } from '../db/pool.js';
import { DEV_TOTP_SECRET } from '../db/seed.js';
import { storeEnrolledSecret } from '../modules/identity/twoFactor.js';
import { hashToken, deriveCsrfToken } from '../modules/identity/security.js';
import * as keys from '../modules/identity/keys.js';
import { GCM_TAG_BYTES, SecretBoxError, openSecret, sealSecret } from '../modules/identity/secretBox.js';
import { decryptSecret, encryptSecret } from '../modules/notifications/secrets.js';
import { containsEmailName, isCommonPassword } from '../modules/identity/passwordPolicy.js';
import { FAILED_SIGNIN_SURGE_THRESHOLD, noteFailedSignIn, resetFailedSignInsForTests } from '../modules/identity/limits.js';
import { ownerSelfDecision } from '../modules/attendance/service.js';
import { OPS_ALERT_MAX_ATTEMPTS, sendOpsAlerts } from '../modules/notifications/opsAlerts.js';
import { businessEventsNotificationConsumer } from '../modules/notifications/service.js';
import { mailSink, setEmailTransport } from '../modules/notifications/transport.js';
import { relayOutboxOnce } from '../modules/platform/service.js';
import { MAX_PAGE, PageQuerySchema } from '../shared/pagination.js';
import { CreateMeetingBody } from '../modules/meetings/schemas.js';
import { EXPORT_LIMITS } from '../modules/reports/service.js';
import type { EmailSendResult, EmailTransport } from '../shared/outbox.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const uniq = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

// ------------------------------------------------------------------------------------------------- pure

describe('T-01: AES-256-GCM refuses truncated tags', () => {
  const key = { id: 'k1', key: crypto.randomBytes(32) };
  const ring = new Map([[key.id, key]]);
  it('secretBox: a 16-byte tag opens; the same tag cut to 4..15 bytes never does', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', 'emp-1', key);
    expect(openSecret(sealed, 'emp-1', ring)).toBe('JBSWY3DPEHPK3PXP');
    const [v, iv, tag, ct] = sealed.ciphertext.split('.');
    const full = Buffer.from(tag, 'base64url');
    expect(full.length).toBe(GCM_TAG_BYTES);
    for (const n of [4, 8, 12, 15]) {
      const cut = { ...sealed, ciphertext: [v, iv, full.subarray(0, n).toString('base64url'), ct].join('.') };
      expect(() => openSecret(cut, 'emp-1', ring)).toThrow(SecretBoxError);
    }
  });
  it('notification secrets: truncated tags are refused (null), the full tag decrypts', () => {
    const id = crypto.randomUUID();
    const sealed = encryptSecret('raw-token', id);
    expect(decryptSecret(sealed, id)).toBe('raw-token');
    const [v, iv, tag, ct] = sealed.split('.');
    for (const n of [4, 12]) expect(decryptSecret([v, iv, Buffer.from(tag, 'base64url').subarray(0, n).toString('base64url'), ct].join('.'), id)).toBeNull();
  });
});

describe('Per-purpose keys (controls gap: key separation and rotation)', () => {
  afterEach(() => {
    (config.session as { previousSecret: string | null }).previousSecret = null;
  });
  it('each purpose has its own key, none equal to SESSION_SECRET; legacy hashes are still candidates', () => {
    const k = ['session-token', 'csrf', 'reset-token', 'notification-secrets'].map((p) => keys.purposeKey(config.session.secret, p as keys.KeyPurpose).toString('hex'));
    expect(new Set(k).size).toBe(4);
    const t = crypto.randomBytes(32).toString('hex');
    const candidates = keys.tokenHashCandidates('session-token', t);
    expect(candidates[0]).toBe(keys.tokenHash('session-token', t));
    expect(candidates).toContain(hashToken(config.session.secret, t)); // legacy (raw secret)
    expect(keys.tokenHash('session-token', t)).not.toBe(keys.tokenHash('reset-token', t));
    expect(keys.csrfTokenCandidates('sid', 'n')).toContain(deriveCsrfToken(config.session.secret, 'sid', 'n'));
  });
  it('SESSION_SECRET_PREVIOUS: values made with the previous secret are still accepted during a rotation', () => {
    const previous = crypto.randomBytes(32).toString('hex');
    const t = 'token-made-before-rotation';
    const oldHash = crypto.createHmac('sha256', keys.purposeKey(previous, 'reset-token')).update(t).digest('hex');
    expect(keys.tokenHashCandidates('reset-token', t)).not.toContain(oldHash);
    (config.session as { previousSecret: string | null }).previousSecret = previous;
    expect(keys.tokenHashCandidates('reset-token', t)).toContain(oldHash);
    expect(keys.tokenHashCandidates('reset-token', t)).toContain(hashToken(previous, t));
    expect(keys.notificationSecretKeys()).toHaveLength(2);
  });
});

describe('New-password policy (controls gap V6.2, S-33)', () => {
  it('refuses common passwords and their decorated variants, sequences and repeats', () => {
    for (const p of ['Password1234!', 'P@ssw0rd-2026', 'qwertyuiop12', '123456789012', 'Summer2026!!', 'passwordpassword', 'aaaaaaaaaaaa', 'abcdefghijkl', 'Welcome12345', 'udigity12345'])
      expect(isCommonPassword(p), p).toBe(true);
  });
  it('accepts ordinary passphrases', () => {
    for (const p of ['a brand new passphrase', 'A-new-password-456!', 'H invited passphrase 1', 'correct horse battery staple', 'Cedar-Lamp-Orbit-42'])
      expect(isCommonPassword(p), p).toBe(false);
  });
  it('refuses the email local part (also without separators)', () => {
    expect(containsEmailName('my maya.khoury pass', 'maya.khoury@udigity.demo')).toBe(true);
    expect(containsEmailName('MayaKhoury-2026-xyz', 'maya.khoury@udigity.demo')).toBe(true);
    expect(containsEmailName('a brand new passphrase', 'maya.khoury@udigity.demo')).toBe(false);
  });
});

describe('Validation hardening (controls gaps)', () => {
  it('page has an upper bound', () => {
    expect(PageQuerySchema.safeParse({ page: String(MAX_PAGE) }).success).toBe(true);
    expect(PageQuerySchema.safeParse({ page: String(MAX_PAGE + 1) }).success).toBe(false);
    expect(PageQuerySchema.safeParse({ page: '1e300' }).success).toBe(false);
  });
  it('meetings: control characters in free text and out-of-range dates are refused', () => {
    const base = { dealId: crypto.randomUUID(), startsAt: '2027-01-05T09:00:00+02:00', attendeeIds: [crypto.randomUUID()] };
    expect(CreateMeetingBody.safeParse(base).success).toBe(true);
    expect(CreateMeetingBody.safeParse({ ...base, title: 'a\u0000b' }).success).toBe(false);
    expect(CreateMeetingBody.safeParse({ ...base, agenda: 'x\u0007y' }).success).toBe(false);
    expect(CreateMeetingBody.safeParse({ ...base, startsAt: '9999-01-05T09:00:00+02:00' }).success).toBe(false);
  });
  it('S-32: the export row cap is 10,000', () => {
    expect(EXPORT_LIMITS.rowCap).toBe(10_000);
  });
});

describe('S-30 self-decision guard', () => {
  it('only the Owner may decide their own record, and only with a reason; custom roles get SELF_DECISION', () => {
    const me = crypto.randomUUID();
    expect(ownerSelfDecision({ role: 'owner', employeeId: me }, crypto.randomUUID(), undefined, 'x')).toBe(false);
    expect(ownerSelfDecision({ role: 'owner', employeeId: me }, me, 'forgot', 'x')).toBe(true);
    expect(() => ownerSelfDecision({ role: 'owner', employeeId: me }, me, '  ', 'x')).toThrow(/Validation failed/);
    for (const role of ['data_entry', 'call_center', 'developer', 'h_custom_ops']) {
      try {
        ownerSelfDecision({ role, employeeId: me }, me, 'forgot', 'not yours');
        expect.unreachable();
      } catch (e) {
        expect((e as { statusCode: number; details: { reason: string } }).statusCode).toBe(403);
        expect((e as { details: { reason: string } }).details.reason).toBe('SELF_DECISION');
      }
    }
  });
});

describe('Security notice events are consumed (controls gap V6.4-b)', () => {
  it('password change, 2FA enrolment and recovery-code regeneration have an in-app consumer', () => {
    for (const e of ['password.changed', 'two_factor.enrolled', 'two_factor.recovery_codes_regenerated', 'two_factor.recovery_succeeded'])
      expect(businessEventsNotificationConsumer.events).toContain(e);
  });
});

// ------------------------------------------------------------------------------------------------- DB

interface Agent {
  cookie: string;
  csrf: string;
  id: string;
  email: string;
}
const cookieFrom = (res: request.Response) =>
  (([] as string[]).concat(res.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${config.session.cookieName}=`)) ?? '').split(';')[0];

function call(a: Agent, method: 'get' | 'post' | 'delete', path: string, body?: object, csrf = true) {
  const r = request(app)[method](path).set('Cookie', a.cookie);
  if (method !== 'get') {
    r.set('Origin', ORIGIN);
    if (csrf) r.set('X-CSRF-Token', a.csrf);
  }
  return body ? r.send(body) : r;
}

async function makeEmployee(role: string): Promise<{ id: string; email: string }> {
  const email = `fx2.${role}.${uniq()}@test.local`;
  const { rows } = await query<{ id: string }>(`INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, 'FX2 Tester', $2, true) RETURNING id`, [email, role]);
  await query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [rows[0].id, await bcrypt.hash(PASSWORD, 4)]);
  return { id: rows[0].id, email };
}

const loginFrom = (ip: string, email: string, password: string) =>
  request(app).post('/api/auth/login').set('Origin', ORIGIN).set('X-Forwarded-For', ip).send({ email, password });

async function signIn(e: { id: string; email: string }): Promise<Agent> {
  const l = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: e.email, password: PASSWORD });
  expect(l.status, JSON.stringify(l.body)).toBe(200);
  return { cookie: cookieFrom(l), csrf: l.body.csrfToken, id: e.id, email: e.email };
}

async function ownerAgent(): Promise<Agent> {
  const e = await makeEmployee('owner');
  await withTransaction((tx) => storeEnrolledSecret(tx, e.id, DEV_TOTP_SECRET));
  const l = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: e.email, password: PASSWORD });
  const v = await request(app)
    .post('/api/auth/2fa/verify')
    .set('Cookie', cookieFrom(l))
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', l.body.csrfToken)
    .send({ token: authenticator.generate(DEV_TOTP_SECRET) });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken, id: e.id, email: e.email };
}

async function relayOwn(): Promise<void> {
  for (let i = 0; i < 200; i++) if ((await relayOutboxOnce()).claimed === 0) return;
}

const until = async <T>(fn: () => Promise<T | null | undefined>, ms = 3000): Promise<T | null> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
};

describe.skipIf(!hasTestDb)('FIX2-BE API behaviour', { timeout: 60_000 }, () => {
  const trust = app.get('trust proxy');
  beforeAll(() => {
    app.set('trust proxy', true);
  });
  afterAll(() => {
    app.set('trust proxy', trust);
    setEmailTransport(null);
    delete process.env.ALERT_EMAIL_TO;
  });

  it('H-02: a successful sign-in clears the (email, IP) failure count', async () => {
    const e = await makeEmployee('data_entry');
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    for (let i = 0; i < config.lockout.maxFailures - 1; i++) expect((await loginFrom(ip, e.email, 'Wrong-password-000')).status).toBe(401);
    expect((await loginFrom(ip, e.email, PASSWORD)).status).toBe(200);
    expect((await loginFrom(ip, e.email, 'Wrong-password-000')).status).toBe(401);
    expect((await loginFrom(ip, e.email, 'Wrong-password-000')).status).toBe(401);
    // Before the fix the pair had 6 failures counted here and the correct password got 429.
    const ok = await loginFrom(ip, e.email, PASSWORD);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
  });

  it('H-03: an auto-fill started while another runs answers 409 AUTOFILL_RUNNING at once', async () => {
    const owner = await ownerAgent();
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended('calling.autofill', 0))`);
      const t0 = Date.now();
      const r = await call(owner, 'post', '/api/calling-assignments/autofill', {});
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('AUTOFILL_RUNNING');
      expect(Date.now() - t0).toBeLessThan(4000); // not the 5 s lock_timeout
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
    expect((await call(owner, 'post', '/api/calling-assignments/autofill', {})).status).toBe(200);
  });

  it('H-06: an alert is re-sent only to the recipient that failed; one exhausting its attempts is marked failed', async () => {
    const parked = await query<{ id: string }>(
      `UPDATE ops_alerts SET lease_until = now() + interval '1 hour' WHERE sent_at IS NULL AND failed_at IS NULL AND lease_until IS NULL RETURNING id`
    );
    const sent: string[] = [];
    let failFor = new Set<string>(['b@ops.test']);
    const transport: EmailTransport = {
      kind: 'memory',
      async send(m): Promise<EmailSendResult> {
        if (failFor.has(m.to)) return { ok: false, permanent: false, error: 'mailbox busy' };
        sent.push(m.to);
        return { ok: true };
      },
    };
    try {
      setEmailTransport(transport);
      process.env.ALERT_EMAIL_TO = 'a@ops.test,b@ops.test';
      const k = `test.fx2.${crypto.randomUUID()}`;
      const { rows } = await query<{ id: string }>(`INSERT INTO ops_alerts (kind, detail, dedupe_key) VALUES ($1, 'x', $1) RETURNING id`, [k]);
      const id = rows[0].id;
      await sendOpsAlerts();
      expect(sent).toEqual(['a@ops.test']);
      const r1 = (await query(`SELECT sent_at, failed_at, delivered_to FROM ops_alerts WHERE id = $1`, [id])).rows[0];
      expect(r1.sent_at).toBeNull();
      expect(r1.delivered_to).toEqual(['a@ops.test']);
      // Retry: only b is tried again; once it accepts, the alert is sent and a is not mailed twice.
      failFor = new Set();
      await sendOpsAlerts();
      expect(sent).toEqual(['a@ops.test', 'b@ops.test']);
      expect((await query(`SELECT sent_at FROM ops_alerts WHERE id = $1`, [id])).rows[0].sent_at).not.toBeNull();

      // Exhaustion: b keeps failing until the attempt cap → failed_at set (visible), never claimed again.
      failFor = new Set(['b@ops.test']);
      const k2 = `test.fx2.${crypto.randomUUID()}`;
      const { rows: r2 } = await query<{ id: string }>(`INSERT INTO ops_alerts (kind, detail, dedupe_key) VALUES ($1, 'x', $1) RETURNING id`, [k2]);
      for (let i = 0; i < OPS_ALERT_MAX_ATTEMPTS + 2; i++) await sendOpsAlerts();
      const row = (await query(`SELECT sent_at, failed_at, attempts, delivered_to FROM ops_alerts WHERE id = $1`, [r2[0].id])).rows[0];
      expect(row.sent_at).toBeNull();
      expect(row.failed_at).not.toBeNull();
      expect(row.attempts).toBe(OPS_ALERT_MAX_ATTEMPTS);
      expect(row.delivered_to).toEqual(['a@ops.test']);
      expect(sent.filter((x) => x === 'a@ops.test')).toHaveLength(2); // once per alert
      const dash = await call(await ownerAgent(), 'get', '/api/dashboard');
      expect(dash.status).toBe(200);
      expect(dash.body.deliveryMonitor.failedOpsAlertsCount).toBeGreaterThanOrEqual(1);
      await query(`DELETE FROM ops_alerts WHERE kind = ANY($1::text[])`, [[k, k2]]);
    } finally {
      setEmailTransport(null);
      delete process.env.ALERT_EMAIL_TO;
      await query(`UPDATE ops_alerts SET lease_until = NULL WHERE id = ANY($1::uuid[])`, [parked.rows.map((r) => r.id)]);
    }
  });

  it('S-29: the assigned Developer lists their open deals (tab=accepted&scope=assigned_to_me); never unassigned or others', async () => {
    const owner = await ownerAgent();
    const devA = await signIn(await makeEmployee('developer'));
    const devB = await signIn(await makeEmployee('developer'));
    const tag = uniq();
    const deal = async (dev: string | null) => {
      const { rows: b } = await query<{ id: string }>(`INSERT INTO businesses (name, created_by) VALUES ($1, $2) RETURNING id`, [`FX2 S29 ${uniq()}.${tag}`, owner.id]);
      const { rows: a } = await query<{ id: string }>(
        `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1, $2, 'accepted', $3) RETURNING id`,
        [b[0].id, owner.id, crypto.randomUUID()]
      );
      const { rows } = await query<{ id: string }>(
        `INSERT INTO deals (business_id, accepted_attempt_id, accepted_by_id, client_needs_note, assigned_developer_id) VALUES ($1, $2, $3, 'fx2', $4) RETURNING id`,
        [b[0].id, a[0].id, owner.id, dev]
      );
      return rows[0].id;
    };
    const mine1 = await deal(devA.id);
    const mine2 = await deal(devA.id);
    const unassigned = await deal(null);
    const others = await deal(devB.id);
    const ids = async (a: Agent, qs: string) => {
      const r = await call(a, 'get', `/api/deals?${qs}&pageSize=100`);
      expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
      return (r.body.items as { id: string; stage: string }[]).map((d) => d.id);
    };
    for (const qs of ['tab=accepted&scope=assigned_to_me', 'tab=accepted&assignedToMe=true', 'tab=accepted']) {
      const seen = await ids(devA, qs);
      expect(seen, qs).toEqual(expect.arrayContaining([mine1, mine2]));
      expect(seen, qs).not.toContain(unassigned);
      expect(seen, qs).not.toContain(others);
    }
    expect(await ids(devB, 'tab=accepted&scope=assigned_to_me')).toEqual([others]);
    expect((await call(devA, 'get', `/api/deals/${mine1}`)).status).toBe(200);
    expect([403, 404]).toContain((await call(devA, 'get', `/api/deals/${others}`)).status);
  });

  it('passwords: PASSWORD_COMMON and PASSWORD_CONTAINS_EMAIL on change and on reset; a good one works and notifies', async () => {
    const e = await makeEmployee('call_center');
    const a = await signIn(e);
    const change = (newPassword: string) => call(a, 'post', '/api/auth/password/change', { currentPassword: PASSWORD, newPassword });
    const common = await change('Password1234!');
    expect(common.status).toBe(400);
    expect(common.body).toMatchObject({ code: 'VALIDATION_ERROR', details: { reason: 'PASSWORD_COMMON' } });
    expect(common.body.details.password[0]).toMatch(/too common/);
    const local = e.email.split('@')[0];
    const withEmail = await change(`x ${local} y`);
    expect(withEmail.status).toBe(400);
    expect(withEmail.body.details.reason).toBe('PASSWORD_CONTAINS_EMAIL');
    const ok = await change('Cedar-Lamp-Orbit-42');
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const ev = await query(`SELECT 1 FROM outbox_events WHERE name = 'password.changed' AND aggregate_id = $1`, [e.id]);
    expect(ev.rowCount).toBe(1);
    await relayOwn();
    const inbox = await call({ ...a, cookie: cookieFrom(ok) || a.cookie }, 'get', '/api/notifications?pageSize=50');
    expect(inbox.status).toBe(200);
    expect(JSON.stringify(inbox.body)).toContain('Password Changed');

    // Reset completion: email check, and a link hashed with the LEGACY derivation still works (keys.ts).
    const raw = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO security_tokens (employee_id, purpose, token_hash, expires_at) VALUES ($1, 'password_reset', $2, now() + interval '20 minutes')`,
      [e.id, hashToken(config.session.secret, raw)]
    );
    const reset = (newPassword: string) => request(app).post('/api/auth/password-reset/complete').set('Origin', ORIGIN).send({ token: raw, newPassword });
    expect((await reset('Qwertyuiop123')).body.details?.reason).toBe('PASSWORD_COMMON');
    expect((await reset(`${local.toUpperCase()} again 77`)).body.details?.reason).toBe('PASSWORD_CONTAINS_EMAIL');
    expect((await reset('Velvet harbor ninety')).status).toBe(200);
  });

  it('sessions: list own (current flag, masked IP), revoke one with CSRF; another employee\'s id is 404', async () => {
    const e = await makeEmployee('developer');
    const a = await signIn(e);
    const bLogin = await loginFrom('203.0.113.77', e.email, PASSWORD);
    const b: Agent = { cookie: cookieFrom(bLogin), csrf: bLogin.body.csrfToken, id: e.id, email: e.email };
    const list = await call(a, 'get', '/api/auth/sessions');
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    const current = list.body.items.find((s: { current: boolean }) => s.current);
    const other = list.body.items.find((s: { current: boolean }) => !s.current);
    expect(Object.keys(current).sort()).toEqual(['createdAt', 'current', 'expiresAt', 'id', 'ip', 'lastSeenAt', 'state', 'userAgent']);
    expect(other.ip).toBe('203.0.113.x');
    expect(JSON.stringify(list.body)).not.toMatch(/token|hash/i);

    expect((await call(a, 'delete', `/api/auth/sessions/${other.id}`, undefined, false)).status).toBe(403); // CSRF
    const stranger = await signIn(await makeEmployee('developer'));
    expect((await call(stranger, 'delete', `/api/auth/sessions/${other.id}`)).status).toBe(404);
    const del = await call(a, 'delete', `/api/auth/sessions/${other.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ revoked: 1, currentSessionEnded: false });
    expect((await call(b, 'get', '/api/auth/me')).status).toBe(401);
    expect((await call(a, 'get', '/api/auth/me')).status).toBe(200);
    const audit = await query(`SELECT 1 FROM audit_events WHERE event_name = 'session.revoked' AND entity_id = $1`, [other.id]);
    expect(audit.rowCount).toBe(1);
    // Logout clears the browser's cache and storage for the origin.
    const out = await call(a, 'post', '/api/auth/logout', {});
    expect(out.status).toBe(200);
    expect(out.headers['clear-site-data']).toBe('"cache", "storage"');
  });

  it('a session issued with the legacy hash still authenticates and is re-keyed on use; legacy CSRF still accepted', async () => {
    const e = await makeEmployee('data_entry');
    const raw = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    const { rows } = await query<{ id: string }>(
      `INSERT INTO sessions (token, token_hash, csrf_nonce, employee_id, role, state, is_pending_2fa, expires_at, idle_expires_at)
       VALUES (NULL, $1, $2, $3, 'data_entry', 'active', false, now() + interval '1 hour', now() + interval '1 hour') RETURNING id`,
      [hashToken(config.session.secret, raw), nonce, e.id]
    );
    const a: Agent = { cookie: `${config.session.cookieName}=${raw}`, csrf: deriveCsrfToken(config.session.secret, rows[0].id, nonce), id: e.id, email: e.email };
    const me = await call(a, 'get', '/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.csrfToken).toBe(keys.csrfToken(rows[0].id, nonce)); // new tokens use the per-purpose key
    const stored = await query<{ token_hash: string }>('SELECT token_hash FROM sessions WHERE id = $1', [rows[0].id]);
    expect(stored.rows[0].token_hash).toBe(keys.tokenHash('session-token', raw));
    expect((await call(a, 'post', '/api/auth/logout', {})).status).toBe(200); // legacy CSRF token
  });

  it('a denied admin action (403 on an admin row) leaves an access.denied audit row', async () => {
    const de = await signIn(await makeEmployee('data_entry'));
    const r = await call(de, 'get', '/api/employees');
    expect(r.status).toBe(403);
    const row = await until(async () =>
      (await query<{ payload: { action: string } }>(`SELECT payload FROM audit_events WHERE event_name = 'access.denied' AND actor_id = $1`, [de.id])).rows[0]
    );
    expect(row?.payload).toMatchObject({ action: 'employee.list', method: 'GET' });
  });

  it('failed sign-in surge: the threshold within 5 minutes raises one operator alert', async () => {
    resetFailedSignInsForTests();
    const t = new Date(Date.UTC(2031, 0, 1, 10, Math.floor(Math.random() * 59)));
    let raised = 0;
    for (let i = 0; i < FAILED_SIGNIN_SURGE_THRESHOLD + 5; i++) if (await noteFailedSignIn(t)) raised++;
    expect(raised).toBe(1);
    const a = await query<{ occurrences: number }>(`SELECT occurrences FROM ops_alerts WHERE kind = 'auth.failed_signin_surge' AND created_at = $1`, [t]);
    expect(a.rowCount).toBe(1);
    await query(`DELETE FROM ops_alerts WHERE kind = 'auth.failed_signin_surge' AND created_at = $1`, [t]);
    resetFailedSignInsForTests();
  });

  it('page above the bound is a 400 on a list route', async () => {
    const owner = await ownerAgent();
    expect((await call(owner, 'get', `/api/deals?page=${MAX_PAGE + 1}`)).status).toBe(400);
    expect((await call(owner, 'get', `/api/deals?page=${MAX_PAGE}`)).status).toBe(200);
  });

  afterAll(() => {
    mailSink.clear();
  });
});
