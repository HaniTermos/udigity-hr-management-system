/**
 * MOD-deals — HTTP routes. Owner: BE4. Mounted at /api/deals (plan §4.1 + ORCH-2 additions).
 * Pattern: authenticate -> requireAction -> idempotent (commands) -> Zod -> service (runCommand) -> JSON.
 * Every command body carries `version`; repeating a command already in its target state is a no-op 200.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { access, assertAllowed, principalFromRequest, requireAction, requireActionFor } from '../../shared/access.js';
import { runCommand } from '../../shared/tx.js';
import { auditOwnerHiddenRead } from '../access/schemas.js';
import { idempotent } from '../platform/idempotency.js';
import {
  AssignDeveloperBody,
  ClosureRejectBody,
  ClosureRequestBody,
  ClosureVerifyBody,
  FinalizeBody,
  IdParam,
  ListDealsQuery,
  NotProceedingBody,
  RecordPaymentBody,
  RecordSignatureBody,
  RemoveFactBody,
  ReopenBody,
} from './schemas.js';
import * as service from './service.js';
import { activeEmployeesByRole } from '../employees/service.js';

/** Mounted at /api/deals. */
const router = Router();

router.get('/', authenticate, requireAction('deal.read'), async (req, res, next) => {
  try {
    const q = ListDealsQuery.parse(req.query);
    res.json(await service.listDeals(pool, principalFromRequest(req), q));
  } catch (e) {
    next(e);
  }
});

/**
 * BL-11: active Developers for the CC-007 "Assign developer" picker (id + name only). Same audience
 * as the command it feeds (`deal.assign_developer`: Owner, Call Center). Registered before `/:id`.
 */
router.get('/developers', authenticate, requireAction('deal.assign_developer'), async (_req, res, next) => {
  try {
    const items = await activeEmployeesByRole(pool, 'developer');
    res.json({ items, total: items.length });
  } catch (e) {
    next(e);
  }
});

async function readDeal(req: Request, res: Response, next: NextFunction, withHistory: boolean) {
  try {
    const { id } = IdParam.parse(req.params);
    const principal = principalFromRequest(req);
    const decision = await access.check(pool, principal, 'deal.read', { type: 'deal', id });
    assertAllowed(decision);
    const deal = await service.getDealForReader(pool, principal, id);
    if (decision.ownerViewedHidden) await runCommand(req, (ctx) => auditOwnerHiddenRead(ctx, deal.businessId));
    if (withHistory) {
      res.json({ items: await service.dealHistory(pool, id) });
      return;
    }
    res.json({ deal, access: decision.level, ...(decision.exceptionRow ? { exceptionRow: decision.exceptionRow } : {}) });
  } catch (e) {
    next(e);
  }
}

router.get('/:id', authenticate, requireAction('deal.read'), (req, res, next) => readDeal(req, res, next, false));
router.get('/:id/history', authenticate, requireAction('deal.read'), (req, res, next) => readDeal(req, res, next, true));

type Cmd = (ctx: Parameters<Parameters<typeof runCommand>[1]>[0], id: string, body: never) => Promise<unknown>;

function command(path: string, gate: string, operation: string, schema: { parse(v: unknown): unknown }, fn: Cmd) {
  router.post(
    `/:id/${path}`,
    authenticate,
    requireAction(gate as Parameters<typeof requireAction>[0]),
    idempotent(operation),
    async (req, res, next) => {
      try {
        const { id } = IdParam.parse(req.params);
        const body = schema.parse(req.body) as never;
        const deal = await runCommand(req, (ctx) => fn(ctx, id, body));
        res.json({ deal });
      } catch (e) {
        next(e);
      }
    }
  );
}

command('developer', 'deal.assign_developer', 'deal.assign_developer', AssignDeveloperBody, service.assignDeveloper as Cmd);
command('signature', 'deal.record_signature', 'deal.record_signature', RecordSignatureBody, service.recordSignature as Cmd);
command('payment', 'deal.record_payment', 'deal.record_payment', RecordPaymentBody, service.recordPayment as Cmd);
command('remove-fact', 'deal.update_stage', 'deal.remove_fact', RemoveFactBody, service.removeFact as Cmd);
command('closure-request', 'deal.request_closure_verification', 'deal.request_closure_verification', ClosureRequestBody, service.requestClosureVerification as Cmd);
command('closure-verify', 'deal.verify_closure', 'deal.verify_closure', ClosureVerifyBody, service.verifyClosure as Cmd);
command('closure-reject', 'deal.reject_closure', 'deal.reject_closure', ClosureRejectBody, service.rejectClosure as Cmd);
command('not-proceeding', 'deal.mark_not_proceeding', 'deal.mark_not_proceeding', NotProceedingBody, service.markNotProceeding as Cmd);
command('reopen', 'deal.reopen_not_proceeding', 'deal.reopen_not_proceeding', ReopenBody, service.reopenNotProceeding as Cmd);

// Finalize: the Owner passes `deal.finalize` (admin, 2FA); a Developer passes the `deal.update_stage`
// gate and the service allows it only under DEC-006 `direct` for the assigned Developer (matrix note).
router.post(
  '/:id/finalize',
  authenticate,
  requireActionFor((req) => (req.user?.role === 'developer' ? 'deal.update_stage' : 'deal.finalize'), ['deal.finalize', 'deal.update_stage']),
  idempotent('deal.finalize'),
  async (req, res, next) => {
    try {
      const { id } = IdParam.parse(req.params);
      const body = FinalizeBody.parse(req.body);
      const deal = await runCommand(req, (ctx) => service.finalize(ctx, id, body));
      res.json({ deal });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
