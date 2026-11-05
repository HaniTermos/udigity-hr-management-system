import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { MUTATING_METHODS, checkRequestOrigin } from '../modules/identity/security.js';

/** Request/correlation id for logs and audit rows. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get('x-request-id');
  const id = incoming && /^[A-Za-z0-9._-]{8,100}$/.test(incoming) ? incoming : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/** Origin/Referer check on every mutating request (ADR-002/003 CSRF layer 2). */
export function createOriginCheck(allowedOrigins: string[], allowMissing: boolean) {
  return function originCheck(req: Request, res: Response, next: NextFunction) {
    if (!MUTATING_METHODS.has(req.method.toUpperCase())) return next();
    const result = checkRequestOrigin(req.get('origin'), req.get('referer'), allowedOrigins, allowMissing);
    if (!result.ok) {
      return res.status(403).json({ error: 'Request could not be verified', code: 'ORIGIN_REJECTED' });
    }
    return next();
  };
}

export const originCheck = createOriginCheck(config.appOrigins, config.allowMissingOrigin);

/**
 * Per-IP rate limit for login, 2FA and password-reset endpoints.
 * Values: Demonstration alternative — not approved (docs/policy-defaults.md, IMPL-LOCKOUT).
 */
export function createAuthRateLimiter(max = config.authRateLimit.max, windowMinutes = config.authRateLimit.windowMinutes) {
  return rateLimit({
    windowMs: windowMinutes * 60_000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait and try again.', code: 'RATE_LIMITED' },
  });
}
