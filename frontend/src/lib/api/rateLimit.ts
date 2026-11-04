/**
 * Rate-limit wording (review F-02 / B-13). Pure module.
 * The backend answers 429 with `code: RATE_LIMITED` and a `Retry-After` header (seconds); an nginx 429 is
 * an HTML page with no code, so the status alone also counts.
 */

export function isRateLimited(status: number | undefined, code?: string): boolean {
  return status === 429 || code === 'RATE_LIMITED' || code === 'TOO_MANY_ATTEMPTS';
}

/** Parse a `Retry-After` header value (delta-seconds or an HTTP date) into whole seconds, or undefined. */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Math.min(Number(trimmed), 24 * 3600);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.min(Math.max(0, Math.ceil((at - now) / 1000)), 24 * 3600);
}

/** "Too many attempts. Try again in 5 minutes." Rounds up so the user never retries too early. */
export function rateLimitMessage(retryAfterSeconds?: number, subject = 'attempts'): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return `Too many ${subject}. Wait a few minutes and try again.`;
  if (retryAfterSeconds < 60) return `Too many ${subject}. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`;
  const minutes = Math.ceil(retryAfterSeconds / 60);
  if (minutes < 60) return `Too many ${subject}. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  const hours = Math.ceil(minutes / 60);
  return `Too many ${subject}. Try again in ${hours} hour${hours === 1 ? '' : 's'}.`;
}
