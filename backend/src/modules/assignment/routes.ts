/**
 * MOD-assignment — HTTP routes (plan.md §4.1 /api/calling-assignments). Owner: BE3.
 * Pattern: authenticate -> requireAction (authz-matrix §3.7, Owner + 2FA) -> Zod -> service in runCommand -> JSON.
 * Every command re-checks the business with access.check inside the transaction.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { pool } from '../../db/pool.js';
import { principalFromRequest, requireAction, type Action } from '../../shared/access.js';
import { runCommand } from '../../shared/tx.js';
import { idempotent } from '../platform/idempotency.js';
import { AssignBody, AutofillBody, ListAssignmentsQuery, ReassignBody, ReassignImpactBody, UnassignBody } from './schemas.js';
import { assign, autofill, list, reassign, reassignImpact, unassign } from './service.js';

const act = (a: string) => requireAction(a as Action);
type Handler = (req: Request, res: Response) => Promise<void>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** Mounted at /api/calling-assignments. */
const router = Router();

router.get('/', authenticate, act('calling.assign'), h(async (req, res) => {
  const q = ListAssignmentsQuery.parse(req.query);
  res.json(await list(pool, principalFromRequest(req), q));
}));

router.post('/assign', authenticate, act('calling.assign'), idempotent('calling.assign', { required: false }), h(async (req, res) => {
  const body = AssignBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => assign(ctx, body)));
}));

/** OWN-008 preview: no writes (runs in a transaction only to share the command helpers). */
router.post('/reassign-impact', authenticate, act('calling.assign'), h(async (req, res) => {
  const body = ReassignImpactBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => reassignImpact(ctx, body)));
}));

router.post('/reassign', authenticate, act('calling.reassign'), h(async (req, res) => {
  const body = ReassignBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => reassign(ctx, body)));
}));

router.post('/unassign', authenticate, act('calling.unassign'), h(async (req, res) => {
  const body = UnassignBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => unassign(ctx, body)));
}));

router.post('/autofill', authenticate, act('calling.autofill'), idempotent('calling.autofill', { required: false }), h(async (req, res) => {
  const body = AutofillBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => autofill(ctx, body)));
}));

export default router;
