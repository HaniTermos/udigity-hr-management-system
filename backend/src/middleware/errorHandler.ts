import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/index.js';
import { isHttpError } from '../shared/errors.js';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
  details?: unknown;
  expose?: boolean;
}

/**
 * Generic error responses. Internal messages (SQL, stack, driver errors) never reach the client;
 * they are logged with the request id instead.
 */
export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  // Shared error contract (src/shared/errors.ts): client-safe status, code, message and details.
  if (isHttpError(err)) {
    if (err.statusCode >= 500) {
      console.error('API Error:', { requestId: req.requestId, url: req.originalUrl, method: req.method, code: err.code });
    }
    return res.status(err.statusCode).json(err.toBody(req.requestId));
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
  }

  // Malformed JSON body or oversized payload from express.json()
  if (err.status && err.status >= 400 && err.status < 500 && err.expose) {
    return res.status(err.status).json({ error: 'Invalid request', code: 'BAD_REQUEST' });
  }

  // PostgreSQL duplicate key violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists', code: 'CONFLICT_DUPLICATE' });
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
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', requestId: req.requestId });
  }
  return res.status(statusCode).json({ error: 'Request failed', code: 'ERROR' });
}
