/**
 * MOD-reports — HTTP routes. Owner: BE5.
 * Mounted at /api/reports and /api/dashboard.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requireAction } from '../../shared/access.js';
import { pool } from '../../db/pool.js';
import { DashboardQuerySchema, ExportQuerySchema } from './schemas.js';
import * as service from './service.js';

/** Mounted at /api/dashboard */
export const dashboardRouter = Router();

dashboardRouter.get('/', authenticate, requireAction('dashboard.owner.read'), async (req, res, next) => {
  try {
    const q = DashboardQuerySchema.parse(req.query);
    const metrics = await service.getDashboardMetrics(pool, q.period, q.from, q.to);
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

/** Mounted at /api/reports */
const router = Router();

router.get('/', authenticate, requireAction('report.read'), async (_req, res, next) => {
  try {
    const reports = service.listReports();
    // rowCap: every export returns at most this many rows (newest first); the UI states it up front.
    res.json({ items: reports, total: reports.length, rowCap: service.EXPORT_LIMITS.rowCap });
  } catch (err) {
    next(err);
  }
});

/**
 * R2-02: an export changes state (export record + audit), so it is POST only. GET answers 405 and
 * does nothing else (contract change on the board: the UI must POST with an optional `totpCode`).
 */
router.get('/export', authenticate, requireAction('report.export'), (_req, res) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({ error: 'Use POST /api/reports/export', code: 'METHOD_NOT_ALLOWED' });
});

/** R2-02 rate limit: per Owner (session employee), not per IP. Security default, not approved. */
const exportLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `export:${req.user?.id ?? 'anonymous'}`,
  message: { error: 'Too many exports. Please wait and try again.', code: 'RATE_LIMITED' },
});

let activeExports = 0;
const MAX_CONCURRENT_EXPORTS = 5;

router.post('/export', authenticate, requireAction('report.export'), exportLimiter, async (req, res, next) => {
  if (activeExports >= MAX_CONCURRENT_EXPORTS) {
    res.setHeader('Retry-After', '5');
    res.status(429).json({
      error: 'Export capacity reached. Another export is currently running. Please wait and try again.',
      code: 'CONCURRENT_EXPORT_LIMIT',
    });
    return;
  }
  activeExports++;
  try {
    const q = ExportQuerySchema.parse(req.body);
    // Synchronous streaming: headers go out when the row count is known, then the body in chunks.
    const sink: service.ExportSink = {
      start(meta) {
        res.status(200);
        res.setHeader('Content-Type', meta.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${meta.filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        // Additive: lets the UI say "first N rows" when the row cap applied.
        res.setHeader('X-Export-Row-Count', String(meta.rowCount));
        res.setHeader('X-Export-Truncated', String(meta.truncated));
        res.setHeader('X-Export-Row-Cap', String(service.EXPORT_LIMITS.rowCap));
        res.flushHeaders();
      },
      write(chunk) {
        if (!chunk) return Promise.resolve();
        if (res.destroyed) return Promise.reject(new service.ClientAbortedError());
        if (res.write(chunk)) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
          const done = (err?: Error) => {
            res.off('drain', onDrain);
            res.off('close', onClose);
            if (err) reject(err);
            else resolve();
          };
          const onDrain = () => done();
          const onClose = () => done(new service.ClientAbortedError());
          res.once('drain', onDrain);
          res.once('close', onClose);
        });
      },
    };
    await service.exportReport(req, q.report, q.format, { from: q.from, to: q.to }, q.totpCode, sink);
    res.end();
  } catch (err) {
    // After the first byte the status is gone: abort the connection so the client sees a failed download.
    if (res.headersSent) res.destroy(err as Error);
    else next(err);
  } finally {
    activeExports--;
  }
});

export default router;
