/**
 * MOD-corrections — HTTP routes, mounted at /api/correction-requests. Owner: BE2. Contract: [BE2-C2].
 * Pattern: authenticate → VT-3 guard → Zod parse → service (one transaction) → JSON.
 */
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { principalFromRequest } from '../../shared/access.js';
import { runCommand } from '../../shared/tx.js';
import { guard } from '../access/schemas.js';
import { clock } from '../platform/clock.js';
import { idOf, parse } from '../businesses/http.js';
import { runBusinessCommand } from '../businesses/service.js';
import {
  CloseNoChangeSchema,
  CorrectionListQuerySchema,
  CorrectionVersionSchema,
  RejectSchema,
  ResolveSchema,
  StartReviewSchema,
  SubmitCorrectionSchema,
} from './schemas.js';
import * as service from './service.js';

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap =
  (fn: Handler): RequestHandler =>
  (req, res, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const router = Router();
router.use(authenticate);

router.get(
  '/',
  guard('correction.read'),
  wrap(async (req, res) => {
    const q = parse(CorrectionListQuerySchema, req.query);
    res.json(await service.listCorrections(pool, principalFromRequest(req), q, clock.now()));
  })
);

router.post(
  '/',
  guard('correction.submit'),
  wrap(async (req, res) => {
    const body = parse(SubmitCorrectionSchema, req.body);
    const principal = principalFromRequest(req);
    res.status(201).json(await runCommand(req, (ctx) => service.submitCorrection(ctx, principal, body)));
  })
);

router.get(
  '/:id',
  guard('correction.read'),
  wrap(async (req, res) => {
    res.json(await service.getCorrection(pool, principalFromRequest(req), idOf(req)));
  })
);

router.post(
  '/:id/start-review',
  guard('correction.review'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(StartReviewSchema, req.body ?? {});
    const principal = principalFromRequest(req);
    res.json(await runCommand(req, (ctx) => service.startReview(ctx, principal, id, body.version)));
  })
);

router.post(
  '/:id/release',
  guard('correction.review'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(CorrectionVersionSchema, req.body);
    const principal = principalFromRequest(req);
    res.json(await runCommand(req, (ctx) => service.releaseReview(ctx, principal, id, body.version)));
  })
);

router.post(
  '/:id/resolve',
  guard('correction.apply'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(ResolveSchema, req.body);
    const principal = principalFromRequest(req);
    res.json(await runBusinessCommand(req, principal, (ctx) => service.resolveCorrection(ctx, principal, id, body)));
  })
);

router.post(
  '/:id/reject',
  guard('correction.reject'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(RejectSchema, req.body);
    const principal = principalFromRequest(req);
    res.json(await runCommand(req, (ctx) => service.rejectCorrection(ctx, principal, id, body.version, body.reason)));
  })
);

router.post(
  '/:id/close-no-change',
  guard('correction.close'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(CloseNoChangeSchema, req.body);
    const principal = principalFromRequest(req);
    res.json(await runCommand(req, (ctx) => service.closeNoChange(ctx, principal, id, body.version, body.note)));
  })
);

router.post(
  '/:id/withdraw',
  guard('correction.withdraw'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(CorrectionVersionSchema, req.body);
    const principal = principalFromRequest(req);
    res.json(await runCommand(req, (ctx) => service.withdrawCorrection(ctx, principal, id, body.version)));
  })
);

export default router;
