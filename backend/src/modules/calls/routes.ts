/**
 * MOD-calls — HTTP routes (plan.md §4.1 /api/calling and /api/follow-ups; ORCH-4 b inbound DNC route). Owner: BE3.
 * Pattern: authenticate -> requireAction (authz-matrix §3.7) -> Zod -> service (runCommand for writes) -> JSON.
 * Every handler re-checks access on the business inside the service (B7, including for the assignee).
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { pool } from '../../db/pool.js';
import { principalFromRequest, requireAction, type Action } from '../../shared/access.js';
import { IDEMPOTENCY_HEADER } from '../../shared/platform.js';
import { runCommand, type CommandContext } from '../../shared/tx.js';
import { auditOwnerHiddenRead } from '../access/schemas.js';
import { idempotent } from '../platform/idempotency.js';
import {
  BusinessIdParam,
  CancelFollowUpBody,
  CompleteFollowUpBody,
  CreateFollowUpBody,
  DoNotCallQuery,
  IdParam,
  ListFollowUpsQuery,
  LogAttemptBody,
  LogInboundRejectionBody,
  OpportunitiesQuery,
  QueueQuery,
  ReopenBody,
  UpdateFollowUpBody,
} from './schemas.js';
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  doNotCall,
  finishSave,
  listFollowUpItems,
  listOpportunityItems,
  logAttempt,
  logInboundRejection,
  queue,
  reopenRejected,
  requeueAccepted,
  updateFollowUp,
  workspace,
} from './service.js';

const act = (a: string) => requireAction(a as Action);
type Handler = (req: Request, res: Response) => Promise<void>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
/** The idempotent() middleware already validated the header (UUID, required). */
const keyOf = (req: Request) => (req.get(IDEMPOTENCY_HEADER) ?? '').toLowerCase();

/** Mounted at /api/calling. */
const router = Router();

router.get('/queue', authenticate, act('calling.queue.read'), h(async (req, res) => {
  res.json(await queue(pool, principalFromRequest(req), QueueQuery.parse(req.query)));
}));

router.get('/businesses/:id/workspace', authenticate, act('calling.queue.read'), h(async (req, res) => {
  const { id } = BusinessIdParam.parse(req.params);
  const r = await workspace(pool, principalFromRequest(req), id);
  if (r.ownerViewedHidden) await runCommand(req, (ctx) => auditOwnerHiddenRead(ctx, id));
  res.json(r.dto);
}));

/** SEQ-11/13: attempt + outcome (+ follow-up / D2 / E5 deal) in one transaction; reservation step after commit (AR-03). */
router.post('/attempts', authenticate, act('call.log_attempt'), idempotent('calling.attempt'), h(async (req, res) => {
  const body = LogAttemptBody.parse(req.body);
  const commit = await runCommand(req, (ctx) => logAttempt(ctx, body, keyOf(req)));
  const run = <T>(fn: (ctx: CommandContext) => Promise<T>) => runCommand(req, fn);
  res.status(201).json(await finishSave(run, commit));
}));

/** B3-Q10 inbound do-not-call outside a call (ORCH-4 b: separate route; no reservation). */
router.post('/attempts/inbound-rejection', authenticate, act('call.log_attempt'), idempotent('calling.inbound_rejection'), h(async (req, res) => {
  const body = LogInboundRejectionBody.parse(req.body);
  res.status(201).json(await runCommand(req, (ctx) => logInboundRejection(ctx, body, keyOf(req))));
}));

router.get('/do-not-call', authenticate, act('call_attempt.list_do_not_call'), h(async (req, res) => {
  res.json(await doNotCall(pool, principalFromRequest(req), DoNotCallQuery.parse(req.query)));
}));

router.get('/opportunities', authenticate, act('call_attempt.list_opportunities'), h(async (req, res) => {
  res.json(await listOpportunityItems(pool, principalFromRequest(req), OpportunitiesQuery.parse(req.query)));
}));

router.post('/businesses/:id/reopen', authenticate, act('business.reopen_rejected'), h(async (req, res) => {
  const { id } = BusinessIdParam.parse(req.params);
  const body = ReopenBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => reopenRejected(ctx, id, body)));
}));

router.post('/businesses/:id/requeue', authenticate, act('business.requeue'), h(async (req, res) => {
  const { id } = BusinessIdParam.parse(req.params);
  const body = ReopenBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => requeueAccepted(ctx, id, body)));
}));

export default router;

/** Mounted at /api/follow-ups. */
export const followUpsRouter = Router();

followUpsRouter.get('/', authenticate, act('follow_up.read'), h(async (req, res) => {
  res.json(await listFollowUpItems(pool, principalFromRequest(req), ListFollowUpsQuery.parse(req.query)));
}));

followUpsRouter.post('/', authenticate, act('follow_up.create'), idempotent('follow_up.create', { required: false }), h(async (req, res) => {
  const body = CreateFollowUpBody.parse(req.body);
  const r = await runCommand(req, (ctx) => createFollowUp(ctx, body));
  res.status(r.rescheduled ? 200 : 201).json(r);
}));

followUpsRouter.patch('/:id', authenticate, act('follow_up.reschedule'), h(async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const body = UpdateFollowUpBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => updateFollowUp(ctx, id, body)));
}));

followUpsRouter.post('/:id/complete', authenticate, act('follow_up.complete'), h(async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const body = CompleteFollowUpBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => completeFollowUp(ctx, id, body)));
}));

followUpsRouter.post('/:id/cancel', authenticate, act('follow_up.cancel'), h(async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const body = CancelFollowUpBody.parse(req.body);
  res.json(await runCommand(req, (ctx) => cancelFollowUp(ctx, id, body)));
}));
