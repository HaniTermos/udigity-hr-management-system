/**
 * MOD-reservation — HTTP routes (plan.md §4.1 /api/reservations). Owner: BE3.
 * Pattern: authenticate -> requireAction (authz-matrix §3.7) -> Zod -> service in runCommand -> JSON.
 * Every handler re-checks access on the business (B7, including the assignee) inside the service.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAction, type Action } from '../../shared/access.js';
import { runCommand } from '../../shared/tx.js';
import { LIMITS, perUserLimiter } from '../../shared/rateLimit.js';

/** R2-07: per caller and per reservation heartbeat budget. */
const renewLimiter = perUserLimiter('reservation-renew', LIMITS.reservationRenew.limit, LIMITS.reservationRenew.windowMs, {
  key: (req) => String(req.params.id ?? ''),
});
import { idempotent } from '../platform/idempotency.js';
import {
  AcquireReservationBody,
  OverrideReservationBody,
  ReleaseReservationBody,
  RenewReservationBody,
  ReservationIdParam,
} from './schemas.js';
import { acquire, override, release, renew, reservationLost } from './service.js';

const act = (a: string) => requireAction(a as Action);

/** Mounted at /api/reservations. */
const router = Router();

router.post('/', authenticate, act('reservation.acquire'), idempotent('reservation.acquire'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = AcquireReservationBody.parse(req.body);
    const r = await runCommand(req, (ctx) => acquire(ctx, body.businessId));
    res.status(r.created ? 201 : 200).json(r.dto);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/renew', authenticate, act('reservation.renew'), renewLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ReservationIdParam.parse(req.params);
    const body = RenewReservationBody.parse(req.body);
    const r = await runCommand(req, (ctx) => renew(ctx, id, body));
    // A lost reservation is recorded (committed) before the 409 is returned.
    if (r.kind === 'lost') throw reservationLost(r.reason);
    res.json(r.dto);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/release', authenticate, act('reservation.release'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ReservationIdParam.parse(req.params);
    const body = ReleaseReservationBody.parse(req.body);
    res.json(await runCommand(req, (ctx) => release(ctx, id, body.leaseToken)));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/override', authenticate, act('reservation.override'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ReservationIdParam.parse(req.params);
    const body = OverrideReservationBody.parse(req.body);
    res.json(await runCommand(req, (ctx) => override(ctx, id, body.reason)));
  } catch (e) {
    next(e);
  }
});

export default router;
