/**
 * MOD-business — HTTP routes. Owner: BE2. Contract: [BE2-C2] on the board; plan §4.1.
 * Pattern: authenticate → VT-3 guard → Zod parse → service (runCommand / access check) → JSON.
 * Every route carries a guard (`guard(...)`), including the ones every role is denied (DELETE).
 */
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { assertAllowed, principalFromRequest, type AccessDecision, type Principal } from '../../shared/access.js';
import { audit, runCommand } from '../../shared/tx.js';
import { auditOwnerHiddenRead, guard } from '../access/schemas.js';
import { idempotent } from '../platform/idempotency.js';
import { categoryRequired, idOf, parse } from './http.js';
import { LIMITS, perUserLimiter } from '../../shared/rateLimit.js';
import {
  BusinessListQuerySchema,
  CategoryCreateSchema,
  CategoryRenameSchema,
  CategoryVersionSchema,
  CreateBusinessSchema,
  DuplicateCheckSchema,
  DuplicateReviewRequestSchema,
  RestoreBodySchema,
  HistoryQuerySchema,
  SearchQuerySchema,
  UpdateBusinessSchema,
  VersionBodySchema,
} from './schemas.js';
import * as service from './service.js';
import { PageQuerySchema } from '../../shared/pagination.js';

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap =
  (fn: Handler): RequestHandler =>
  (req, res, next: NextFunction) => {
    fn(req, res).catch(next);
  };


/**
 * Denials of business resources (authz §1 rule 6, AC-VIS-007): `business_access.denied` with ids and the
 * reason only, written in its own transaction. Not-found is not audited.
 */
async function auditDenial(req: Request, businessId: string, decision: AccessDecision): Promise<void> {
  if (decision.allowed || decision.reason === 'not_found') return;
  await runCommand(req, (ctx) =>
    audit(ctx, { eventName: 'business_access.denied', entityType: 'business', entityId: businessId, payload: { reason: decision.reason } })
  );
}

async function readable(req: Request, principal: Principal, id: string, action: 'business.read' | 'business.history.read') {
  const decision = await service.checkBusiness(pool, principal, action, id);
  await auditDenial(req, id, decision);
  assertAllowed(decision);
  return decision;
}

// ---------------------------------------------------------------------------------------------
// /api/businesses
// ---------------------------------------------------------------------------------------------

const router = Router();
router.use(authenticate);

router.get(
  '/',
  guard('business.list'),
  wrap(async (req, res) => {
    const q = parse(BusinessListQuerySchema, req.query);
    res.json(await service.listBusinesses(pool, principalFromRequest(req), q));
  })
);

router.post(
  '/duplicate-check',
  guard('business.duplicate_check'),
  // R2-07 / A-06: 30 per 10 min per user (exact in tests too: the 429 is asserted).
  perUserLimiter('duplicate-check', LIMITS.duplicateCheck.limit, LIMITS.duplicateCheck.windowMs, { exact: true }),
  wrap(async (req, res) => {
    const body = parse(DuplicateCheckSchema, req.body);
    res.json(await service.duplicateCheck(pool, principalFromRequest(req), body));
  })
);

/** D10 "Request Owner review" (audited; Owner in-app notice; grants no access). Same rate limit as the check. */
router.post(
  '/duplicate-review-requests',
  guard('business.duplicate_review_request'),
  perUserLimiter('duplicate-review', LIMITS.duplicateCheck.limit, LIMITS.duplicateCheck.windowMs),
  wrap(async (req, res) => {
    const body = parse(DuplicateReviewRequestSchema, req.body);
    const principal = principalFromRequest(req);
    res.status(201).json(await runCommand(req, (ctx) => service.requestDuplicateReview(ctx, principal, body)));
  })
);

router.post(
  '/',
  guard('business.create'),
  idempotent('business.create'),
  wrap(async (req, res) => {
    const body = parse(CreateBusinessSchema, req.body, categoryRequired);
    const principal = principalFromRequest(req);
    const detail = await service.runBusinessCommand(req, principal, (ctx) => service.createBusiness(ctx, principal, body));
    res.status(201).json(detail);
  })
);

router.get(
  '/:id',
  guard('business.read'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const principal = principalFromRequest(req);
    const decision = await readable(req, principal, id, 'business.read');
    if (decision.ownerViewedHidden) await runCommand(req, (ctx) => auditOwnerHiddenRead(ctx, id));
    res.json(await service.getBusinessDetail(pool, principal, id, decision));
  })
);

router.patch(
  '/:id',
  guard('business.update'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(UpdateBusinessSchema, req.body);
    const principal = principalFromRequest(req);
    res.json(await service.runBusinessCommand(req, principal, (ctx) => service.updateBusiness(ctx, principal, id, body)));
  })
);

router.post(
  '/:id/archive',
  guard('business.archive'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(VersionBodySchema, req.body);
    const principal = principalFromRequest(req);
    res.json(
      await service.runBusinessCommand(req, principal, (ctx) => service.setBusinessArchived(ctx, principal, id, body.version, true, body.reason ?? null))
    );
  })
);

router.post(
  '/:id/restore',
  guard('business.restore'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(RestoreBodySchema, req.body);
    const principal = principalFromRequest(req);
    res.json(
      await service.runBusinessCommand(req, principal, (ctx) =>
        service.setBusinessArchived(ctx, principal, id, body.version, false, body.reason ?? null, body.categoryId ?? null)
      )
    );
  })
);

/** C-01: no hard delete in v1. The matrix grants `business.delete` to nobody, so every role gets 403. */
router.delete(
  '/:id',
  guard('business.delete'),
  wrap(async () => {
    throw new Error('unreachable: business.delete is granted to no role');
  })
);

router.get(
  '/:id/history',
  guard('business.history.read'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const q = parse(HistoryQuerySchema, req.query);
    const principal = principalFromRequest(req);
    const decision = await readable(req, principal, id, 'business.history.read');
    res.json(await service.getHistory(pool, principal, id, decision, q.page, q.pageSize));
  })
);

export default router;

// ---------------------------------------------------------------------------------------------
// /api/categories
// ---------------------------------------------------------------------------------------------

/**
 * D12 (approved 2026-10-29): category management is Owner only (matrix row, Owner + completed 2FA). There is
 * no delegation toggle: the retired DEC-015 `categories.dataEntryManage` flag is not read anywhere.
 */
function categoryManageGuard(action: 'category.create' | 'category.rename'): RequestHandler {
  return guard(action);
}

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);

categoriesRouter.get(
  '/',
  guard('category.list'),
  wrap(async (req, res) => {
    const q = parse(PageQuerySchema.pick({ page: true, pageSize: true }).strict(), req.query);
    res.json(await service.listCategories(pool, principalFromRequest(req), q.page, q.pageSize));
  })
);

categoriesRouter.post(
  '/',
  categoryManageGuard('category.create'),
  wrap(async (req, res) => {
    const body = parse(CategoryCreateSchema, req.body);
    res.status(201).json(await runCommand(req, (ctx) => service.createCategory(ctx, body.name)));
  })
);

categoriesRouter.patch(
  '/:id',
  categoryManageGuard('category.rename'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(CategoryRenameSchema, req.body);
    res.json(await runCommand(req, (ctx) => service.renameCategory(ctx, id, body.name, body.version)));
  })
);

categoriesRouter.post(
  '/:id/deactivate',
  guard('category.deactivate'),
  wrap(async (req, res) => {
    const id = idOf(req);
    const body = parse(CategoryVersionSchema, req.body);
    res.json(await runCommand(req, (ctx) => service.deactivateCategory(ctx, id, body.version)));
  })
);

// ---------------------------------------------------------------------------------------------
// /api/search (SHR-010). The term travels in `q` by design (FE3-REQ-4); it is never logged here.
// ---------------------------------------------------------------------------------------------

export const searchRouter = Router();
searchRouter.use(authenticate);

searchRouter.get(
  '/',
  guard('business.search'),
  perUserLimiter('search', LIMITS.search.limit, LIMITS.search.windowMs),
  wrap(async (req, res) => {
    const q = parse(SearchQuerySchema, req.query);
    res.json(await service.searchBusinesses(pool, principalFromRequest(req), q));
  })
);
