/**
 * `idempotent(operation)` Express middleware (plan §4.7, IC-23). Owner: BE5.
 * Mount AFTER `authenticate` (needs req.user) and BEFORE the handler:
 *
 *   router.post('/', authenticate, requireAction('business.create'), idempotent('business.create'), handler)
 *
 * - Header `Idempotency-Key` (UUID). `required: true` (default) → 400 when missing.
 * - First request claims (actor, operation, key) with the body hash, runs, then stores status + body.
 * - Same key + same body → the stored response is replayed (header `Idempotent-Replayed: true`).
 * - Same key + different body → 409 IDEMPOTENCY_KEY_REUSED.
 * - Same key while the first request is still running → 409 STATE_CONFLICT (retry later).
 * - 5xx responses are not stored (the claim is released so a retry runs again).
 */
import crypto from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { pool } from '../../db/pool.js';
import { HttpError } from '../../shared/errors.js';
import { flags } from '../../shared/flags.js';
import { IDEMPOTENCY_HEADER } from '../../shared/platform.js';
import { clock } from './clock.js';
import * as repo from './repo.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Stable JSON (sorted keys) so key order does not change the hash. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(',')}}`;
}

export function requestHash(req: Pick<Request, 'method' | 'baseUrl' | 'path' | 'body'>): string {
  return crypto
    .createHash('sha256')
    .update(`${req.method} ${req.baseUrl}${req.path}\n${canonical(req.body)}`)
    .digest('hex');
}

export function idempotent(operation: string, options: { required?: boolean } = {}): RequestHandler {
  const required = options.required ?? true;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = req.get(IDEMPOTENCY_HEADER);
      if (!raw) {
        if (required) throw new HttpError(400, 'BAD_REQUEST', `${IDEMPOTENCY_HEADER} header is required`);
        return next();
      }
      if (!UUID_RE.test(raw)) throw new HttpError(400, 'VALIDATION_ERROR', `${IDEMPOTENCY_HEADER} must be a UUID`);
      if (!req.user) throw new Error('idempotent() must run after authenticate');

      const key = { actorId: req.user.id, operation, key: raw.toLowerCase() };
      const hash = requestHash(req);
      const now = clock.now();
      const expiresAt = new Date(now.getTime() + flags['retention.idempotencyHours'] * 3600_000);

      const claimed = await repo.claimIdempotency(pool, key, hash, now, expiresAt);
      if (!claimed) {
        const existing = await repo.findIdempotency(pool, key, now);
        if (!existing) throw new HttpError(409, 'STATE_CONFLICT', 'Request is being processed; retry shortly');
        if (existing.request_hash !== hash) {
          throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'This save was already sent with different details. Reload the page and try again.');
        }
        if (existing.status === 0) throw new HttpError(409, 'STATE_CONFLICT', 'Request is being processed; retry shortly');
        res.setHeader('Idempotent-Replayed', 'true');
        return res.status(existing.status).json(existing.body);
      }

      // Capture the response this request produces (handler or errorHandler).
      const originalJson = res.json.bind(res);
      let settled = false;
      res.json = (body: unknown) => {
        if (!settled) {
          settled = true;
          const status = res.statusCode;
          const persist =
            status >= 500
              ? repo.releaseIdempotency(pool, key)
              : repo.saveIdempotency(pool, key, { request_hash: hash, status, body }, expiresAt);
          persist
            .catch((err: unknown) => console.error('[idempotency] store failed', { operation, err: (err as Error).name }))
            .finally(() => originalJson(body));
          return res;
        }
        return originalJson(body);
      };
      // A response that ends without JSON (e.g. 204) still finalises the claim.
      res.on('finish', () => {
        if (settled) return;
        settled = true;
        const status = res.statusCode;
        const done =
          status >= 500
            ? repo.releaseIdempotency(pool, key)
            : repo.saveIdempotency(pool, key, { request_hash: hash, status, body: null }, expiresAt);
        done.catch(() => undefined);
      });
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
