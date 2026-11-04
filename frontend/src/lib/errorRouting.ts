/**
 * Error routing (plan.md §9): maps an API failure to the screen that explains it.
 *   401                      -> SCR-SHR-013 session ended (expired / revoked / deactivated)
 *   403 PERMISSION_DENIED    -> SCR-SHR-011 permission denied
 *   403 OWNER_2FA_REQUIRED   -> SCR-SHR-011 variant "Owner without completed 2FA"
 *   403 HIDDEN_BY_POLICY     -> SCR-SHR-012 record hidden by policy
 *   409 VERSION_CONFLICT     -> SCR-SHR-014 save conflict
 *   network failure          -> SCR-SHR-015 offline
 * Pure module: no React, so it can be unit-tested and imported anywhere.
 */
import { ApiError } from '@/lib/api';
import { CONNECTION_LOST_MESSAGE, OFFLINE_CODE, OFFLINE_NOT_SENT_MESSAGE } from '@/lib/api/offline';

export type SessionEndReason = 'expired' | 'revoked' | 'deactivated';

export type ErrorRoute =
  | { kind: 'session-ended'; reason: SessionEndReason }
  | { kind: 'permission-denied' }
  | { kind: 'owner-2fa-required' }
  | { kind: 'hidden-by-policy' }
  | { kind: 'not-found' }
  | { kind: 'conflict'; currentVersion?: number }
  | { kind: 'offline' }
  | { kind: 'rate-limited'; retryAfterSeconds?: number }
  | { kind: 'busy'; retryAfterSeconds?: number }
  | { kind: 'validation'; fieldErrors: Record<string, string[]> }
  | { kind: 'error'; requestId?: string };

export const SESSION_ENDED_PATH = '/session-ended';

export function sessionEndReasonFor(code: string | undefined): SessionEndReason {
  switch (code) {
    case 'ACCOUNT_DEACTIVATED':
    case 'ACCOUNT_INACTIVE':
      return 'deactivated';
    case 'SESSION_REVOKED':
    case 'SESSION_INVALID':
      return 'revoked';
    default:
      return 'expired';
  }
}

export function parseSessionEndReason(raw: string | null | undefined): SessionEndReason {
  return raw === 'revoked' || raw === 'deactivated' ? raw : 'expired';
}

/** `/session-ended?reason=...&redirect=<current page>` (same-origin relative path only). */
export function sessionEndedPathFor(reason: SessionEndReason, returnTo?: string): string {
  const q = new URLSearchParams({ reason });
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.startsWith('/\\') && returnTo !== '/') {
    q.set('redirect', returnTo);
  }
  return `${SESSION_ENDED_PATH}?${q.toString()}`;
}

export function classifyError(error: unknown): ErrorRoute {
  if (!(error instanceof ApiError)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' };
    return { kind: 'error' };
  }
  if (error.status === 0 || error.code === 'NETWORK_ERROR' || error.code === OFFLINE_CODE) return { kind: 'offline' };
  if (error.isUnauthenticated) return { kind: 'session-ended', reason: sessionEndReasonFor(error.code) };
  if (error.isHiddenByPolicy) return { kind: 'hidden-by-policy' };
  if (error.code === 'OWNER_2FA_REQUIRED') return { kind: 'owner-2fa-required' };
  if (error.status === 403 || error.isPermissionDenied) return { kind: 'permission-denied' };
  if (error.isVersionConflict) {
    const d = error.details as { currentVersion?: unknown } | undefined;
    return { kind: 'conflict', currentVersion: typeof d?.currentVersion === 'number' ? d.currentVersion : undefined };
  }
  if (error.isNotFound) return { kind: 'not-found' };
  if (error.code === 'BUSY_TRY_AGAIN' || error.status === 503) return { kind: 'busy', retryAfterSeconds: error.retryAfterSeconds };
  if (error.status === 429 || error.code === 'RATE_LIMITED') return { kind: 'rate-limited', retryAfterSeconds: error.retryAfterSeconds };
  if (error.code === 'VALIDATION_ERROR') return { kind: 'validation', fieldErrors: error.fieldErrors };
  return { kind: 'error', requestId: error.requestId };
}

/** Errors a retry might fix. Everything else is final: SWR must not hammer the API with it. */
export function isRetryable(error: unknown): boolean {
  const r = classifyError(error);
  return r.kind === 'offline' || r.kind === 'error' || r.kind === 'rate-limited' || r.kind === 'busy';
}

/**
 * SHR-015 copy for a save that failed offline (not sent, or the connection dropped mid-save), or null
 * when the failure is something else. Use it instead of a generic "Something went wrong".
 */
export function offlineSaveMessage(error: unknown): string | null {
  if (classifyError(error).kind !== 'offline') return null;
  if (error instanceof ApiError && error.code === OFFLINE_CODE) return OFFLINE_NOT_SENT_MESSAGE;
  return CONNECTION_LOST_MESSAGE;
}
