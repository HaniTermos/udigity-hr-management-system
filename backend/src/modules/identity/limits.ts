/**
 * Auth abuse controls (review 2026-11-04: F-01, E-01/F-04, F-05, F-08). Owner: BE1 / FIX-SEC.
 *
 * Replaces the single per-IP `authLimiter` that login, 2FA, recovery, reset and password change all
 * shared (and that counted successful sign-ins, so a shared office NAT locked itself out at 09:00).
 *
 * Buckets (each its own counter):
 * - login, per (email, client IP): FAILED attempts only. After `LOCKOUT_MAX_FAILURES` failures in
 *   `LOCKOUT_WINDOW_MINUTES` that PAIR is refused (429) until the window ends; a correct sign-in clears the pair (H-02). A correct password from
 *   any other address still works, so knowing an email (the Owner's is a public address) is not enough
 *   to lock anyone out (E-01). The DB per-account lock is no longer set by sign-in failures.
 * - login, per client IP: FAILED attempts only, `AUTH_RATE_LIMIT_MAX` per `AUTH_RATE_LIMIT_WINDOW_MINUTES`.
 *   Successful sign-ins never count, so one office NAT with every employee signing in at once is fine;
 *   the ceiling only bounds password spraying across many accounts from one address (see NAT note below).
 * - login, per account (email, every address): progressive delay, never a refusal. From the
 *   2 × LOCKOUT_MAX_FAILURES-th failure in the window, every attempt for that email waits 0.5 s,
 *   doubling to a 4 s cap, before the password is checked (the real user is slowed, never locked).
 * - 2FA (verify, enroll start/confirm), recovery-code sign-in, 2FA admin (recovery codes, enrollment
 *   tokens), password change: per EMPLOYEE (after authenticate), failed attempts only. The DB factor
 *   lock (5 wrong codes) and the re-authentication lock stay the primary controls.
 * - reset request: per client IP (every request: the answer is always 202) plus a silent per-email cap
 *   (`RESET_REQUESTS_PER_EMAIL_PER_HOUR`), counted for unknown emails too, so nothing reveals existence.
 * - reset complete: per client IP, failed attempts only (tokens are 256-bit: this only bounds CPU).
 *
 * NAT note (per-IP login ceiling): about 50 staff behind one office address. Even if every one of them
 * mistyped twice in the same 15 minutes that is 100 failures; the default AUTH_RATE_LIMIT_MAX (config,
 * owned by ops) is the knob. A value of 100 per 15 min lets one attacker address test at most 100
 * guesses per 15 minutes in total (and at most 5 per account), against 12+ character passwords and the
 * Owner's TOTP.
 *
 * F-06 — SINGLE REPLICA REQUIRED: every counter here (and in shared/rateLimit.ts) lives in process
 * memory. Two API replicas double every limit and a restart or deploy resets them. Run exactly one API
 * process (docker-compose.prod.yml does) until a shared store (Postgres/Redis) is added.
 *
 * Every refusal is 429 `{ code: 'RATE_LIMITED' }` with a `Retry-After` header (seconds).
 */
import { isIPv6 } from 'node:net';
import type { Request, Response } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { config } from '../../config/index.js';
import { raiseOpsAlert } from '../../shared/opsAlert.js';

export const RATE_LIMITED_BODY = { error: 'Too many attempts. Please wait and try again.', code: 'RATE_LIMITED' } as const;

/** Reset requests that actually issue a link, per email per hour (F-05). Further requests still answer 202. */
export const RESET_REQUESTS_PER_EMAIL_PER_HOUR = 3;

/** E-06: the reset-request answer is never sent sooner than this after the request arrived (both paths). */
export const RESET_REQUEST_MIN_MS = 500;

/** Lower-cased, trimmed, length-capped email used as a limiter key (never logged). */
export function emailKey(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 254) : '';
}

/**
 * Client address bucket: IPv4 as is (IPv4-mapped IPv6 unwrapped), IPv6 by its /64 prefix, so one
 * host cannot rotate through its own /64 to get fresh buckets (F-01 measurement).
 */
export function ipBucket(ip: string | undefined | null): string {
  if (!ip) return 'unknown';
  const bare = ip.split('%')[0];
  if (bare.toLowerCase().startsWith('::ffff:') && bare.includes('.')) return bare.slice(7);
  if (!isIPv6(bare)) return bare;
  let groups: string[];
  if (bare.includes('::')) {
    const [head, tail] = bare.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    groups = [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  } else {
    groups = bare.split(':');
  }
  return `${groups
    .slice(0, 4)
    .map((g) => (parseInt(g || '0', 16) || 0).toString(16))
    .join(':')}::/64`;
}

const clientIp = (req: Request) => ipBucket(req.ip || req.socket?.remoteAddress);

interface BucketOptions {
  name: string;
  limit: number;
  windowMs: number;
  key: (req: Request) => string;
  /** Count only responses with status >= 400 (successes are given back). */
  failuresOnly: boolean;
}

/** One express-rate-limit bucket with the shared 429 contract. */
export function bucket(o: BucketOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: o.windowMs,
    limit: o.limit,
    standardHeaders: 'draft-7', // RateLimit-* headers; Retry-After is set on every 429
    legacyHeaders: false,
    skipSuccessfulRequests: o.failuresOnly,
    keyGenerator: (req: Request) => `${o.name}:${o.key(req)}`,
    message: RATE_LIMITED_BODY,
  });
}

const minutes = (m: number) => m * 60_000;
const employeeKey = (req: Request) => (req.user?.id ? `u:${req.user.id}` : `ip:${clientIp(req)}`);

const loginPairBucketKey = (req: Request) => `${emailKey(req.body?.email)}|${clientIp(req)}`;

/** The store key of the (email, IP) login bucket for this request (H-02: cleared on a successful sign-in). */
export const loginPairKey = (req: Request) => `login-pair:${loginPairBucketKey(req)}`;

/** Login: per (email, IP) pair, failed attempts only (E-01: never locks the account itself). */
export function createLoginPairLimiter(limit = config.lockout.maxFailures, windowMinutes = config.lockout.windowMinutes) {
  return bucket({
    name: 'login-pair',
    limit,
    windowMs: minutes(windowMinutes),
    key: loginPairBucketKey,
    failuresOnly: true,
  });
}

/** Login: per client IP, failed attempts only (F-01 NAT fairness: successful sign-ins never count). */
export function createLoginIpLimiter(limit = config.authRateLimit.max, windowMinutes = config.authRateLimit.windowMinutes) {
  return bucket({ name: 'login-ip', limit, windowMs: minutes(windowMinutes), key: clientIp, failuresOnly: true });
}

/** Authenticated auth steps: per employee, failed attempts only. Mount AFTER `authenticate`. */
export function createEmployeeAuthLimiter(name: string, limit = 10, windowMinutes = 15) {
  return bucket({ name, limit, windowMs: minutes(windowMinutes), key: employeeKey, failuresOnly: true });
}

/** Unauthenticated reset endpoints: per client IP. */
export function createResetRequestLimiter(limit = config.authRateLimit.max, windowMinutes = config.authRateLimit.windowMinutes) {
  return bucket({ name: 'reset-request', limit, windowMs: minutes(windowMinutes), key: clientIp, failuresOnly: false });
}

export function createResetCompleteLimiter(limit = config.authRateLimit.max, windowMinutes = config.authRateLimit.windowMinutes) {
  return bucket({ name: 'reset-complete', limit, windowMs: minutes(windowMinutes), key: clientIp, failuresOnly: true });
}

/**
 * Small fixed-window counter (in memory, single replica, see F-06). Used where a limiter must not
 * answer 429: the per-account login delay and the silent per-email reset cap.
 */
export class FixedWindowCounter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxKeys = 50_000
  ) {}

  count(key: string, now = Date.now()): number {
    const e = this.hits.get(key);
    return e && e.resetAt > now ? e.count : 0;
  }

  /** Adds one hit and returns the count in the current window. */
  add(key: string, now = Date.now()): number {
    if (this.hits.size >= this.maxKeys) this.prune(now);
    let e = this.hits.get(key);
    if (!e || e.resetAt <= now) {
      e = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, e);
    }
    e.count += 1;
    return e.count;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }

  private prune(now: number): void {
    for (const [k, e] of this.hits) if (e.resetAt <= now) this.hits.delete(k);
    // Still full (a flood of distinct keys): drop the oldest half rather than grow without bound.
    if (this.hits.size >= this.maxKeys) {
      let drop = Math.ceil(this.hits.size / 2);
      for (const k of this.hits.keys()) {
        if (drop-- <= 0) break;
        this.hits.delete(k);
      }
    }
  }
}

/** Per-account progressive delay (ms) for the next sign-in attempt, given the failures so far. */
export function accountDelayMs(failures: number, threshold = 2 * config.lockout.maxFailures, baseMs = 500, capMs = 4_000): number {
  if (failures < threshold) return 0;
  return Math.min(capMs, baseMs * 2 ** Math.min(failures - threshold, 10));
}

export const loginAccountFailures = new FixedWindowCounter(minutes(config.lockout.windowMinutes));

/**
 * Controls gap V16 (abuse alerting): failed sign-ins across the whole system per 5 minutes. Reaching
 * FAILED_SIGNIN_SURGE_THRESHOLD raises one operator alert (ops_alerts, emailed to ALERT_EMAIL_TO by J-14;
 * raiseOpsAlert also merges repeats into one row per 15 minutes).
 * Why 25: about 50 staff sign in once or twice a day; even a bad morning (everyone mistyping once around 09:00)
 * spreads over more than 5 minutes and stays well below 25. One attacker address is capped at
 * AUTH_RATE_LIMIT_MAX (100) failures per 15 min, i.e. about 33 per 5 min, so a single-address guessing run at
 * full speed crosses 25 within 5 minutes, and a distributed one sooner.
 */
export const FAILED_SIGNIN_SURGE_THRESHOLD = 25;
export const FAILED_SIGNIN_SURGE_WINDOW_MINUTES = 5;
const failedSignIns = new FixedWindowCounter(minutes(FAILED_SIGNIN_SURGE_WINDOW_MINUTES));

/** Counts one failed sign-in; raises the surge alert when the window reaches the threshold. Returns true then. */
export async function noteFailedSignIn(now = new Date(), threshold = FAILED_SIGNIN_SURGE_THRESHOLD): Promise<boolean> {
  const n = failedSignIns.add('all', now.getTime());
  if (n !== threshold) return false;
  await raiseOpsAlert(
    'auth.failed_signin_surge',
    `${threshold} or more failed sign-ins within ${FAILED_SIGNIN_SURGE_WINDOW_MINUTES} minutes (all accounts). Check audit login.failed.`,
    undefined,
    now
  );
  return true;
}

/** Tests only: start the surge window afresh. */
export function resetFailedSignInsForTests(): void {
  failedSignIns.clear('all');
}
export const resetRequestsPerEmail = new FixedWindowCounter(minutes(60));

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits until `minMs` have passed since `startedAt` (E-06 constant-time answer). */
export async function padTo(startedAt: number, minMs: number): Promise<void> {
  const left = startedAt + minMs - Date.now();
  if (left > 0) await sleep(left);
}

/** 429 for a lock that is not an express-rate-limit bucket (re-authentication lock). */
export function sendRateLimited(res: Response, retryAfterSeconds: number) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))));
  return res.status(429).json(RATE_LIMITED_BODY);
}
