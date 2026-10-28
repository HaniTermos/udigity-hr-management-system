/**
 * MOD-platform — HTTP routes. Owner: BE5.
 * - `/health/worker` (J-09): worker heartbeat freshness. Not under /api; nginx limits it to the
 *   uptime monitor + localhost (security checklist C). Returns no business data.
 * - `/api/test-support` (QA-2): test clock + on-demand job runner. Mounted ONLY when NODE_ENV=test
 *   (module.ts), so it does not exist in development or production builds.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../../shared/errors.js';
import type { JobKind } from '../../shared/platform.js';
import { getJobHandlers } from '../../shared/platform.js';
import { clock } from './clock.js';
import { companyTimezone, relayOutboxOnce, runDueJobs, runJobNow, schedulerTick, workerHealth } from './service.js';

/** This module exposes no business API routes. */
const router = Router();
export default router;

export const healthRouter = Router();
healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const h = await workerHealth();
    res.set('Cache-Control', 'no-store');
    res.status(h.status === 'ok' ? 200 : 503).json(h);
  } catch {
    res.status(503).json({ status: 'unknown' });
  }
});

// ---------------------------------------------------------------------------
// Test support (NODE_ENV=test only)
// ---------------------------------------------------------------------------

const ClockSchema = z
  .object({
    at: z.string().datetime({ offset: true }).optional(),
    advanceSeconds: z.number().int().min(-31_536_000).max(31_536_000).optional(),
  })
  .strict()
  .refine((b) => (b.at === undefined) !== (b.advanceSeconds === undefined), { message: 'Give exactly one of at / advanceSeconds' });

const RunJobSchema = z.object({ payload: z.record(z.string().max(100), z.unknown()).optional() }).strict();

export const testSupportRouter = Router();

testSupportRouter.get('/clock', (_req, res) => {
  res.json({ now: clock.now().toISOString(), overridden: clock.isOverridden() });
});

testSupportRouter.put('/clock', (req, res, next) => {
  try {
    const body = ClockSchema.parse(req.body);
    if (body.at !== undefined) clock.set(new Date(body.at));
    else clock.advance((body.advanceSeconds ?? 0) * 1000);
    res.json({ now: clock.now().toISOString(), overridden: true });
  } catch (e) {
    next(e);
  }
});

testSupportRouter.delete('/clock', (_req, res) => {
  clock.set(null);
  res.json({ now: clock.now().toISOString(), overridden: false });
});

/** Run one job kind now (`platform.outbox_relay` runs the relay once). */
testSupportRouter.post('/jobs/:kind/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kind = req.params.kind;
    const body = RunJobSchema.parse(req.body ?? {});
    if (!getJobHandlers().some((h) => h.kind === kind)) throw new HttpError(404, 'NOT_FOUND', 'Unknown job kind');
    await runJobNow(kind as JobKind, body.payload ?? {});
    res.json({ ran: kind, at: clock.now().toISOString() });
  } catch (e) {
    next(e);
  }
});

/** One worker iteration: relay + scheduler tick + due jobs. */
testSupportRouter.post('/worker/tick', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const relay = await relayOutboxOnce();
    const scheduled = await schedulerTick(await companyTimezone());
    const jobs = await runDueJobs();
    res.json({ relay, scheduled, jobs });
  } catch (e) {
    next(e);
  }
});
