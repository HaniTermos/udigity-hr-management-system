import { describe, it, expect } from 'vitest';
import {
  checkRequestOrigin,
  deriveCsrfToken,
  evaluateSession,
  hashToken,
  isLocked,
  isPendingRequestAllowed,
  isReplayedStep,
  registerFailure,
  CLEARED_LOCKOUT,
  absoluteExpiry,
} from '../modules/identity/security.js';

const policy = { idleMinutes: 120, absoluteHours: 12, pending2faMinutes: 10 };
const t0 = new Date('2026-10-23T08:00:00Z');
const plus = (min: number) => new Date(t0.getTime() + min * 60_000);

describe('session expiry (idle + absolute + pending window)', () => {
  const active = { state: 'active' as const, createdAt: t0, expiresAt: plus(12 * 60), idleExpiresAt: plus(120) };

  it('accepts a fresh active session', () => {
    expect(evaluateSession(active, plus(5), policy)).toEqual({ ok: true });
  });

  it('expires after the idle window', () => {
    expect(evaluateSession(active, plus(120), policy)).toEqual({ ok: false, reason: 'idle_expired' });
  });

  it('expires at the absolute limit even when recently active', () => {
    const recentlyActive = { ...active, idleExpiresAt: plus(12 * 60 + 60) };
    expect(evaluateSession(recentlyActive, plus(12 * 60), policy)).toEqual({ ok: false, reason: 'absolute_expired' });
  });

  it('ends a pending-2FA session after the short pending window', () => {
    const pending = { ...active, state: 'pending_2fa_verification' as const };
    expect(evaluateSession(pending, plus(9), policy)).toEqual({ ok: true });
    expect(evaluateSession(pending, plus(10), policy)).toEqual({ ok: false, reason: 'pending_expired' });
  });

  it('rejects ended sessions', () => {
    expect(evaluateSession({ ...active, state: 'ended' }, plus(1), policy)).toEqual({ ok: false, reason: 'ended' });
  });

  it('gives pending sessions a short absolute expiry', () => {
    expect(absoluteExpiry(t0, policy, 'pending_2fa_verification').getTime()).toBe(plus(10).getTime());
    expect(absoluteExpiry(t0, policy, 'active').getTime()).toBe(plus(720).getTime());
  });
});

describe('per-account lockout', () => {
  const lp = { maxFailures: 5, windowMinutes: 15, lockMinutes: 15 };

  it('locks on the 5th failure inside the window, for 15 minutes', () => {
    let s = CLEARED_LOCKOUT;
    for (let i = 0; i < 4; i++) s = registerFailure(s, plus(i), lp);
    expect(isLocked(s, plus(4))).toBe(false);
    s = registerFailure(s, plus(4), lp);
    expect(isLocked(s, plus(4))).toBe(true);
    expect(isLocked(s, plus(18))).toBe(true);
    expect(isLocked(s, plus(19))).toBe(false);
  });

  it('restarts the count when the window has passed', () => {
    let s = CLEARED_LOCKOUT;
    for (let i = 0; i < 4; i++) s = registerFailure(s, plus(i), lp);
    s = registerFailure(s, plus(20), lp);
    expect(s.failedCount).toBe(1);
    expect(isLocked(s, plus(20))).toBe(false);
  });
});

describe('Owner pending-2FA restriction (R-11; working default R11-a, Demonstration alternative — not approved)', () => {
  const v = 'pending_2fa_verification' as const;
  const e = 'pending_2fa_enrollment' as const;

  it('R11-a allows only the 2FA, status, me and logout routes', () => {
    expect(isPendingRequestAllowed(v, 'POST', '/api/auth/2fa/verify', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed(v, 'GET', '/api/auth/me', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed(v, 'GET', '/api/auth/2fa/status', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed(v, 'POST', '/api/auth/logout', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed(v, 'GET', '/api/employees', 'R11-a', false)).toBe(false);
    expect(isPendingRequestAllowed(v, 'POST', '/api/attendance/check-in', 'R11-a', false)).toBe(false);
  });

  it('uses exact matching, not prefixes', () => {
    expect(isPendingRequestAllowed(v, 'GET', '/api/auth/meXYZ', 'R11-a', false)).toBe(false);
    expect(isPendingRequestAllowed(v, 'POST', '/api/auth/2fa/verify/extra', 'R11-a', false)).toBe(false);
    expect(isPendingRequestAllowed(v, 'POST', '/api/auth/me', 'R11-a', false)).toBe(false);
  });

  it('separates enrollment from verification routes', () => {
    expect(isPendingRequestAllowed(e, 'POST', '/api/auth/2fa/enroll/confirm', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed(e, 'POST', '/api/auth/2fa/verify', 'R11-a', false)).toBe(false);
    expect(isPendingRequestAllowed(v, 'POST', '/api/auth/2fa/enroll/start', 'R11-a', false)).toBe(false);
  });

  it('R11-b allows non-admin routes but never admin routes', () => {
    expect(isPendingRequestAllowed(v, 'POST', '/api/attendance/check-in', 'R11-b', false)).toBe(true);
    expect(isPendingRequestAllowed(v, 'GET', '/api/employees', 'R11-b', true)).toBe(false);
  });
});

describe('Origin / Referer check', () => {
  const allowed = ['http://localhost:3000'];
  it('accepts the app origin and rejects others', () => {
    expect(checkRequestOrigin('http://localhost:3000', undefined, allowed, false)).toEqual({ ok: true });
    expect(checkRequestOrigin('https://evil.example', undefined, allowed, true)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });
  it('falls back to the Referer origin', () => {
    expect(checkRequestOrigin(undefined, 'http://localhost:3000/login', allowed, false)).toEqual({ ok: true });
    expect(checkRequestOrigin(undefined, 'https://evil.example/x', allowed, true).ok).toBe(false);
  });
  it('rejects a request with neither header unless allowed (production rejects)', () => {
    expect(checkRequestOrigin(undefined, undefined, allowed, false)).toEqual({ ok: false, reason: 'origin_missing' });
    expect(checkRequestOrigin(undefined, undefined, allowed, true)).toEqual({ ok: true });
  });
});

describe('tokens', () => {
  it('stores only a keyed hash, and CSRF tokens differ per session and nonce', () => {
    const h = hashToken('secret-a', 'raw');
    expect(h).not.toContain('raw');
    expect(h).toHaveLength(64);
    expect(hashToken('secret-b', 'raw')).not.toBe(h);
    expect(deriveCsrfToken('s', 'sid1', 'n')).not.toBe(deriveCsrfToken('s', 'sid2', 'n'));
    expect(deriveCsrfToken('s', 'sid1', 'n')).not.toBe(deriveCsrfToken('s', 'sid1', 'm'));
  });
  it('rejects a reused TOTP time step', () => {
    expect(isReplayedStep(100, null)).toBe(false);
    expect(isReplayedStep(100, 100)).toBe(true);
    expect(isReplayedStep(101, 100)).toBe(false);
  });
});
