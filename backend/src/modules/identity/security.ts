/**
 * Pure identity/security logic (no DB, no Express). Unit-tested in src/tests/security.test.ts.
 */
import crypto from 'crypto';
import type { PendingTwoFactorScope } from '../../config/index.js';

export type SessionState = 'pending_2fa_enrollment' | 'pending_2fa_verification' | 'active' | 'ended';

export type SessionEndReason =
  | 'logout'
  | 'revoked'
  | 'idle_expired'
  | 'absolute_expired'
  | 'pending_expired'
  | 'rotated'
  | 'factor_threshold'
  | 'password_reset'
  | 'account_deactivated';

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Keyed hash of a high-entropy token. Only this hash is stored (sessions, security_tokens). */
export function hashToken(secret: string, token: string): string {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

/** Per-session CSRF token, derived from the session id and a stored random nonce. */
export function deriveCsrfToken(secret: string, sessionId: string, nonce: string): string {
  return crypto.createHmac('sha256', secret).update(`csrf:${sessionId}:${nonce}`).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// Session expiry (ADR-003: idle + absolute; pending-2FA sessions are short)
// ---------------------------------------------------------------------------

export interface SessionTimes {
  state: SessionState;
  createdAt: Date;
  expiresAt: Date; // absolute expiry
  idleExpiresAt: Date | null;
}

export interface SessionPolicy {
  idleMinutes: number;
  absoluteHours: number;
  pending2faMinutes: number;
}

export type SessionEvaluation =
  | { ok: true }
  | { ok: false; reason: 'ended' | 'idle_expired' | 'absolute_expired' | 'pending_expired' };

export function evaluateSession(s: SessionTimes, now: Date, policy: SessionPolicy): SessionEvaluation {
  if (s.state === 'ended') return { ok: false, reason: 'ended' };
  if (now.getTime() >= s.expiresAt.getTime()) return { ok: false, reason: 'absolute_expired' };
  if (s.state !== 'active') {
    const pendingDeadline = s.createdAt.getTime() + policy.pending2faMinutes * 60_000;
    if (now.getTime() >= pendingDeadline) return { ok: false, reason: 'pending_expired' };
  }
  if (s.idleExpiresAt && now.getTime() >= s.idleExpiresAt.getTime()) {
    return { ok: false, reason: 'idle_expired' };
  }
  return { ok: true };
}

export function nextIdleExpiry(now: Date, policy: SessionPolicy): Date {
  return new Date(now.getTime() + policy.idleMinutes * 60_000);
}

export function absoluteExpiry(now: Date, policy: SessionPolicy, state: SessionState): Date {
  const absolute = now.getTime() + policy.absoluteHours * 3_600_000;
  if (state === 'active') return new Date(absolute);
  return new Date(Math.min(absolute, now.getTime() + policy.pending2faMinutes * 60_000));
}

// ---------------------------------------------------------------------------
// Per-account lockout (IMPL-LOCKOUT working default; values come from config)
// ---------------------------------------------------------------------------

export interface LockoutState {
  failedCount: number;
  windowStartedAt: Date | null;
  lockedUntil: Date | null;
}

export interface LockoutPolicy {
  maxFailures: number;
  windowMinutes: number;
  lockMinutes: number;
}

export function isLocked(state: LockoutState, now: Date): boolean {
  return Boolean(state.lockedUntil && state.lockedUntil.getTime() > now.getTime());
}

/** New counter state after one failed attempt. */
export function registerFailure(state: LockoutState, now: Date, policy: LockoutPolicy): LockoutState {
  const windowOpen =
    state.windowStartedAt !== null &&
    now.getTime() - state.windowStartedAt.getTime() < policy.windowMinutes * 60_000;
  const failedCount = windowOpen ? state.failedCount + 1 : 1;
  const windowStartedAt = windowOpen ? state.windowStartedAt : now;
  const lockedUntil =
    failedCount >= policy.maxFailures ? new Date(now.getTime() + policy.lockMinutes * 60_000) : state.lockedUntil;
  // Once a lock is set, the next failure after it lapses starts a fresh window.
  if (failedCount >= policy.maxFailures) {
    return { failedCount: 0, windowStartedAt: null, lockedUntil };
  }
  return { failedCount, windowStartedAt, lockedUntil };
}

export const CLEARED_LOCKOUT: LockoutState = { failedCount: 0, windowStartedAt: null, lockedUntil: null };

// ---------------------------------------------------------------------------
// Pending-2FA restriction (R-11). Exact route matching, not startsWith.
// ---------------------------------------------------------------------------

const ALWAYS_ALLOWED_WHILE_PENDING = new Set([
  'GET /api/auth/me',
  'GET /api/auth/2fa/status',
  'POST /api/auth/logout',
]);
const ALLOWED_PENDING_VERIFICATION = new Set(['POST /api/auth/2fa/verify', 'POST /api/auth/2fa/recover']);
const ALLOWED_PENDING_ENROLLMENT = new Set(['POST /api/auth/2fa/enroll/start', 'POST /api/auth/2fa/enroll/confirm']);

/** Admin routes are always denied to a pending session (Confirmed, arch-b §6 step 2b). */
export function isPendingRequestAllowed(
  state: SessionState,
  method: string,
  path: string,
  scope: PendingTwoFactorScope,
  isAdminRoute: boolean
): boolean {
  if (state === 'active') return true;
  if (state === 'ended') return false;
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const key = `${method.toUpperCase()} ${normalized}`;
  if (ALWAYS_ALLOWED_WHILE_PENDING.has(key)) return true;
  if (state === 'pending_2fa_verification' && ALLOWED_PENDING_VERIFICATION.has(key)) return true;
  if (state === 'pending_2fa_enrollment' && ALLOWED_PENDING_ENROLLMENT.has(key)) return true;
  // R11-b (Demonstration alternative — not approved): non-admin routes allowed while pending.
  if (scope === 'R11-b' && !isAdminRoute && !normalized.startsWith('/api/auth/')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Origin / Referer check (ADR-002/003)
// ---------------------------------------------------------------------------

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type OriginCheck = { ok: true } | { ok: false; reason: 'origin_mismatch' | 'origin_missing' };

export function checkRequestOrigin(
  originHeader: string | undefined,
  refererHeader: string | undefined,
  allowedOrigins: string[],
  allowMissing: boolean
): OriginCheck {
  let origin = originHeader && originHeader !== 'null' ? originHeader : undefined;
  if (!origin && refererHeader) {
    try {
      origin = new URL(refererHeader).origin;
    } catch {
      return { ok: false, reason: 'origin_mismatch' };
    }
  }
  if (!origin) return allowMissing ? { ok: true } : { ok: false, reason: 'origin_missing' };
  return allowedOrigins.includes(origin) ? { ok: true } : { ok: false, reason: 'origin_mismatch' };
}

// ---------------------------------------------------------------------------
// TOTP replay guard: a code (time step) is usable once.
// ---------------------------------------------------------------------------

export function totpStep(now: Date, delta: number, periodSeconds = 30): number {
  return Math.floor(now.getTime() / 1000 / periodSeconds) + delta;
}

export function isReplayedStep(step: number, lastUsedStep: number | null): boolean {
  return lastUsedStep !== null && step <= lastUsedStep;
}
