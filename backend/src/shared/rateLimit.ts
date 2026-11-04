/**
 * Per-caller rate limits (threat model §5.9, checklist A4, security review R2-07 / A-06). FX-BE.
 *
 * - `perUserLimiter(name, limit, windowMs)`: keyed by the authenticated employee (falls back to the
 *   session cookie hash, then the client IP) so office staff behind one NAT never share a budget.
 * - `apiReadLimiter` + `countAuthenticatedRead`: one shared budget per EMPLOYEE for every authenticated
 *   GET under /api (scraping, EX-3). The app-level part (before the routers) only covers requests without
 *   a working session; the employee budget is charged by `authenticate` once the session is known
 *   (F-07). `/api/auth/me` and `/api/auth/2fa/status` are exempt (the shell revalidates them on focus).
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

/**
 * F-06 — SINGLE REPLICA REQUIRED: every limiter in this file (and identity/limits.ts) keeps its counters
 * in process memory (express-rate-limit MemoryStore). Two API processes double every budget and a
 * restart or deploy resets them. Run exactly one API replica until a shared store is added.
 */
const EXEMPT_READS = new Set(['/auth/me', '/auth/2fa/status']);
/** Public auth routes: their own buckets live in identity/limits.ts. */
const PUBLIC_AUTH_PATHS = new Set(['/auth/login', '/auth/password-reset/request', '/auth/password-reset/complete']);

const readBudget = perUserLimiter('api-read', LIMITS.apiRead.limit, LIMITS.apiRead.windowMs);

/** GETs that arrive without a session cookie: per client IP (they all end in 401 or a public read). */
// callerKey falls back to the client IP here: no user and no cookie yet.
const anonymousReadBudget = perUserLimiter('api-read-anon', LIMITS.apiRead.limit, LIMITS.apiRead.windowMs);

/**
 * Requests that carry a session cookie which does not authenticate (random or ended cookies): per client
 * IP, counting only the 401 answers. Valid sessions never use this budget, so a shared office NAT is not
 * penalised; it only stops random-cookie floods from minting a fresh budget per request (F-07).
 */
const badSessionBudget = rateLimit({
  windowMs: LIMITS.apiRead.windowMs,
  limit: config.env === 'test' ? LIMITS.apiRead.limit * TEST_FACTOR : LIMITS.apiRead.limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  keyGenerator: (req: Request) => `api-bad-session:ip:${req.ip ?? 'unknown'}`,
  message: { error: 'Too many requests. Please wait and try again.', code: 'RATE_LIMITED' },
});

/**
 * Mounted at `/api` in app.ts, BEFORE authentication. The per-EMPLOYEE read budget is applied after
 * the session is resolved (`countAuthenticatedRead`, called by `authenticate`), so several sessions of
 * one employee share one budget and colleagues behind one NAT never do (F-07).
 */
export function apiReadLimiter(req: Request, res: Parameters<typeof readBudget>[1], next: () => void) {
  if (PUBLIC_AUTH_PATHS.has(req.path)) return next();
  const hasCookie = Boolean(req.cookies?.[config.session.cookieName]);
  if (hasCookie) return badSessionBudget(req, res, next);
  if (req.method !== 'GET' || EXEMPT_READS.has(req.path)) return next();
  return anonymousReadBudget(req, res, next);
}

const counted = new WeakSet<Request>();

/**
 * Per-employee read budget. `authenticate` calls this after `req.user` is set; `fullPath` is the path
 * under the app (e.g. `/api/businesses`). Each request is counted once even when a router and a route
 * both run `authenticate`.
 */
export function countAuthenticatedRead(req: Request, res: Parameters<typeof readBudget>[1], next: () => void, fullPath: string) {
  if (req.method !== 'GET' || !fullPath.startsWith('/api/') || EXEMPT_READS.has(fullPath.slice(4)) || counted.has(req)) {
    return next();
  }
  counted.add(req);
  return readBudget(req, res, next);
}
