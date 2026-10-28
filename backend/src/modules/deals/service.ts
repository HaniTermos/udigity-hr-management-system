/**
 * MOD-deals — service (SM-COMMERCIAL-001 stage machine, closure under DEC-006, DEC-005 Developer rules,
 * OQ-15 reopen, E5 entry point for MOD-calls). Owner: BE4. Design: docs/implementation/delivery-design.md §2–§3.
 *
 * Every pending policy here is "Demonstration alternative — not approved (docs/policy-defaults.md)".
 * One command = one transaction: lock the deal, access.check, guards, change, deal_changes, audit, outbox.
 * MOD-deals never calls MOD-projects or MOD-meetings: it emits `deal.closed` (E-14) and lets projects
 * register a read-only "project info" provider at init (no import cycle).
 */
import type { Queryable } from '../../db/pool.js';
import { access, type Principal } from '../../shared/access.js';
import {
  HttpError,
  notFound,
  permissionDenied,
  policyNotConfigured,
  stateConflict,
  versionConflict,
} from '../../shared/errors.js';
import { outbox } from '../../shared/outbox.js';
import { orderByClause, pageClause, toPage, type PageResult } from '../../shared/pagination.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { dealCurrencies, deliveryPolicy, DEMO_LABEL, type DeliveryPolicy } from './policy.js';
import * as repo from './repo.js';
import type { DealRow } from './repo.js';
import type {
  ClosureReviewDto,
  CreateAcceptedOpportunityInput,
  DealAllowedActions,
  DealDto,
  DealListItemDto,
  DealStage,
  NotProceedingDealDto,
  OpportunityDto,
} from './schemas.js';
import {
  actorIdOf,
  assertActiveEmployee,
  authorize,
  businessNames,
  employeeNames,
  inSequence,
  iso,
  principalOf,
  requireOwner,
  roleOf,
} from './support.js';

export * from './support.js';
export { deliveryPolicy, setDeliveryPolicyForTests, DEMO_LABEL } from './policy.js';
export type { DeliveryPolicy } from './policy.js';

const OPEN_STAGES: readonly DealStage[] = ['accepted_opportunity', 'signed', 'paid', 'signed_and_paid'];
const isOpen = (s: DealStage) => OPEN_STAGES.includes(s);

// ---------------------------------------------------------------------------
// Project info provider (registered by MOD-projects init; deals never imports projects)
// ---------------------------------------------------------------------------
export interface DealProjectInfo {
  projectId: string | null;
  projectStatus: string | null;
  provisioning: 'provisioned' | 'pending' | 'failed';
}
type ProjectInfoProvider = (db: Queryable, dealIds: string[]) => Promise<Map<string, DealProjectInfo>>;
let projectInfo: ProjectInfoProvider = async () => new Map();
export function registerDealProjectInfoProvider(p: ProjectInfoProvider): void {
  projectInfo = p;
}

// ---------------------------------------------------------------------------
// Read ops for other BE4 modules (meetings, projects) and BE3
// ---------------------------------------------------------------------------
export interface DealSummary {
  id: string;
  code: string;
  businessId: string;
  stage: DealStage;
  assignedDeveloperId: string | null;
  acceptedById: string;
  closedAt: Date | null;
}

const summary = (d: DealRow): DealSummary => ({
  id: d.id,
  code: d.code,
  businessId: d.business_id,
  stage: d.stage,
  assignedDeveloperId: d.assigned_developer_id,
  acceptedById: d.accepted_by_id,
  closedAt: d.closed_at,
});

export async function getDealSummary(db: Queryable, id: string): Promise<DealSummary | null> {
  const d = await repo.findById(db, id);
  return d ? summary(d) : null;
}

export async function getDealSummaries(db: Queryable, ids: string[]): Promise<Map<string, DealSummary>> {
  const out = new Map<string, DealSummary>();
  for (const id of new Set(ids)) {
    const d = await repo.findById(db, id);
    if (d) out.set(id, summary(d));
  }
  return out;
}

/** Access resolver for `deal` (BE2-C1): a deal belongs to its business. */
export async function resolveDealBusiness(db: Queryable, id: string): Promise<string | null> {
  const d = await repo.findById(db, id);
  return d ? d.business_id : null;
}

/**
 * DEC-005 relation used by every BE4 module for Developer actions on a pre-closure deal:
 * the actor must be the deal's assigned Developer AND the flag must be `assigned`.
 */
export function developerMayActOnDeal(principal: Principal, deal: Pick<DealSummary, 'assignedDeveloperId'>, policy: DeliveryPolicy = deliveryPolicy()): boolean {
  return principal.role === 'developer' && policy.developerPreClosure === 'assigned' && deal.assignedDeveloperId === principal.employeeId;
}

/** Read confinement for a Developer (OI-27): assigned pre-closure deal (DEC-005 `assigned`), or a closed deal (row 2). */
export function developerMayReadDeal(principal: Principal, deal: Pick<DealSummary, 'assignedDeveloperId' | 'stage'>, policy: DeliveryPolicy = deliveryPolicy()): boolean {
  if (principal.role !== 'developer') return true;
  if (deal.stage === 'closed') return true;
  return developerMayActOnDeal(principal, deal, policy);
}

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------
function reviewDto(r: repo.ClosureReviewRow | null): ClosureReviewDto | null {
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    requestedById: r.requested_by_id,
    requestedAt: iso(r.requested_at)!,
    requestNote: r.request_note,
    decidedById: r.decided_by_id,
    decidedAt: iso(r.decided_at),
    rejectReason: r.reject_reason,
  };
}

export function allowedActions(
  p: Principal,
  d: DealRow,
  policy: DeliveryPolicy,
  hasOpenReview: boolean
): DealAllowedActions {
  const owner = p.role === 'owner' && p.sessionState === 'active';
  const dv = developerMayActOnDeal(p, { assignedDeveloperId: d.assigned_developer_id }, policy);
  const open = isOpen(d.stage);
  const sp = d.stage === 'signed_and_paid';
  const verify = policy.closureMode === 'ownerVerify';
  return {
    assignDeveloper: open && (owner || p.role === 'call_center'),
    recordSignature: (owner || dv) && (d.stage === 'accepted_opportunity' || d.stage === 'paid'),
    recordPayment: (owner || dv) && (d.stage === 'accepted_opportunity' || d.stage === 'signed'),
    removeFact: owner && (d.stage === 'signed' || d.stage === 'paid' || sp),
    requestClosureVerification: dv && verify && sp && !hasOpenReview,
    verifyClosure: owner && verify && sp && hasOpenReview,
    rejectClosure: owner && verify && sp && hasOpenReview,
    finalize: sp && (owner || (dv && policy.closureMode === 'direct')),
    markNotProceeding: open && (owner || dv),
    reopen: owner && d.stage === 'not_proceeding',
    scheduleMeeting: open && (owner || p.role === 'call_center' || dv),
  };
}

export async function toDealDto(db: Queryable, p: Principal, d: DealRow): Promise<DealDto> {
  const policy = deliveryPolicy();
  const [open, latest, info, names, biz] = await inSequence([
    () => repo.openReview(db, d.id),
    () => repo.latestReview(db, d.id),
    () => projectInfo(db, [d.id]),
    () => employeeNames(db, [d.accepted_by_id, d.assigned_developer_id]),
    () => businessNames(db, [d.business_id]),
  ]);
  const pi = info.get(d.id);
  return {
    id: d.id,
    code: d.code,
    version: d.version,
    businessId: d.business_id,
    businessName: biz.get(d.business_id) ?? null,
    stage: d.stage,
    clientNeedsNote: d.client_needs_note,
    acceptedById: d.accepted_by_id,
    acceptedByName: names.get(d.accepted_by_id) ?? null,
    assignedDeveloperId: d.assigned_developer_id,
    assignedDeveloperName: d.assigned_developer_id ? names.get(d.assigned_developer_id) ?? null : null,
    developerNotAssigned: d.assigned_developer_id === null,
    facts: {
      signature: d.signature_date
        ? {
            date: d.signature_date,
            reference: d.signature_reference ?? '',
            recordedById: d.signature_recorded_by_id ?? '',
            recordedAt: iso(d.signature_recorded_at) ?? '',
          }
        : null,
      payment: d.payment_date
        ? {
            date: d.payment_date,
            reference: d.payment_reference ?? '',
            amount: d.payment_amount,
            currency: d.payment_currency,
            recordedById: d.payment_recorded_by_id ?? '',
            recordedAt: iso(d.payment_recorded_at) ?? '',
          }
        : null,
    },
    closure:
      d.stage === 'closed' && d.closed_at && d.closed_by_id
        ? { closedAt: iso(d.closed_at)!, closedById: d.closed_by_id, mode: d.closure_mode ?? policy.closureMode }
        : null,
    openClosureReview: reviewDto(open),
    lastRejectedReview: d.stage === 'signed_and_paid' && latest?.status === 'rejected' ? reviewDto(latest) : null,
    notProceeding:
      d.stage === 'not_proceeding' && d.not_proceeding_reason && d.not_proceeding_at
        ? { reason: d.not_proceeding_reason, at: iso(d.not_proceeding_at)!, byId: d.not_proceeding_by_id ?? '' }
        : null,
    projectProvisioning: d.stage !== 'closed' ? 'not_applicable' : pi?.provisioning ?? 'pending',
    projectId: pi?.projectId ?? null,
    policy: {
      closureMode: policy.closureMode,
      developerPreClosure: policy.developerPreClosure,
      autoProvision: policy.autoProvision,
      label: DEMO_LABEL,
    },
    allowed: allowedActions(p, d, policy, Boolean(open)),
    createdAt: iso(d.created_at)!,
    updatedAt: iso(d.updated_at)!,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export interface DealListQuery {
  page: number;
  pageSize: number;
  sort?: string;
  order: 'asc' | 'desc';
  stage?: DealStage;
  developerId?: string;
  assignedToMe?: boolean;
  needsAttention?: 'developer_not_assigned' | 'closure_verification_requested';
  tab?: 'closed' | 'accepted';
  from?: string;
  to?: string;
  scope?: 'assigned_to_me' | 'all';
  closedWithinDays?: number;
  q?: string;
  projectStatus?: 'scheduled' | 'in_progress' | 'waiting_for_client' | 'blocked' | 'delivered' | 'completed' | 'none';
}

const DEAL_SORT: Record<string, string> = {
  createdAt: 'd.created_at',
  updatedAt: 'd.updated_at',
  closedAt: 'd.closed_at',
  code: 'd.code',
  stage: 'd.stage',
};

/** Developer list confinement (OI-27): own pre-closure deals under DEC-005 `assigned`, plus closed deals (row 2). */
function developerConfinement(p: Principal, params: SqlParams, policy: DeliveryPolicy): string {
  if (p.role !== 'developer') return 'TRUE';
  if (policy.developerPreClosure !== 'assigned') return `d.stage = 'closed'`;
  return `(d.stage = 'closed' OR d.assigned_developer_id = ${params.add(p.employeeId)}::uuid)`;
}

export async function listDeals(db: Queryable, p: Principal, q: DealListQuery): Promise<PageResult<DealListItemDto>> {
  const policy = deliveryPolicy();
  const params = new SqlParams();
  const where: string[] = [];
  if (q.stage) where.push(`d.stage = ${params.add(q.stage)}`);
  if (q.tab === 'closed') where.push(`d.stage = 'closed'`);
  if (q.tab === 'accepted') where.push(`d.stage IN ('accepted_opportunity','signed','paid','signed_and_paid')`);
  if (q.developerId) where.push(`d.assigned_developer_id = ${params.add(q.developerId)}::uuid`);
  if (q.assignedToMe || q.scope === 'assigned_to_me') where.push(`d.assigned_developer_id = ${params.add(p.employeeId)}::uuid`);
  if (q.closedWithinDays) where.push(`d.stage = 'closed' AND d.closed_at >= now() - make_interval(days => ${params.add(q.closedWithinDays)}::int)`);
  if (q.needsAttention === 'developer_not_assigned') {
    where.push(`d.assigned_developer_id IS NULL AND d.stage IN ('accepted_opportunity','signed','paid','signed_and_paid')`);
  }
  if (q.needsAttention === 'closure_verification_requested') {
    where.push(`EXISTS (SELECT 1 FROM closure_reviews cr WHERE cr.deal_id = d.id AND cr.status = 'requested')`);
  }
  if (q.from) where.push(`COALESCE(d.closed_at, d.created_at) >= ${params.add(q.from)}::date`);
  if (q.to) where.push(`COALESCE(d.closed_at, d.created_at) < (${params.add(q.to)}::date + 1)`);
  if (q.q) {
    // FX-BE-C5. The business-name half only matches rows that also pass scopeFilter below (same WHERE).
    const like = params.add('%' + q.q.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
    where.push(`(d.code ILIKE ${like} ESCAPE '\\' OR EXISTS (SELECT 1 FROM businesses b WHERE b.id = d.business_id AND b.name ILIKE ${like} ESCAPE '\\'))`);
  }
  if (q.projectStatus === 'none') where.push(`NOT EXISTS (SELECT 1 FROM projects pj WHERE pj.deal_id = d.id)`);
  else if (q.projectStatus) where.push(`EXISTS (SELECT 1 FROM projects pj WHERE pj.deal_id = d.id AND pj.status = ${params.add(q.projectStatus)})`);
  where.push(developerConfinement(p, params, policy));
  where.push(access.scopeFilter(p, 'deal.read', 'deal', { alias: 'd', params }));
  const { rows, total } = await repo.listDeals(
    db,
    where,
    params,
    orderByClause(q, DEAL_SORT, 'createdAt'),
    pageClause(q, params)
  );
  const [names, biz, info] = await inSequence([
    () => employeeNames(db, rows.map((r) => r.assigned_developer_id)),
    () => businessNames(db, rows.map((r) => r.business_id)),
    () => projectInfo(db, rows.map((r) => r.id)),
  ]);
  const items = rows.map<DealListItemDto>((r) => ({
    id: r.id,
    code: r.code,
    version: r.version,
    businessId: r.business_id,
    businessName: biz.get(r.business_id) ?? null,
    stage: r.stage,
    acceptedById: r.accepted_by_id,
    assignedDeveloperId: r.assigned_developer_id,
    assignedDeveloperName: r.assigned_developer_id ? names.get(r.assigned_developer_id) ?? null : null,
    signatureDate: r.signature_date,
    paymentDate: r.payment_date,
    closedAt: iso(r.closed_at),
    projectId: info.get(r.id)?.projectId ?? null,
    developerNotAssigned: r.assigned_developer_id === null,
    closureVerificationRequested: r.open_review,
    projectStatus: info.get(r.id)?.projectStatus ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  }));
  return toPage(items, total, q);
}

/** GET /api/deals/:id after `access.check` passed in the route. Applies the Developer confinement. */
export async function getDealForReader(db: Queryable, p: Principal, id: string): Promise<DealDto> {
  const d = await repo.findById(db, id);
  if (!d) throw notFound();
  if (!developerMayReadDeal(p, { assignedDeveloperId: d.assigned_developer_id, stage: d.stage })) throw permissionDenied();
  return toDealDto(db, p, d);
}

export async function dealHistory(db: Queryable, id: string) {
  const rows = await repo.listChanges(db, id);
  return rows.map((r) => ({
    id: r.id,
    type: r.change_type,
    before: r.before_value,
    after: r.after_value,
    reason: r.reason,
    actorId: r.actor_id,
    at: iso(r.created_at)!,
  }));
}

// ---------------------------------------------------------------------------
// Command helpers
// ---------------------------------------------------------------------------
async function lockAndAuthorize(ctx: CommandContext, id: string, action: string): Promise<DealRow> {
  const d = await repo.findById(ctx.tx, id, true);
  if (!d) throw notFound();
  await authorize(ctx, action, { type: 'deal', id });
  return d;
}

/** BL-09: a stale version answers 409 with `details.current` = the deal as this caller may see it. */
async function assertVersion(ctx: CommandContext, d: DealRow, version: number): Promise<void> {
  if (d.version !== version) throw versionConflict(d.version, await result(ctx, d));
}

/** Owner, or the assigned Developer under DEC-005 `assigned`. Anyone else: 403 PERMISSION_DENIED. */
function assertOwnerOrAssignedDeveloper(ctx: CommandContext, d: DealRow): void {
  const p = principalOf(ctx);
  if (p.role === 'owner') return;
  if (developerMayActOnDeal(p, { assignedDeveloperId: d.assigned_developer_id })) return;
  throw permissionDenied();
}

async function save(ctx: CommandContext, d: DealRow, set: Partial<Record<repo.DealColumn, unknown>>): Promise<DealRow> {
  const next = await repo.updateDeal(ctx.tx, d.id, d.version, set, ctx.now);
  if (!next) {
    const cur = await repo.findById(ctx.tx, d.id);
    if (!cur) throw notFound();
    throw versionConflict(cur.version, await result(ctx, cur));
  }
  return next;
}

const factsOf = (d: DealRow) => ({
  stage: d.stage,
  signatureDate: d.signature_date,
  signatureReference: d.signature_reference,
  paymentDate: d.payment_date,
  paymentReference: d.payment_reference,
  paymentAmount: d.payment_amount,
  paymentCurrency: d.payment_currency,
});

async function result(ctx: CommandContext, d: DealRow): Promise<DealDto> {
  return toDealDto(ctx.tx, principalOf(ctx), d);
}

// ---------------------------------------------------------------------------
// E5: Accepted opportunity (called by MOD-calls inside the attempt transaction)
// ---------------------------------------------------------------------------
/**
 * Exactly one deal per accepted attempt: a replayed call save returns the existing deal (`created: false`).
 * DEC-017: a business with another open deal → 409 CONFLICT_DUPLICATE (the caller's transaction rolls back).
 * Counted once by audit `accepted_opportunity.created`. Outbox E-08 when a Developer was given.
 */
export async function createAcceptedOpportunity(
  ctx: CommandContext,
  input: CreateAcceptedOpportunityInput
): Promise<{ dealId: string; created: boolean; developerAssigned: boolean }> {
  const existing = await repo.findByAttempt(ctx.tx, input.callAttemptId);
  if (existing) return { dealId: existing.id, created: false, developerAssigned: existing.assigned_developer_id !== null };
  if (await repo.findOpenForBusiness(ctx.tx, input.businessId)) {
    throw new HttpError(409, 'CONFLICT_DUPLICATE', 'This business already has an open deal');
  }
  if (input.developerId) await assertActiveEmployee(ctx.tx, input.developerId, 'developerId', 'developer');
  const d = await repo.insertDeal(ctx.tx, {
    businessId: input.businessId,
    attemptId: input.callAttemptId,
    acceptedById: input.acceptingAgentId,
    clientNeedsNote: input.clientNeedsNote,
    developerId: input.developerId ?? null,
  });
  if (!d) {
    // Lost a race on the same attempt id: the other transaction's row is the deal.
    const again = await repo.findByAttempt(ctx.tx, input.callAttemptId);
    if (!again) throw stateConflict('The opportunity could not be created');
    return { dealId: again.id, created: false, developerAssigned: again.assigned_developer_id !== null };
  }
  if (input.developerId) await repo.insertAssignment(ctx.tx, d.id, input.developerId, input.acceptingAgentId, ctx.now);
  await audit(ctx, {
    eventName: 'accepted_opportunity.created',
    entityType: 'deal',
    entityId: d.id,
    after: { stage: d.stage, businessId: d.business_id, callAttemptId: input.callAttemptId, assignedDeveloperId: d.assigned_developer_id },
  });
  if (input.developerId) {
    await outbox.emit(ctx.tx, {
      name: 'opportunity.developer_assigned',
      aggregateType: 'deal',
      aggregateId: d.id,
      payload: { dealId: d.id, developerId: input.developerId, previousDeveloperId: null },
    });
  }
  return { dealId: d.id, created: true, developerAssigned: Boolean(input.developerId) };
}

/** BE3 read op (CC-007): opportunities visible to the caller (scopeFilter), newest first. */
export async function listOpportunities(
  db: Queryable,
  p: Principal,
  q: { page: number; pageSize: number; stage?: DealStage; mine?: boolean; developerAssigned?: boolean; openOnly?: boolean }
): Promise<PageResult<OpportunityDto>> {
  const params = new SqlParams();
  const where: string[] = [];
  if (q.stage) where.push(`d.stage = ${params.add(q.stage)}`);
  if (q.openOnly) where.push(`d.stage NOT IN ('closed','not_proceeding')`);
  if (q.mine) where.push(`d.accepted_by_id = ${params.add(p.employeeId)}::uuid`);
  if (q.developerAssigned === true) where.push('d.assigned_developer_id IS NOT NULL');
  if (q.developerAssigned === false) where.push('d.assigned_developer_id IS NULL');
  where.push(developerConfinement(p, params, deliveryPolicy()));
  where.push(access.scopeFilter(p, 'deal.read', 'deal', { alias: 'd', params }));
  const { rows, total } = await repo.listDeals(db, where, params, 'ORDER BY d.created_at DESC', pageClause(q, params));
  const [names, biz] = await inSequence([
    () => employeeNames(db, rows.map((r) => r.assigned_developer_id)),
    () => businessNames(db, rows.map((r) => r.business_id)),
  ]);
  return toPage(
    rows.map<OpportunityDto>((r) => ({
      dealId: r.id,
      code: r.code,
      businessId: r.business_id,
      businessName: biz.get(r.business_id) ?? null,
      stage: r.stage,
      acceptedById: r.accepted_by_id,
      acceptedAt: iso(r.created_at)!,
      assignedDeveloperId: r.assigned_developer_id,
      assignedDeveloperName: r.assigned_developer_id ? names.get(r.assigned_developer_id) ?? null : null,
      developerNotAssigned: r.assigned_developer_id === null,
      notProceedingReason: r.stage === 'not_proceeding' ? r.not_proceeding_reason : null,
      updatedAt: iso(r.updated_at)!,
    })),
    total,
    q
  );
}

/** BE3 read op (B3-Q12 re-queue): latest Not proceeding deal of a business with no newer open deal. */
export async function findNotProceedingDeal(db: Queryable, businessId: string): Promise<NotProceedingDealDto | null> {
  const d = await repo.latestNotProceeding(db, businessId);
  if (!d || !d.not_proceeding_reason || !d.not_proceeding_at) return null;
  return { dealId: d.id, businessId: d.business_id, reason: d.not_proceeding_reason, at: iso(d.not_proceeding_at)!, byId: d.not_proceeding_by_id ?? '' };
}

/**
 * MOD-projects read op ("Closed deal without project"): closed deals the viewer may read
 * (scopeFilter + Developer confinement), newest first. Projects filters out the ones with a project.
 */
export async function listClosedDealSummaries(db: Queryable, p: Principal, limit: number): Promise<DealSummary[]> {
  const params = new SqlParams();
  const where = [`d.stage = 'closed'`, developerConfinement(p, params, deliveryPolicy())];
  where.push(access.scopeFilter(p, 'deal.read', 'deal', { alias: 'd', params }));
  const { rows } = await repo.listDeals(db, where, params, 'ORDER BY d.closed_at DESC NULLS LAST', `LIMIT ${params.add(limit)}`);
  return rows.map(summary);
}

/** BE1 open-items op (employee deactivation): open deals where the employee is the assigned Developer. */
export async function openItemsFor(db: Queryable, employeeId: string): Promise<{ deals: number }> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM deals WHERE assigned_developer_id = $1 AND stage NOT IN ('closed','not_proceeding')`,
    [employeeId]
  );
  return { deals: Number(rows[0].n) };
}

/** Batched `openItemsFor` (BE-LEAD V-02): open deals assigned to each developer, one query. */
export async function openItemsForMany(db: Queryable, employeeIds: string[]): Promise<Map<string, { deals: number }>> {
  const out = new Map(employeeIds.map((id) => [id, { deals: 0 }]));
  if (employeeIds.length === 0) return out;
  const { rows } = await db.query<{ id: string; n: string }>(
    `SELECT assigned_developer_id AS id, COUNT(*)::text AS n FROM deals
     WHERE assigned_developer_id = ANY($1::uuid[]) AND stage NOT IN ('closed','not_proceeding')
     GROUP BY assigned_developer_id`,
    [employeeIds]
  );
  for (const r of rows) if (out.has(r.id)) out.set(r.id, { deals: Number(r.n) });
  return out;
}

/** BE3/BE1 read op: the open deal of a business (DEC-017), if any. */
export async function findOpenDeal(db: Queryable, businessId: string): Promise<{ dealId: string; stage: DealStage } | null> {
  const d = await repo.findOpenForBusiness(db, businessId);
  return d ? { dealId: d.id, stage: d.stage } : null;
}

// ---------------------------------------------------------------------------
// Commands (POST /api/deals/:id/<verb>)
// ---------------------------------------------------------------------------
export async function assignDeveloper(ctx: CommandContext, id: string, body: { version: number; developerId: string }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.assign_developer');
  const role = roleOf(ctx);
  if (role !== 'owner' && role !== 'call_center') throw permissionDenied();
  if (!isOpen(d.stage)) throw stateConflict('A Developer can be assigned only before closure');
  if (d.assigned_developer_id === body.developerId) return result(ctx, d);
  await assertVersion(ctx, d, body.version);
  await assertActiveEmployee(ctx.tx, body.developerId, 'developerId', 'developer');
  const previous = d.assigned_developer_id;
  await repo.closeCurrentAssignment(ctx.tx, d.id, ctx.now);
  await repo.insertAssignment(ctx.tx, d.id, body.developerId, actorIdOf(ctx)!, ctx.now);
  const next = await save(ctx, d, { assigned_developer_id: body.developerId });
  await repo.insertChange(ctx.tx, {
    dealId: d.id,
    type: 'handoff_updated',
    before: { assignedDeveloperId: previous },
    after: { assignedDeveloperId: body.developerId },
    actorId: actorIdOf(ctx),
    now: ctx.now,
  });
  await audit(ctx, {
    eventName: previous ? 'deal.developer_reassigned' : 'deal.developer_assigned',
    entityType: 'deal',
    entityId: d.id,
    before: { assignedDeveloperId: previous },
    after: { assignedDeveloperId: body.developerId },
  });
  await outbox.emit(ctx.tx, {
    name: previous ? 'opportunity.developer_reassigned' : 'opportunity.developer_assigned',
    aggregateType: 'deal',
    aggregateId: d.id,
    payload: { dealId: d.id, developerId: body.developerId, previousDeveloperId: previous },
  });
  return result(ctx, next);
}

export async function recordSignature(ctx: CommandContext, id: string, body: { version: number; date: string; reference: string }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.record_signature');
  assertOwnerOrAssignedDeveloper(ctx, d);
  if (d.signature_date) {
    if (d.signature_date === body.date && d.signature_reference === body.reference) return result(ctx, d);
    throw stateConflict('A signature is already recorded; the Owner can remove it first');
  }
  if (d.stage !== 'accepted_opportunity' && d.stage !== 'paid') throw stateConflict();
  await assertVersion(ctx, d, body.version);
  const stage: DealStage = d.stage === 'paid' ? 'signed_and_paid' : 'signed';
  const next = await save(ctx, d, {
    stage,
    signature_date: body.date,
    signature_reference: body.reference,
    signature_recorded_by_id: actorIdOf(ctx),
    signature_recorded_at: ctx.now,
  });
  await repo.insertChange(ctx.tx, { dealId: d.id, type: 'signature_recorded', before: factsOf(d), after: factsOf(next), actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, { eventName: 'deal.signature_recorded', entityType: 'deal', entityId: d.id, before: factsOf(d), after: factsOf(next) });
  return result(ctx, next);
}

export async function recordPayment(
  ctx: CommandContext,
  id: string,
  body: { version: number; date: string; reference: string; amount?: number; currency?: string }
): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.record_payment');
  assertOwnerOrAssignedDeveloper(ctx, d);
  const amount = body.amount === undefined ? null : body.amount.toFixed(2);
  if (d.payment_date) {
    const same =
      d.payment_date === body.date &&
      d.payment_reference === body.reference &&
      (d.payment_amount === null ? amount === null : Number(d.payment_amount).toFixed(2) === amount) &&
      (d.payment_currency ?? null) === (body.currency ?? null);
    if (same) return result(ctx, d);
    throw stateConflict('A payment is already recorded; the Owner can remove it first');
  }
  if (d.stage !== 'accepted_opportunity' && d.stage !== 'signed') throw stateConflict();
  await assertVersion(ctx, d, body.version);
  if (body.currency !== undefined) {
    // DEC-018 (SET, NEEDS VALUE): an amount needs a configured currency list.
    const currencies = await dealCurrencies(ctx.tx);
    if (currencies.length === 0) throw policyNotConfigured('deals.currencies');
    if (!currencies.includes(body.currency)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { currency: ['Currency is not in the configured list'] });
    }
  }
  const stage: DealStage = d.stage === 'signed' ? 'signed_and_paid' : 'paid';
  const next = await save(ctx, d, {
    stage,
    payment_date: body.date,
    payment_reference: body.reference,
    payment_amount: amount,
    payment_currency: body.currency ?? null,
    payment_recorded_by_id: actorIdOf(ctx),
    payment_recorded_at: ctx.now,
  });
  await repo.insertChange(ctx.tx, { dealId: d.id, type: 'payment_recorded', before: factsOf(d), after: factsOf(next), actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, { eventName: 'deal.payment_recorded', entityType: 'deal', entityId: d.id, before: factsOf(d), after: factsOf(next) });
  return result(ctx, next);
}

/** Owner removes a fact entered in error (SM-COMMERCIAL-001 "Recorded fact removed"); stage reverts. */
export async function removeFact(ctx: CommandContext, id: string, body: { version: number; fact: 'signature' | 'payment'; reason: string }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.update_stage');
  requireOwner(ctx);
  if (!isOpen(d.stage)) throw stateConflict('Facts can be removed only before closure');
  const present = body.fact === 'signature' ? d.signature_date : d.payment_date;
  if (!present) return result(ctx, d); // already removed: no-op
  await assertVersion(ctx, d, body.version);
  let stage: DealStage;
  if (body.fact === 'signature') stage = d.stage === 'signed_and_paid' ? 'paid' : 'accepted_opportunity';
  else stage = d.stage === 'signed_and_paid' ? 'signed' : 'accepted_opportunity';
  const set: Partial<Record<repo.DealColumn, unknown>> =
    body.fact === 'signature'
      ? { stage, signature_date: null, signature_reference: null, signature_recorded_by_id: null, signature_recorded_at: null }
      : { stage, payment_date: null, payment_reference: null, payment_amount: null, payment_currency: null, payment_recorded_by_id: null, payment_recorded_at: null };
  const review = await repo.openReview(ctx.tx, d.id);
  if (review) await repo.decideReview(ctx.tx, review.id, 'rejected', actorIdOf(ctx)!, `Recorded ${body.fact} removed: ${body.reason}`, ctx.now);
  const next = await save(ctx, d, set);
  await repo.insertChange(ctx.tx, { dealId: d.id, type: 'fact_removed', before: factsOf(d), after: factsOf(next), reason: body.reason, actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, { eventName: 'deal.fact_removed', entityType: 'deal', entityId: d.id, before: factsOf(d), after: factsOf(next), reason: body.reason, payload: { fact: body.fact } });
  return result(ctx, next);
}

/** DEC-006 Alt B: the assigned Developer asks the Owner to verify (ownerVerify mode only). */
export async function requestClosureVerification(ctx: CommandContext, id: string, body: { version: number; note?: string }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.request_closure_verification');
  const policy = deliveryPolicy();
  if (policy.closureMode !== 'ownerVerify') throw stateConflict('Closure verification is not used in this closure mode');
  if (!developerMayActOnDeal(principalOf(ctx), { assignedDeveloperId: d.assigned_developer_id }, policy)) throw permissionDenied();
  if (d.stage !== 'signed_and_paid') throw stateConflict('Signature and payment must both be recorded first');
  if (await repo.openReview(ctx.tx, d.id)) return result(ctx, d); // one open request: repeat is a no-op
  await assertVersion(ctx, d, body.version);
  const review = await repo.insertReview(ctx.tx, d.id, actorIdOf(ctx)!, body.note ?? null, ctx.now);
  const next = await save(ctx, d, {}); // version bump: the deal's closure state changed
  await audit(ctx, { eventName: 'deal.closure_requested', entityType: 'deal', entityId: d.id, payload: { reviewId: review.id } });
  await outbox.emit(ctx.tx, { name: 'deal.closure_requested', aggregateType: 'deal', aggregateId: d.id, payload: { dealId: d.id, reviewId: review.id } });
  return result(ctx, next);
}

async function closeDeal(ctx: CommandContext, d: DealRow, mode: 'ownerVerify' | 'direct', reviewId: string | null): Promise<DealRow> {
  const next = await save(ctx, d, { stage: 'closed', closed_at: ctx.now, closed_by_id: actorIdOf(ctx), closure_mode: mode });
  await repo.insertChange(ctx.tx, { dealId: d.id, type: 'closed', before: factsOf(d), after: { ...factsOf(next), closureMode: mode }, actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, {
    eventName: 'deal.closed',
    entityType: 'deal',
    entityId: d.id,
    before: { stage: d.stage },
    after: { stage: 'closed', closureMode: mode },
    payload: { reviewId },
  });
  // E-14: MOD-projects provisions the project in its own transaction (F2/F3); closure is committed first.
  await outbox.emit(ctx.tx, { name: 'deal.closed', aggregateType: 'deal', aggregateId: d.id, payload: { dealId: d.id, businessId: d.business_id } });
  return next;
}

/** DEC-006 Alt B: the Owner verifies the open request AND finalizes in one transaction. */
export async function verifyClosure(ctx: CommandContext, id: string, body: { version: number }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.verify_closure');
  requireOwner(ctx);
  if (deliveryPolicy().closureMode !== 'ownerVerify') throw stateConflict('Closure verification is not used in this closure mode');
  if (d.stage === 'closed') return result(ctx, d);
  if (d.stage !== 'signed_and_paid') throw stateConflict('Signature and payment must both be recorded first');
  const review = await repo.openReview(ctx.tx, d.id);
  if (!review) throw stateConflict('No closure verification is requested; use Finalize');
  await assertVersion(ctx, d, body.version);
  await repo.decideReview(ctx.tx, review.id, 'verified', actorIdOf(ctx)!, null, ctx.now);
  return result(ctx, await closeDeal(ctx, d, 'ownerVerify', review.id));
}

export async function rejectClosure(ctx: CommandContext, id: string, body: { version: number; reason: string }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.reject_closure');
  requireOwner(ctx);
  if (deliveryPolicy().closureMode !== 'ownerVerify') throw stateConflict('Closure verification is not used in this closure mode');
  if (d.stage !== 'signed_and_paid') throw stateConflict();
  const review = await repo.openReview(ctx.tx, d.id);
  if (!review) {
    const latest = await repo.latestReview(ctx.tx, d.id);
    if (latest?.status === 'rejected') return result(ctx, d); // already rejected: no-op
    throw stateConflict('No closure verification is requested');
  }
  await assertVersion(ctx, d, body.version);
  await repo.decideReview(ctx.tx, review.id, 'rejected', actorIdOf(ctx)!, body.reason, ctx.now);
  const next = await save(ctx, d, {});
  await audit(ctx, { eventName: 'deal.closure_rejected', entityType: 'deal', entityId: d.id, reason: body.reason, payload: { reviewId: review.id } });
  // ORCH-2 (3): the Developer gets the "rejected" item (BE5 consumer). Ids only; the reason is re-read.
  await outbox.emit(ctx.tx, { name: 'deal.closure_rejected', aggregateType: 'deal', aggregateId: d.id, payload: { dealId: d.id, reviewId: review.id } });
  return result(ctx, next);
}

/**
 * Finalize (SEQ-14). Owner in both modes ("Owner may finalize directly"). The assigned Developer only
 * when `deals.closureMode = direct` (DEC-006 Alt A) and DEC-005 = assigned; otherwise 403.
 */
export async function finalize(ctx: CommandContext, id: string, body: { version: number }): Promise<DealDto> {
  const role = roleOf(ctx);
  const d = await lockAndAuthorize(ctx, id, role === 'owner' ? 'deal.finalize' : 'deal.update_stage');
  const policy = deliveryPolicy();
  if (role !== 'owner') {
    if (policy.closureMode !== 'direct') throw permissionDenied();
    if (!developerMayActOnDeal(principalOf(ctx), { assignedDeveloperId: d.assigned_developer_id }, policy)) throw permissionDenied();
  }
  if (d.stage === 'closed') return result(ctx, d);
  if (d.stage !== 'signed_and_paid') {
    const missing = [!d.signature_date ? 'signature' : null, !d.payment_date ? 'payment' : null].filter(Boolean);
    throw stateConflict('Signature and payment must both be recorded first', { missing });
  }
  await assertVersion(ctx, d, body.version);
  const review = await repo.openReview(ctx.tx, d.id);
  if (review) await repo.decideReview(ctx.tx, review.id, 'verified', actorIdOf(ctx)!, null, ctx.now);
  return result(ctx, await closeDeal(ctx, d, policy.closureMode, review?.id ?? null));
}

export async function markNotProceeding(ctx: CommandContext, id: string, body: { version: number; reason: string }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.mark_not_proceeding');
  assertOwnerOrAssignedDeveloper(ctx, d);
  if (d.stage === 'not_proceeding') return result(ctx, d);
  if (d.stage === 'closed') throw stateConflict('A closed deal cannot be marked Not proceeding');
  await assertVersion(ctx, d, body.version);
  const review = await repo.openReview(ctx.tx, d.id);
  if (review) await repo.decideReview(ctx.tx, review.id, 'rejected', actorIdOf(ctx)!, `Deal not proceeding: ${body.reason}`, ctx.now);
  const next = await save(ctx, d, {
    stage: 'not_proceeding',
    not_proceeding_reason: body.reason,
    not_proceeding_at: ctx.now,
    not_proceeding_by_id: actorIdOf(ctx),
  });
  await repo.insertChange(ctx.tx, { dealId: d.id, type: 'not_proceeding', before: factsOf(d), after: factsOf(next), reason: body.reason, actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, { eventName: 'deal.marked_not_proceeding', entityType: 'deal', entityId: d.id, before: { stage: d.stage }, after: { stage: 'not_proceeding' }, reason: body.reason });
  // ORCH-2 (3): MOD-meetings cancels the deal's Scheduled meetings in its own transaction (delivery-design §6).
  await outbox.emit(ctx.tx, {
    name: 'deal.not_proceeding',
    aggregateType: 'deal',
    aggregateId: d.id,
    payload: { dealId: d.id, businessId: d.business_id, actorId: actorIdOf(ctx) },
  });
  return result(ctx, next);
}

/**
 * OQ-15 (flag, demonstration default `accepted_opportunity`): Owner reopens a Not proceeding deal.
 * `accepted_opportunity`: facts are cleared (old values kept in deal_changes); `previous_stage`: the stage
 * is recomputed from the facts still recorded. Closed deals never reopen. DEC-017 still applies.
 */
export async function reopenNotProceeding(ctx: CommandContext, id: string, body: { version: number; reason: string }): Promise<DealDto> {
  const d = await lockAndAuthorize(ctx, id, 'deal.reopen_not_proceeding');
  requireOwner(ctx);
  if (d.stage === 'closed') throw stateConflict('Closed deals never reopen; start a new deal');
  if (d.stage !== 'not_proceeding') return result(ctx, d); // already open: no-op
  await assertVersion(ctx, d, body.version);
  if (await repo.findOpenForBusiness(ctx.tx, d.business_id, d.id)) {
    throw new HttpError(409, 'CONFLICT_DUPLICATE', 'This business already has an open deal');
  }
  const target = deliveryPolicy().reopenTarget;
  const set: Partial<Record<repo.DealColumn, unknown>> = { not_proceeding_reason: null, not_proceeding_at: null, not_proceeding_by_id: null };
  if (target === 'accepted_opportunity') {
    Object.assign(set, {
      stage: 'accepted_opportunity',
      signature_date: null,
      signature_reference: null,
      signature_recorded_by_id: null,
      signature_recorded_at: null,
      payment_date: null,
      payment_reference: null,
      payment_amount: null,
      payment_currency: null,
      payment_recorded_by_id: null,
      payment_recorded_at: null,
    });
  } else {
    set.stage = d.signature_date && d.payment_date ? 'signed_and_paid' : d.signature_date ? 'signed' : d.payment_date ? 'paid' : 'accepted_opportunity';
  }
  const before = { ...factsOf(d), notProceedingReason: d.not_proceeding_reason, notProceedingAt: iso(d.not_proceeding_at) };
  const next = await save(ctx, d, set);
  await repo.insertChange(ctx.tx, { dealId: d.id, type: 'reopened', before, after: { ...factsOf(next), reopenTarget: target }, reason: body.reason, actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, { eventName: 'deal.reopened', entityType: 'deal', entityId: d.id, before, after: factsOf(next), reason: body.reason, payload: { reopenTarget: target } });
  return result(ctx, next);
}
