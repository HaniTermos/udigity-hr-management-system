/**
 * Route- and middleware-level tests WITHOUT a database: the pg pool is replaced by a scripted FakeDb.
 * Covers: 2FA dev-bypass removal, session rotation, TOTP replay and lockout, login lockout and
 * generic errors, no token in the body / no Bearer path, idle expiry, CSRF, Origin check, rate limit,
 * and the employee status guards.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { FakeDb } from './helpers/fakeDb.js';

const fake = vi.hoisted(() => ({ db: null as unknown as FakeDb }));

vi.mock('../db/pool.js', async () => {
  const { FakeDb: Fake } = await import('./helpers/fakeDb.js');
  fake.db = new Fake();
  const q = (text: string, params?: unknown[]) => fake.db.query(text, params);
  return {
    pool: { query: q, connect: async () => ({ query: q, release: () => undefined }), end: async () => undefined },
    query: q,
    getClient: async () => ({ query: q, release: () => undefined }),
    withTransaction: async <T>(fn: (c: unknown) => Promise<T>) => {
      await q('BEGIN');
      try {
        const r = await fn({ query: q });
        await q('COMMIT');
        return r;
      } catch (e) {
        await q('ROLLBACK');
        throw e;
      }
    },
  };
});

const { app } = await import('../app.js');
const { config } = await import('../config/index.js');
const { hashToken, deriveCsrfToken, totpStep } = await import('../modules/identity/security.js');
const { createAuthenticate } = await import('../middleware/auth.js');
const { createOriginCheck, createAuthRateLimiter } = await import('../middleware/requestGuards.js');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const OLD_SID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW_SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RAW = 'r'.repeat(64);
const NONCE = 'nonce-1';
const SECRET = authenticator.generateSecret();
const COOKIE = `${config.session.cookieName}=${RAW}`;
const csrf = (sid = OLD_SID) => deriveCsrfToken(config.session.secret, sid, NONCE);

function sessionRow(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    session_id: OLD_SID,
    state: 'pending_2fa_verification',
    created_at: new Date(now - 60_000),
    expires_at: new Date(now + 9 * 60_000),
    idle_expires_at: new Date(now + 60 * 60_000),
    csrf_nonce: NONCE,
    employee_id: OWNER_ID,
    email: 'owner@test.local',
    full_name: 'Owner',
    role: 'owner',
    department: null,
    job_title: null,
    is_active: true,
    ...overrides,
  };
}

function factorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    employee_id: OWNER_ID,
    // Legacy plaintext row: the route encrypts it on first use (AU-13, secret box with the test key).
    secret: SECRET,
    secret_ciphertext: null,
    secret_key_id: null,
    pending_enrollment_token_id: null,
    is_enrolled: true,
    last_used_step: null,
    failed_count: 0,
    failed_window_started_at: null,
    locked_until: null,
    ...overrides,
  };
}

function wrongCode(): string {
  for (let i = 0; i < 1000; i++) {
    const code = String(100000 + i);
    if (authenticator.checkDelta(code, SECRET) === null) return code;
  }
  throw new Error('no wrong code found');
}

beforeEach(() => {
  fake.db.reset();
  fake.db.on(/FROM sessions s JOIN employees e/, (p) => ({
    rows: p[0] === hashToken(config.session.secret, RAW) ? [sessionRow()] : [],
  }));
  fake.db.on(/INSERT INTO sessions/, () => ({ rows: [{ id: NEW_SID }] }));
});

describe('POST /api/auth/2fa/verify', () => {
  it('rejects an arbitrary 6-digit code outside production (dev bypass removed)', async () => {
    expect(config.env).not.toBe('production');
    fake.db.on(/FROM two_factor_factors .*FOR UPDATE/, [factorRow()]);
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', COOKIE)
      .set('X-CSRF-Token', csrf())
      .send({ token: wrongCode() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_2FA_TOKEN');
    expect(fake.db.find(/INSERT INTO sessions/)).toHaveLength(0);
    expect(fake.db.find(/INSERT INTO audit_events/)[0].params[0]).toBe('session.second_factor_failed');
  });

  it('rejects when no factor is configured instead of falling back to a bypass', async () => {
    fake.db.on(/FROM two_factor_factors .*FOR UPDATE/, []);
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', COOKIE)
      .set('X-CSRF-Token', csrf())
      .send({ token: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('2FA_NOT_CONFIGURED');
  });

  it('rotates the session on success: old session ended, new cookie, no token in the body', async () => {
    fake.db.on(/FROM two_factor_factors .*FOR UPDATE/, [factorRow()]);
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', COOKIE)
      .set('X-CSRF-Token', csrf())
      .send({ token: authenticator.generate(SECRET) });
    expect(res.status).toBe(200);

    const ended = fake.db.find(/UPDATE sessions SET state = 'ended'/);
    expect(ended[0].params).toEqual([OLD_SID, 'rotated']);
    const inserted = fake.db.find(/INSERT INTO sessions/)[0];
    expect(inserted.params).toContain(OLD_SID); // rotated_from
    expect(inserted.params).toContain('active');

    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const sessionCookie = cookies.find((c) => c.startsWith(`${config.session.cookieName}=`))!;
    const newRaw = sessionCookie.split(';')[0].split('=')[1];
    expect(newRaw).not.toBe(RAW);
    expect(sessionCookie).toMatch(/HttpOnly/);
    expect(JSON.stringify(res.body)).not.toContain(newRaw);
    expect(res.body.token).toBeUndefined();
    expect(res.body.csrfToken).toBe(deriveCsrfToken(config.session.secret, NEW_SID, inserted.params[1] as string));

    // The audit row is written inside the same transaction (BEGIN ... audit ... COMMIT).
    const texts = fake.db.calls.map((c) => c.text);
    const auditIdx = texts.findIndex((t) => t.startsWith('INSERT INTO audit_events'));
    expect(texts.lastIndexOf('BEGIN')).toBeLessThan(auditIdx);
    expect(texts.indexOf('COMMIT', auditIdx)).toBeGreaterThan(auditIdx);
  });

  it('rejects a replayed code (time step already used)', async () => {
    const step = totpStep(new Date(), 1);
    fake.db.on(/FROM two_factor_factors .*FOR UPDATE/, [factorRow({ last_used_step: String(step) })]);
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', COOKIE)
      .set('X-CSRF-Token', csrf())
      .send({ token: authenticator.generate(SECRET) });
    expect(res.status).toBe(400);
  });

  it('locks the factor and ends the pending session at the 5th failure', async () => {
    fake.db.on(/FROM two_factor_factors .*FOR UPDATE/, [
      factorRow({ failed_count: 4, failed_window_started_at: new Date(Date.now() - 60_000) }),
    ]);
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', COOKIE)
      .set('X-CSRF-Token', csrf())
      .send({ token: wrongCode() });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_ENDED');
    const lockUpdate = fake.db.find(/UPDATE two_factor_factors SET failed_count/)[0];
    expect(lockUpdate.params[3]).toBeInstanceOf(Date);
    expect(fake.db.find(/UPDATE sessions SET state = 'ended'/)[0].params).toEqual([OLD_SID, 'factor_threshold']);
  });

  it('refuses a locked factor without checking the code', async () => {
    fake.db.on(/FROM two_factor_factors .*FOR UPDATE/, [factorRow({ locked_until: new Date(Date.now() + 60_000) })]);
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', COOKIE)
      .set('X-CSRF-Token', csrf())
      .send({ token: authenticator.generate(SECRET) });
    expect(res.status).toBe(429);
    expect(fake.db.find(/INSERT INTO sessions/)).toHaveLength(0);
  });
});

describe('POST /api/auth/login', () => {
  const PASSWORD = 'correct horse battery';
  let hash: string;

  beforeEach(async () => {
    hash ??= await bcrypt.hash(PASSWORD, 4);
  });

  function script(emp: Record<string, unknown>, cred: Record<string, unknown> | null) {
    fake.db.on(/FROM employees WHERE LOWER\(email\)/, [
      { id: OTHER_ID, email: 'agent@test.local', full_name: 'Agent', role: 'call_center', is_active: true, ...emp },
    ]);
    fake.db.on(/FROM credentials WHERE employee_id = \$1 FOR UPDATE/, cred ? [cred] : []);
  }
  const cred = (o: Record<string, unknown> = {}) => ({
    password_hash: hash,
    failed_count: 0,
    failed_window_started_at: null,
    locked_until: null,
    ...o,
  });

  it('logs in a non-owner with a cookie only (no token in body) and a CSRF token', async () => {
    script({}, cred());
    const res = await request(app).post('/api/auth/login').send({ email: 'agent@test.local', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.requires2FA).toBe(false);
    expect(typeof res.body.csrfToken).toBe('string');
    const insert = fake.db.find(/INSERT INTO sessions/)[0];
    expect(insert.params[0]).toMatch(/^[a-f0-9]{64}$/); // token_hash, raw token never stored
  });

  it('gives a deactivated account the same generic response as a wrong password', async () => {
    script({ is_active: false }, cred());
    const deactivated = await request(app).post('/api/auth/login').send({ email: 'agent@test.local', password: PASSWORD });
    fake.db.reset();
    script({}, cred());
    const wrong = await request(app).post('/api/auth/login').send({ email: 'agent@test.local', password: 'wrong password!!' });
    expect(deactivated.status).toBe(401);
    expect(deactivated.body).toEqual(wrong.body);
    expect(deactivated.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account on the 5th failure and refuses even the right password while locked', async () => {
    script({}, cred({ failed_count: 4, failed_window_started_at: new Date(Date.now() - 60_000) }));
    const res = await request(app).post('/api/auth/login').send({ email: 'agent@test.local', password: 'nope nope nope' });
    expect(res.status).toBe(401);
    const upd = fake.db.find(/UPDATE credentials SET failed_count = \$2/)[0];
    expect(upd.params[3]).toBeInstanceOf(Date);

    fake.db.reset();
    script({}, cred({ locked_until: new Date(Date.now() + 10 * 60_000) }));
    const locked = await request(app).post('/api/auth/login').send({ email: 'agent@test.local', password: PASSWORD });
    expect(locked.status).toBe(401);
    expect(fake.db.find(/INSERT INTO sessions/)).toHaveLength(0);
  });

  it('puts an Owner without a factor into the enrollment state, not active', async () => {
    script({ id: OWNER_ID, role: 'owner' }, cred());
    fake.db.on(/SELECT is_enrolled FROM two_factor_factors/, []);
    const res = await request(app).post('/api/auth/login').send({ email: 'agent@test.local', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body.twoFactorStep).toBe('enroll');
    expect(fake.db.find(/INSERT INTO sessions/)[0].params).toContain('pending_2fa_enrollment');
  });

  it('rejects a cross-site Origin before doing anything', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'agent@test.local', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_REJECTED');
    expect(fake.db.calls).toHaveLength(0);
  });
});

describe('authenticate middleware', () => {
  function miniApp(now: Date) {
    const a = express();
    a.use((req, _res, next) => {
      req.cookies = { [config.session.cookieName]: RAW };
      next();
    });
    const auth = createAuthenticate({ db: fake.db, now: () => now });
    a.get('/api/x', auth, (_req, res) => res.json({ ok: true }));
    a.post('/api/x', auth, (_req, res) => res.json({ ok: true }));
    return a;
  }

  beforeEach(() => {
    fake.db.on(/FROM sessions s JOIN employees e/, () => ({ rows: [sessionRow({ state: 'active' })] }));
  });

  it('ends an idle-expired session and answers SESSION_EXPIRED', async () => {
    const later = new Date(Date.now() + 61 * 60_000); // idle_expires_at is now + 60 min
    fake.db.on(/FROM sessions s JOIN employees e/, () => ({
      rows: [sessionRow({ state: 'active', expires_at: new Date(Date.now() + 10 * 3_600_000) })],
    }));
    const res = await request(miniApp(later)).get('/api/x');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
    expect(fake.db.find(/UPDATE sessions SET state = 'ended'/)[0].params).toEqual([OLD_SID, 'idle_expired']);
  });

  it('slides the idle window on an accepted request', async () => {
    const now = new Date();
    const res = await request(miniApp(now)).get('/api/x');
    expect(res.status).toBe(200);
    const slide = fake.db.find(/SET last_active_at = \$2, idle_expires_at = \$3/)[0];
    expect((slide.params[2] as Date).getTime()).toBe(now.getTime() + config.session.idleMinutes * 60_000);
  });

  it('requires the CSRF token on mutations', async () => {
    const now = new Date();
    const missing = await request(miniApp(now)).post('/api/x');
    expect(missing.status).toBe(403);
    expect(missing.body.code).toBe('CSRF_FAILED');
    const wrong = await request(miniApp(now)).post('/api/x').set('X-CSRF-Token', csrf('other-session'));
    expect(wrong.status).toBe(403);
    const ok = await request(miniApp(now)).post('/api/x').set('X-CSRF-Token', csrf());
    expect(ok.status).toBe(200);
  });

  it('ignores the Authorization: Bearer header (cookie-only transport)', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${RAW}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('denies a deactivated account on its next request and ends the session', async () => {
    fake.db.on(/FROM sessions s JOIN employees e/, () => ({ rows: [sessionRow({ state: 'active', is_active: false })] }));
    const res = await request(miniApp(new Date())).get('/api/x');
    expect(res.status).toBe(401);
    expect(fake.db.find(/end_reason = 'account_deactivated'/)).toHaveLength(1);
  });

  it('blocks an Owner pending 2FA from other routes (R11-a working default)', async () => {
    fake.db.on(/FROM sessions s JOIN employees e/, () => ({ rows: [sessionRow()] }));
    const res = await request(app).get('/api/employees').set('Cookie', COOKIE);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('OWNER_2FA_REQUIRED');
  });
});

describe('Origin check and rate limit middleware', () => {
  it('rejects a missing Origin when not allowed (production behaviour)', async () => {
    const a = express();
    a.use(createOriginCheck(['https://app.example'], false));
    a.post('/x', (_req, res) => res.json({ ok: true }));
    a.get('/x', (_req, res) => res.json({ ok: true }));
    expect((await request(a).post('/x')).status).toBe(403);
    expect((await request(a).get('/x')).status).toBe(200);
    expect((await request(a).post('/x').set('Origin', 'https://app.example')).status).toBe(200);
  });

  it('returns 429 after the per-IP limit', async () => {
    const a = express();
    a.post('/login', createAuthRateLimiter(2, 15), (_req, res) => res.json({ ok: true }));
    expect((await request(a).post('/login')).status).toBe(200);
    expect((await request(a).post('/login')).status).toBe(200);
    const third = await request(a).post('/login');
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('RATE_LIMITED');
  });
});

describe('PATCH /api/employees/:id/status guards', () => {
  const ownerCookie = COOKIE;
  beforeEach(() => {
    fake.db.on(/FROM sessions s JOIN employees e/, () => ({ rows: [sessionRow({ state: 'active' })] }));
  });
  const patch = (id: string, body: unknown) =>
    request(app).patch(`/api/employees/${id}/status`).set('Cookie', ownerCookie).set('X-CSRF-Token', csrf()).send(body as object);

  it('validates the body with Zod', async () => {
    const res = await patch(OTHER_ID, { isActive: 'no' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('refuses to deactivate yourself', async () => {
    fake.db.on(/FROM employees WHERE id = \$1 FOR UPDATE/, [{ id: OWNER_ID, role: 'owner', is_active: true, version: 3 }]);
    const res = await patch(OWNER_ID, { isActive: false, version: 3 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CANNOT_DEACTIVATE_SELF');
  });

  it('refuses to deactivate the last active Owner', async () => {
    const otherOwner = '33333333-3333-4333-8333-333333333333';
    fake.db.on(/FROM employees WHERE id = \$1 FOR UPDATE/, [{ id: otherOwner, role: 'owner', is_active: true, version: 1 }]);
    fake.db.on(/role = 'owner' AND is_active = true FOR UPDATE/, [{ id: otherOwner }]);
    const res = await patch(otherOwner, { isActive: false, version: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LAST_ACTIVE_OWNER');
  });

  it('returns 409 on a stale version', async () => {
    fake.db.on(/FROM employees WHERE id = \$1 FOR UPDATE/, [{ id: OTHER_ID, role: 'call_center', is_active: true, version: 5 }]);
    const res = await patch(OTHER_ID, { isActive: false, version: 4 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VERSION_CONFLICT');
  });

  it('deactivates with audit in the same transaction, then revokes sessions', async () => {
    fake.db.on(/FROM employees WHERE id = \$1 FOR UPDATE/, [{ id: OTHER_ID, role: 'call_center', is_active: true, version: 5 }]);
    fake.db.on(/UPDATE employees SET is_active/, [
      { id: OTHER_ID, email: 'cc@test.local', full_name: 'CC', role: 'call_center', is_active: false, version: 6, created_at: new Date(), updated_at: new Date() },
    ]);
    fake.db.on(/WHERE employee_id = \$1 AND state <> 'ended' RETURNING id/, [{ id: 's9' }]);
    // E-02: the outbox insert runs in the same transaction (BE5 writer).
    fake.db.on(/INSERT INTO outbox_events/, [{ id: 'evt-1' }]);
    // Employee row open-work summary (OWN-002): BE4 open-items ops.
    fake.db.on(/FROM deals WHERE assigned_developer_id/, [{ n: '0' }]);
    fake.db.on(/FROM project_developer_assignments/, [{ projects: '0', tasks: '0' }]);
    // V-02 batched open-items ops (one grouped query per module for the page of employees).
    fake.db.on(/FROM deals WHERE assigned_developer_id = ANY/, [{ id: OTHER_ID, n: '0' }]);
    fake.db.on(/FROM project_developer_assignments pda JOIN projects p ON p.id = pda.project_id WHERE pda.developer_id = ANY/, [{ id: OTHER_ID, n: '0' }]);
    const res = await patch(OTHER_ID, { isActive: false, version: 5 });
    expect(res.status).toBe(200);
    const events = fake.db.find(/INSERT INTO audit_events/).map((c) => c.params[0]);
    expect(events).toEqual(['account.deactivated', 'session.revoked']);
    expect(fake.db.find(/INSERT INTO outbox_events/).map((c) => c.params[0])).toEqual(['account.deactivated']);
  });
});
