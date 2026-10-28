/**
 * Per-caller rate limits (threat model §5.9, checklist A4, security review R2-07 / A-06). FX-BE.
 *
 * - `perUserLimiter(name, limit, windowMs)`: keyed by the authenticated employee (falls back to the
 *   session cookie hash, then the client IP) so office staff behind one NAT never share a budget.
 * - `apiReadLimiter`: one shared budget for every authenticated GET under /api (scraping, EX-3),
 *   mounted in app.ts before the module routers. `/api/auth/me` and `/api/auth/2fa/status` are exempt
 *   (the shell revalidates them on focus).
 *
 * In NODE_ENV=test the limits are multiplied by TEST_FACTOR so suites that make many calls are not
 * throttled; `perUserLimiter(..., { exact: true })` keeps the exact numbers for the limiter tests.
 */
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

const TEST_FACTOR = 100;

function callerKey(req: Request): string {
  if (req.user?.id) return `u:${req.user.id}`;
  const cookie = req.cookies?.[config.session.cookieName] as string | undefined;
  if (cookie) return `s:${createHash('sha256').update(cookie).digest('hex').slice(0, 32)}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

export function perUserLimiter(
  name: string,
  limit: number,
  windowMs: number,
  options: { exact?: boolean; key?: (req: Request) => string } = {}
) {
  const effective = config.env === 'test' && !options.exact ? limit * TEST_FACTOR : limit;
  return rateLimit({
    windowMs,
    limit: effective,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => `${name}:${callerKey(req)}${options.key ? `:${options.key(req)}` : ''}`,
    message: { error: 'Too many requests. Please wait and try again.', code: 'RATE_LIMITED' },
  });
}

/** Threat model §5.9 budgets (Demonstration alternative — not approved, docs/policy-defaults.md). */
export const LIMITS = {
  duplicateCheck: { limit: 30, windowMs: 10 * 60_000 },
  search: { limit: 300, windowMs: 5 * 60_000 },
  apiRead: { limit: 600, windowMs: 5 * 60_000 },
  /** Per reservation: heartbeats every `reservation.heartbeatSeconds` (60 s); 6 per 30 s allows retries and two tabs. */
  reservationRenew: { limit: 6, windowMs: 30_000 },
  /** Reports export (R2-02 keeps its own 20 per 10 min per Owner in reports/routes.ts). */
} as const;

const EXEMPT_READS = new Set(['/auth/me', '/auth/2fa/status']);

const readBudget = perUserLimiter('api-read', LIMITS.apiRead.limit, LIMITS.apiRead.windowMs);

/** Mounted at `/api` in app.ts: every GET except the session probes shares one per-caller budget. */
export function apiReadLimiter(req: Request, res: Parameters<typeof readBudget>[1], next: () => void) {
  if (req.method !== 'GET' || EXEMPT_READS.has(req.path)) return next();
  return readBudget(req, res, next);
}
