import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/index.js';
import { isHttpError } from '../shared/errors.js';
import { raiseOpsAlert } from '../shared/opsAlert.js';

export interface AppError extends Error {
  type?: string;
  statusCode?: number;
  status?: number;
  code?: string;
  details?: unknown;
  expose?: boolean;
}

const PG_CLIENT_INPUT_CODES = new Set(['22007', '22008', '22003', '22P02', '22021', '22001']);

/** Field errors keyed by dotted path (`a.0.b`); errors with no path go under `_form`. One shape everywhere. */
export function zodDetails(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_form';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Route pattern for operator alerts (e.g. `GET /api/deals/:id`): never the query string or ids. */
const routeOf = (req: Request) => `${req.method} ${req.baseUrl}${req.route?.path ?? ''}`;

/**
 * Generic error responses. Internal messages (SQL, stack, driver errors) never reach the client;
 * they are logged with the request id instead.
 */
export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  // Shared error contract (src/shared/errors.ts): client-safe status, code, message and details.
  if (isHttpError(err)) {
    if (err.statusCode >= 500) {
      console.error('API Error:', { requestId: req.requestId, url: req.originalUrl, method: req.method, code: err.code });
      if (err.statusCode === 500) void raiseOpsAlert(`api.error:${routeOf(req)}`, `${routeOf(req)} ${err.code} request ${req.requestId}`);
    }
    return res.status(err.statusCode).json(err.toBody(req.requestId));
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: zodDetails(err),
      requestId: req.requestId,
    });
  }

  // PostgreSQL data exceptions caused by client input that slipped past a schema (C-01 backstop):
  // 22007/22008 bad or out-of-range date, 22003 numeric out of range, 22P02 bad text representation
  // (e.g. a malformed UUID), 22021 invalid byte sequence (NUL), 22001 value too long.
  if (typeof err.code === 'string' && PG_CLIENT_INPUT_CODES.has(err.code)) {
    return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', requestId: req.requestId });
  }

  // Load, not a bug: lock_timeout (55P03) or statement_timeout / cancelled query (57014). 503 BUSY_TRY_AGAIN
  // with Retry-After: 5 (the client may retry the same request). No ops alert per occurrence.
  if (err.code === '55P03' || err.code === '57014') {
    console.warn('API busy:', { requestId: req.requestId, method: req.method, code: err.code });
    res.setHeader('Retry-After', '5');
    return res.status(503).json({ error: 'The system is busy. Please try again in a few seconds.', code: 'BUSY_TRY_AGAIN', requestId: req.requestId });
  }

  // PostgreSQL duplicate key violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists', code: 'CONFLICT_DUPLICATE', requestId: req.requestId });
  }

  // PostgreSQL check violation: a data rule rejected the change (e.g. legacy closed-deal evidence, D-04).
  if (err.code === '23514') {
    return res.status(422).json({ error: 'The change is not allowed by a data rule', code: 'RULE_VIOLATION', requestId: req.requestId });
  }

  // Malformed JSON, oversized payload, malformed URI: the client's fault, a generic message, a stable code.
  const clientStatus = err.status ?? err.statusCode;
  if (clientStatus && clientStatus >= 400 && clientStatus < 500 && (err.expose || err.name === 'URIError' || err instanceof SyntaxError || err.type)) {
    const code = clientStatus === 413 ? 'PAYLOAD_TOO_LARGE' : clientStatus === 404 ? 'NOT_FOUND' : clientStatus === 405 ? 'METHOD_NOT_ALLOWED' : 'BAD_REQUEST';
    return res.status(clientStatus).json({ error: clientStatus === 413 ? 'Request too large' : 'Invalid request', code, requestId: req.requestId });
  }

  const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  console.error('API Error:', {
    requestId: req.requestId,
    url: req.originalUrl,
    method: req.method,
    statusCode,
    message: err.message,
    ...(config.env === 'development' ? { stack: err.stack } : {}),
  });

  if (statusCode === 500) {
    // Operator alert: route pattern + request id only (no query string, body or message).
    void raiseOpsAlert(`api.error:${routeOf(req)}`, `${routeOf(req)} ${err.name} request ${req.requestId}`);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', requestId: req.requestId });
  }
  return res.status(statusCode).json({ error: 'Request failed', code: 'ERROR', requestId: req.requestId });
}
