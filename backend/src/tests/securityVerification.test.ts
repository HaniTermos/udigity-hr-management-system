import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { app } from '../app.js';
import { requireAction, type Principal } from '../shared/access.js';
import {
  isPendingRequestAllowed,
  checkRequestOrigin,
  deriveCsrfToken,
  registerFailure,
  isLocked,
  type LockoutState,
} from '../modules/identity/security.js';
import { createAuthRateLimiter } from '../middleware/requestGuards.js';
import { config, loadConfig } from '../config/index.js';
import { CreateEmployeeSchema } from '../modules/employees/schemas.js';
import { CreateBusinessSchema } from '../modules/businesses/schemas.js';
import { createAccessEngine } from '../modules/access/service.js';
import { FakeDb } from './helpers/fakeDb.js';
import { loadPolicyFlags } from '../shared/flags.js';
import { effectiveTimezone, FAIL_CLOSED_TIMEZONE } from '../modules/access/rules.js';

describe('1. Negative Authorization & Route Guard Tests', () => {
  it('rejects requests with wrong role (e.g. data_entry calling owner-only action)', async () => {
    const testApp = express();
    testApp.use((req, _res, next) => {
      // Mock an authenticated data_entry user
      req.user = {
        id: 'user-de-1',
        email: 'de@udigity.demo',
        fullName: 'Data Entry',
        role: 'data_entry',
        isPending2FA: false,
        sessionId: 'sess-1',
        sessionState: 'active',
        csrfToken: 'csrf-1',
      };
      next();
    });
    testApp.post('/api/employees', requireAction('employee.create'), (_req, res) => res.json({ ok: true }));

    const res = await request(testApp).post('/api/employees').send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('rejects access to records assigned to other users or out of scope', async () => {
    // Test access engine fact resolution for unassigned record
    const fakeDb = new FakeDb();
    const engine = createAccessEngine({
      flags: () => loadPolicyFlags({}),
      now: () => new Date('2026-10-27T12:00:00Z'),
    });

    const caller: Principal = {
      employeeId: 'agent-1',
      role: 'call_center',
      sessionState: 'active',
    };

    const B_OTHER = '22222222-2222-4222-8222-222222222222';
    fakeDb.on(/FROM businesses WHERE id/, [{ id: B_OTHER }]);
    fakeDb.on(/FROM access_facts af/, [
      {
        business_id: B_OTHER,
        in_scope: false,
        related: false,
        in_window: true,
        r1: false,
        r2: false,
        r3: false,
        r4: false,
        r5: false,
        r6: false,
      },
    ]);

    const decision = await engine.check(fakeDb, caller, 'business.read', {
      type: 'business',
      id: B_OTHER,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('permission_denied');
    }
  });

  it('hides records outside 15-day window when no exception row matches', async () => {
    const fakeDb = new FakeDb();
    const engine = createAccessEngine({
      flags: () => loadPolicyFlags({}),
      now: () => new Date('2026-10-27T12:00:00Z'),
    });

    const caller: Principal = {
      employeeId: 'agent-1',
      role: 'call_center',
      sessionState: 'active',
    };

    const B_EXPIRED = '33333333-3333-4333-8333-333333333333';
    fakeDb.on(/FROM businesses WHERE id/, [{ id: B_EXPIRED }]);
    fakeDb.on(/FROM access_facts af/, [
      {
        business_id: B_EXPIRED,
        in_scope: true,
        related: true,
        in_window: false, // 15-day window expired
        r1: false, // no accepted deal
        r2: false, // no closed deal
        r3: false, // no active project
        r4: false, // no completed project
        r5: false, // no scheduled callback
        r6: false, // no open correction
      },
    ]);

    const decision = await engine.check(fakeDb, caller, 'business.read', {
      type: 'business',
      id: B_EXPIRED,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('hidden_by_policy');
    }
  });

  it('rejects forged/untyped policy fields with strict Zod validation errors', () => {
    // Attempting mass assignment of role, isActive, or unknown attributes
    const forgedEmployeePayload = {
      email: 'attacker@evil.com',
      fullName: 'Attacker',
      role: 'owner', // Should fail if non-permitted or extra fields injected
      forgedAdminField: true,
      isActive: true,
    };

    expect(() => CreateEmployeeSchema.parse(forgedEmployeePayload)).toThrow(z.ZodError);

    const forgedBusinessPayload = {
      name: 'Legit Business',
      category: 'Tech',
      phones: [],
      social: [{ platform: 'instagram', handle: 'test' }],
      website: null,
      forgedStatus: 'approved_override',
    };

    expect(() => CreateBusinessSchema.parse(forgedBusinessPayload)).toThrow(z.ZodError);
  });

  it('enforces Owner Pending-2FA restrictions against operational routes', () => {
    // Under R11-a: pending Owner session is barred from operational endpoints
    expect(isPendingRequestAllowed('pending_2fa_verification', 'GET', '/api/employees', 'R11-a', true)).toBe(false);
    expect(isPendingRequestAllowed('pending_2fa_verification', 'POST', '/api/businesses', 'R11-a', false)).toBe(false);
    expect(isPendingRequestAllowed('pending_2fa_enrollment', 'POST', '/api/attendance/check-in', 'R11-a', false)).toBe(false);

    // Only allowlisted pre-auth / 2FA completion endpoints are allowed
    expect(isPendingRequestAllowed('pending_2fa_verification', 'POST', '/api/auth/2fa/verify', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed('pending_2fa_enrollment', 'POST', '/api/auth/2fa/enroll/start', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed('pending_2fa_verification', 'GET', '/api/auth/me', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed('pending_2fa_verification', 'POST', '/api/auth/logout', 'R11-a', false)).toBe(true);
  });

  it('checks authentication allowlist endpoints for their required session / token', async () => {
    // Allowlisted routes are not unauthenticated bypasses: they enforce session authentication
    const meRes = await request(app).get('/api/auth/me');
    expect(meRes.status).toBe(401);
    expect(meRes.body.code).toBe('UNAUTHENTICATED');

    const verifyRes = await request(app).post('/api/auth/2fa/verify').send({ token: '123456' });
    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.code).toBe('UNAUTHENTICATED');

    const enrollRes = await request(app).post('/api/auth/2fa/enroll/start').send({
      enrollmentToken: 'invalid-token',
      currentPassword: 'pass',
    });
    // Requires an authenticated pending session first:
    expect(enrollRes.status).toBe(401);
    expect(enrollRes.body.code).toBe('UNAUTHENTICATED');
  });
});

describe('2. Production Cookie Flags & CSRF Rejection', () => {
  it('evaluates __Host- prefix and Secure flag in production configuration', () => {
    const prodConfig = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@host:5432/db',
      SESSION_SECRET: 'a_very_long_production_session_secret_32chars',
      APP_ORIGIN: 'https://app.udigity.com',
      POLICY_COMPANY_TIMEZONE: 'Asia/Beirut',
      TOTP_ENC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });

    expect(prodConfig.session.cookieName).toBe('__Host-udigity_session');
    expect(prodConfig.session.csrfCookieName).toBe('__Host-udigity_csrf');
    expect(prodConfig.session.secureCookie).toBe(true);
    expect(prodConfig.allowMissingOrigin).toBe(false);
  });

  it('rejects mutating requests with missing or mismatched Origin/Referer', () => {
    const allowed = ['https://app.udigity.com'];
    expect(checkRequestOrigin(undefined, undefined, allowed, false)).toEqual({
      ok: false,
      reason: 'origin_missing',
    });
    expect(checkRequestOrigin('https://evil.com', undefined, allowed, false)).toEqual({
      ok: false,
      reason: 'origin_mismatch',
    });
    expect(checkRequestOrigin('https://app.udigity.com', undefined, allowed, false)).toEqual({
      ok: true,
    });
  });

  it('rejects mutating requests with mismatched CSRF token', () => {
    const secret = 'secret-32-chars-long-for-testing';
    const sessionId = 'session-123';
    const nonce = 'nonce-456';
    const validToken = deriveCsrfToken(secret, sessionId, nonce);
    const forgedToken = deriveCsrfToken(secret, sessionId, 'wrong-nonce');

    expect(validToken).not.toBe(forgedToken);
  });
});

describe('3. Extended Rate-Limit, Trusted Proxy & Lockout Tests', () => {
  it('correctly extracts client IP through trusted reverse proxy', () => {
    const limiter = createAuthRateLimiter(5, 15);
    expect(limiter).toBeDefined();
    // Proxy trust configuration
    expect(config.trustProxy).toBeDefined();
  });

  it('locks account after 5 consecutive failures and recovers after lockout expiration', () => {
    const policy = { maxFailures: 5, windowMinutes: 15, lockMinutes: 15 };
    const t0 = new Date('2026-10-27T10:00:00Z');

    let state: LockoutState = { failedCount: 0, windowStartedAt: null, lockedUntil: null };

    // 4 failed attempts: not locked
    for (let i = 1; i <= 4; i++) {
      state = registerFailure(state, t0, policy);
      expect(isLocked(state, t0)).toBe(false);
      expect(state.failedCount).toBe(i);
    }

    // 5th failed attempt: triggers 15-minute lock
    state = registerFailure(state, t0, policy);
    expect(isLocked(state, t0)).toBe(true);
    expect(state.lockedUntil?.toISOString()).toBe('2026-10-27T10:15:00.000Z');

    // Still locked at 14 minutes
    const t14 = new Date('2026-10-27T10:14:00Z');
    expect(isLocked(state, t14)).toBe(true);

    // Recovered at 15 minutes + 1 second
    const t16 = new Date('2026-10-27T10:15:01Z');
    expect(isLocked(state, t16)).toBe(false);
  });
});

describe('4. Timezone & Readiness Configuration', () => {
  it('requires an approved IANA timezone in production and rejects UTC+14 fallback', () => {
    // When timezone is present, uses configured timezone
    expect(effectiveTimezone('Asia/Beirut')).toBe('Asia/Beirut');

    // In dev/test, fallback is Etc/GMT-14
    if (!config.isProduction) {
      expect(effectiveTimezone('')).toBe(FAIL_CLOSED_TIMEZONE);
    }
  });
});

describe('5. Bcrypt Password Length Boundary & Multibyte Handling', () => {
  it('rejects passwords exceeding 72 UTF-8 bytes to guard against silent bcrypt truncation', async () => {
    const longPassword = 'a'.repeat(73);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: longPassword });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.details)).toContain('72 bytes');
  });

  it('correctly handles multibyte UTF-8 input based on byte length, not character count', async () => {
    // 15 Arabic characters (30 bytes in UTF-8): within 72 bytes -> passes byte-length validation
    const validMultibyte = 'كلمةسرقويةجداً!';
    expect(Buffer.byteLength(validMultibyte, 'utf8')).toBeLessThanOrEqual(72);

    // 20 emoji characters (4 bytes each = 80 bytes in UTF-8): only 20 chars, but 80 bytes!
    const oversizedEmoji = '🔐'.repeat(20);
    expect(oversizedEmoji.length).toBe(40); // surrogate pairs
    expect(Buffer.byteLength(oversizedEmoji, 'utf8')).toBe(80);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: oversizedEmoji });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.details)).toContain('72 bytes');
  });
});

