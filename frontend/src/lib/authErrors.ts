/** Wording for failed sign-in steps (review F-02, B-13). Pure module. */
import { isRateLimited, rateLimitMessage } from '@/lib/api/rateLimit';

/** The server could not be reached or failed (not "your input was wrong"). */
export function isServerTrouble(status: number): boolean {
  return status === 0 || status >= 500;
}

export const SERVER_TROUBLE_TEXT = 'We could not reach the server. Check your connection and try again in a moment.';

/**
 * User-facing text for a failed sign-in step. Rate limits say how long to wait; a dead network or a 5xx is
 * never reported as a wrong password. Otherwise `fallback` (the caller's neutral wording).
 */
export function authFailureText(
  res: { status: number; error: { code?: string; retryAfterSeconds?: number } | null },
  fallback: string
): { text: string; code?: string } {
  const code = res.error?.code;
  if (isRateLimited(res.status, code)) return { text: rateLimitMessage(res.error?.retryAfterSeconds), code: 'RATE_LIMITED' };
  if (isServerTrouble(res.status)) return { text: SERVER_TROUBLE_TEXT, code: res.status === 0 ? 'NETWORK_ERROR' : code };
  return { text: fallback, code };
}
