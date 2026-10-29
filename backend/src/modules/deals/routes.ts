/**
 * MOD-deals — HTTP routes. Owner: BE4. Mounted at /api/deals (plan §4.1 + ORCH-2 additions).
 * Pattern: authenticate -> requireAction -> idempotent (commands) -> Zod -> service (runCommand) -> JSON.
 * Every command body carries `version`; repeating a command already in its target state is a no-op 200.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { access, assertAllowed, principalFromRequest, requireAction } from '../../shared/access.js';
import { runCommand } from '../../shared/tx.js';
import { auditOwnerHiddenRead } from '../access/schemas.js';
import { idempotent } from '../platform/idempotency.js';
import {
  AdvanceStageBody,
  AssignDeveloperBody,
  ClosureRejectBody,
  ClosureRequestBody,
  ClosureVerifyBody,
  ContractBody,
  FinalizeBody,
  FinancialCorrectionBody,
  IdParam,
  ListDealsQuery,
  NotProceedingBody,
  RecordPaymentBody,
  RecordSignatureBody,
  RemoveFactBody,
  ReopenBody,
} from './schemas.js';
import * as service from './service.js';
import { relevantCallNotes } from './callNotes.js';
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
// D15 (BE2): read-only relevant call notes for the assigned Developer / Owner (callNotes.ts).
router.get('/:id/call-notes', authenticate, requireAction('deal.read'), async (req, res, next) => {
  try {
    const { id } = IdParam.parse(req.params);
    const principal = principalFromRequest(req);
    assertAllowed(await access.check(pool, principal, 'deal.read', { type: 'deal', id }));
    res.json(await relevantCallNotes(pool, principal, id));
  } catch (e) {
    next(e);
  }
});

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
// D16: forward-only stage move and contract amount (Owner or the assigned Developer, narrowed in the service).
command('advance-stage', 'deal.update_stage', 'deal.advance_stage', AdvanceStageBody, service.advanceStage as Cmd);
command('contract', 'deal.update_stage', 'deal.set_contract', ContractBody, service.setContract as Cmd);
command('signature', 'deal.record_signature', 'deal.record_signature', RecordSignatureBody, service.recordSignature as Cmd);
command('payment', 'deal.record_payment', 'deal.record_payment', RecordPaymentBody, service.recordPayment as Cmd);
command('remove-fact', 'deal.update_stage', 'deal.remove_fact', RemoveFactBody, service.removeFact as Cmd);
command('closure-request', 'deal.request_closure_verification', 'deal.request_closure_verification', ClosureRequestBody, service.requestClosureVerification as Cmd);
command('closure-verify', 'deal.verify_closure', 'deal.verify_closure', ClosureVerifyBody, service.verifyClosure as Cmd);
command('closure-reject', 'deal.reject_closure', 'deal.reject_closure', ClosureRejectBody, service.rejectClosure as Cmd);
command('not-proceeding', 'deal.mark_not_proceeding', 'deal.mark_not_proceeding', NotProceedingBody, service.markNotProceeding as Cmd);
command('reopen', 'deal.reopen_not_proceeding', 'deal.reopen_not_proceeding', ReopenBody, service.reopenNotProceeding as Cmd);
// D16: only Owner verification closes. Finalize = the Owner records and verifies directly (`deal.finalize`, admin, 2FA).
command('finalize', 'deal.finalize', 'deal.finalize', FinalizeBody, service.finalize as Cmd);
// D16 Owner-only correction of a verified closed deal's financial facts (reason, prior values kept).
command('financial-correction', 'deal.finalize', 'deal.correct_financials', FinancialCorrectionBody, service.correctFinancials as Cmd);

export default router;
