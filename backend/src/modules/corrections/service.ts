/**
 * MOD-corrections — service (SM-DATAFIX-001; Demonstration alternative — not approved, OI-19 / N-4). Owner: BE2.
 *
 *   submitted → in_review (start-review: first wins) → resolved | closed | rejected
 *   in_review → submitted (release by the reviewer or the Owner; reviewer deactivated, N-4)
 *   submitted | in_review → withdrawn (requester, AC-DFIX-006)
 * Terminal states never reopen (AC-DFIX-007). Repeating a command already in its target state is a no-op.
 *
 * Access: the Owner sees everything. Data Entry works the queue for businesses it can read (row 6 keeps the
 * open ones readable); rows it cannot read are omitted and not counted (OI-07). Call Center and Developer
 * see their own requests; when the business is no longer readable the row is redacted (OI-09).
 */
import type { Queryable } from '../../db/pool.js';
import { access, type AccessDecision, type Principal } from '../../shared/access.js';
import { HttpError, hiddenByPolicy, notFound, permissionDenied, stateConflict, versionConflict } from '../../shared/errors.js';
import { outbox, type DeliveredEvent } from '../../shared/outbox.js';
import { orderByClause } from '../../shared/pagination.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { refreshAccessSettings } from '../access/schemas.js';
import {
  businessIdsMatchingName,
  businessLabels,
  checkBusiness,
  updateBusiness,
  type CorrectionApplyHandle,
  type CorrectionsBridge,
  type OpenCorrections,
} from '../businesses/service.js';
import type { BusinessCorrectionSummary } from '../businesses/schemas.js';
import * as repo from './repo.js';
import {
  OPEN_STATUSES,
  type CorrectionDetail,
  type CorrectionListQuery,
  type CorrectionPage,
  type CorrectionRow,
  type CorrectionStatus,
  type ResolveInput,
  type SubmitCorrectionInput,
} from './schemas.js';

const TERMINAL: readonly CorrectionStatus[] = ['resolved', 'closed', 'rejected', 'withdrawn'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

function actorId(ctx: CommandContext): string {
  if (ctx.actor.kind !== 'employee') throw new Error('Correction commands need an employee actor');
  return ctx.actor.employeeId;
}

function deny(d: AccessDecision): never {
  if (d.allowed) throw new Error('deny() on an allowed decision');
  if (d.reason === 'not_found') throw notFound();
  if (d.reason === 'hidden_by_policy') throw hiddenByPolicy();
  throw permissionDenied();
}

// ---------------------------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------------------------

type Labels = Awaited<ReturnType<typeof businessLabels>>;

function toRow(r: repo.CorrectionDbRow, viewer: Principal, labels: Labels, redacted: boolean): CorrectionRow {
  const b = redacted ? undefined : labels.get(r.business_id);
  return {
    id: r.id,
    businessId: redacted ? null : r.business_id,
    businessName: b?.name ?? null,
    businessMeta: b ? [b.category, b.branch].filter(Boolean).join(' · ') : null,
    redacted,
    issueType: r.issue_type,
    issueDetail: r.description,
    requestedBy: r.requested_by_name ?? '',
    requestedById: r.requested_by,
    requestedByRole: r.requested_by_role ?? '',
    createdAt: iso(r.created_at) as string,
    status: r.status,
    reviewer: r.reviewer_name,
    reviewerId: r.reviewer_id,
    outcomeNote: r.resolution_note,
    resolvedBy: r.resolved_by_name,
    resolvedAt: iso(r.resolved_at),
    mine: r.requested_by === viewer.employeeId,
    version: r.version,
  };
}

function toDetail(r: repo.CorrectionDbRow, viewer: Principal, labels: Labels, redacted: boolean): CorrectionDetail {
  return {
    ...toRow(r, viewer, labels, redacted),
    field: r.field,
    currentValue: null,
    suggestedValue: r.suggested_value,
    explanation: r.description,
    takenAt: iso(r.review_started_at),
    resolutionNote: r.resolution_note,
  };
}

/** Requester rows on a business the requester can no longer read are redacted (OI-09). */
async function redactionFor(db: Queryable, viewer: Principal, rows: repo.CorrectionDbRow[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (viewer.role === 'owner' || rows.length === 0) return out;
  const ids = [...new Set(rows.map((r) => r.business_id))];
  const decisions = await access.checkMany(db, viewer, 'business.read', ids.map((id) => ({ type: 'business' as const, id })));
  const labels = await businessLabels(db, ids);
  for (const id of ids) {
    const d = decisions.get(id);
    if (!d?.allowed || labels.get(id)?.archived) out.add(id);
  }
  return out;
}

async function detailFor(db: Queryable, viewer: Principal, id: string): Promise<CorrectionDetail> {
  const r = await repo.findCorrection(db, id);
  if (!r) throw notFound();
  const redacted = (await redactionFor(db, viewer, [r])).has(r.business_id);
  const labels = await businessLabels(db, redacted ? [] : [r.business_id]);
  return toDetail(r, viewer, labels, redacted);
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/** Read access to one request. Owner: all. DE: the business check (row 6 included). CC/DV: own only. */
async function assertCanRead(db: Queryable, viewer: Principal, r: repo.CorrectionDbRow): Promise<void> {
  if (viewer.role === 'owner') return;
  if (viewer.role === 'data_entry') {
    const d = await checkBusiness(db, viewer, 'correction.read', r.business_id);
    if (!d.allowed) deny(d);
    return;
  }
  if (r.requested_by !== viewer.employeeId) throw permissionDenied();
}

export async function getCorrection(db: Queryable, viewer: Principal, id: string): Promise<CorrectionDetail> {
  const r = await repo.findCorrection(db, id);
  if (!r) throw notFound();
  await assertCanRead(db, viewer, r);
  return detailFor(db, viewer, id);
}

const SORT: Record<string, string> = { createdAt: 'r.created_at', updatedAt: 'r.updated_at', status: 'r.status' };

export async function listCorrections(db: Queryable, viewer: Principal, q: CorrectionListQuery, now: Date): Promise<CorrectionPage> {
  await refreshAccessSettings(db);
  const p = new SqlParams();
  const base: string[] = [];
  if (viewer.role === 'data_entry') {
    base.push(access.scopeFilter(viewer, 'correction.read', 'business', { alias: 'r', params: p, idColumn: 'business_id' }));
    base.push('EXISTS (SELECT 1 FROM access_facts afa WHERE afa.business_id = r.business_id AND afa.archived_at IS NULL)');
  } else if (viewer.role !== 'owner') {
    base.push(access.scopeFilter(viewer, 'correction.read', 'data_correction_request', { alias: 'r', params: p }));
  }
  if (q.businessId) base.push(`r.business_id = ${p.add(q.businessId)}::uuid`);
  if (q.requestedBy) {
    base.push(UUID.test(q.requestedBy) ? `r.requested_by = ${p.add(q.requestedBy)}::uuid` : `lower(rq.full_name) = lower(${p.add(q.requestedBy)})`);
  }
  if (q.q) {
    const ids = await businessIdsMatchingName(db, q.q);
    base.push(`(r.business_id = ANY(${p.add(ids)}::uuid[]) OR rq.full_name ILIKE ${p.add(`%${q.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)})`);
  }
  if (q.age) {
    const day = 86_400_000;
    const n = now.getTime();
    if (q.age === 'lt1d') base.push(`r.created_at > ${p.add(new Date(n - day).toISOString())}::timestamptz`);
    if (q.age === 'd1to3') {
      base.push(`r.created_at <= ${p.add(new Date(n - day).toISOString())}::timestamptz`);
      base.push(`r.created_at > ${p.add(new Date(n - 3 * day).toISOString())}::timestamptz`);
    }
    if (q.age === 'gt3d') base.push(`r.created_at <= ${p.add(new Date(n - 3 * day).toISOString())}::timestamptz`);
  }
  const tab: string[] = [];
  if (q.tab === 'open') tab.push(`r.status IN ('submitted', 'in_review')`);
  if (q.tab === 'resolved') tab.push(`r.status = 'resolved'`);
  if (q.tab === 'closed') tab.push(`r.status IN ('closed', 'rejected')`);
  if (q.tab === 'withdrawn') tab.push(`r.status = 'withdrawn'`);
  if (q.status) tab.push(`r.status = ${p.add(q.status)}`);
  const orderBy = `${orderByClause(q, SORT, 'createdAt')}, r.id DESC`;
  const res = await repo.listCorrections(db, { base, tab, params: p, orderBy, page: q.page, pageSize: q.pageSize });
  const redacted = await redactionFor(db, viewer, res.rows);
  const labels = await businessLabels(db, [...new Set(res.rows.map((r) => r.business_id))].filter((id) => !redacted.has(id)));
  return {
    items: res.rows.map((r) => toRow(r, viewer, labels, redacted.has(r.business_id))),
    page: q.page,
    pageSize: q.pageSize,
    total: res.total,
    tabCounts: res.tabCounts,
    requesters: res.requesters,
  };
}

/** Business ids with >= 1 open request (cross-module list filter, arch-a §5A RX-13). */
export async function openRequestBusinessIds(db: Queryable): Promise<string[]> {
  return repo.openBusinessIds(db);
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

async function audited(ctx: CommandContext, eventName: string, r: repo.CorrectionDbRow, extra: { reason?: string | null; payload?: Record<string, unknown> } = {}) {
  await audit(ctx, {
    eventName,
    entityType: 'data_correction_request',
    entityId: r.id,
    payload: { businessId: r.business_id, ...(extra.payload ?? {}) },
    reason: extra.reason ?? null,
  });
}

export async function submitCorrection(ctx: CommandContext, principal: Principal, input: SubmitCorrectionInput): Promise<CorrectionDetail> {
  const d = await checkBusiness(ctx.tx, principal, 'correction.submit', input.businessId);
  if (!d.allowed) deny(d);
  const id = await repo.insertCorrection(ctx.tx, {
    businessId: input.businessId,
    requestedBy: actorId(ctx),
    issueType: input.issueType,
    field: input.field ?? null,
    description: input.description,
    suggestedValue: input.suggestedValue ?? null,
  });
  const r = (await repo.findCorrection(ctx.tx, id)) as repo.CorrectionDbRow;
  await audited(ctx, 'data_correction_request.submitted', r, { payload: { issueType: r.issue_type } });
  // E-09: Data Entry queue + Owner are notified by BE5's consumer (OI-20 recipients). Ids only.
  await outbox.emit(ctx.tx, { name: 'data_correction_request.submitted', aggregateType: 'data_correction_request', aggregateId: id, payload: { businessId: r.business_id } });
  return detailFor(ctx.tx, principal, id);
}

/** Lock the request and run the reviewer access check on its business (row 6 for Data Entry). */
async function lockForReviewer(ctx: CommandContext, principal: Principal, id: string, action: 'correction.review' | 'correction.apply' | 'correction.reject' | 'correction.close') {
  const r = await repo.findCorrection(ctx.tx, id, true);
  if (!r) throw notFound();
  if (principal.role !== 'owner') {
    const d = await checkBusiness(ctx.tx, principal, action, r.business_id);
    if (!d.allowed) deny(d);
  }
  return r;
}

/** BL-09: a stale version answers 409 with `details.current` = the request as this caller may see it. */
async function assertVersion(ctx: CommandContext, principal: Principal, r: repo.CorrectionDbRow, version: number | undefined): Promise<void> {
  if (version !== undefined && r.version !== version) throw await conflictFor(ctx, principal, r);
}

function actorPrincipal(ctx: CommandContext): Principal {
  if (ctx.actor.kind !== 'employee') throw new Error('correction command without an employee actor');
  return { employeeId: ctx.actor.employeeId, role: ctx.actor.role, sessionState: ctx.actor.sessionState };
}

async function conflictFor(ctx: CommandContext, principal: Principal, r: repo.CorrectionDbRow): Promise<HttpError> {
  const current = await repo.findCorrection(ctx.tx, r.id);
  return versionConflict(current?.version ?? r.version, current ? await detailFor(ctx.tx, principal, r.id) : undefined);
}

function terminalConflict(r: repo.CorrectionDbRow): HttpError {
  return stateConflict('This request is closed and cannot change', { status: r.status });
}

/** The reviewer who took it, or the Owner. */
function assertReviewer(principal: Principal, r: repo.CorrectionDbRow): void {
  if (r.status !== 'in_review') {
    if (TERMINAL.includes(r.status)) throw terminalConflict(r);
    throw stateConflict('Start the review first', { status: r.status });
  }
  if (principal.role !== 'owner' && r.reviewer_id !== principal.employeeId) {
    throw stateConflict('Another reviewer has this request', { status: r.status, reviewer: r.reviewer_name });
  }
}

/** AC-DFIX-003: the first reviewer wins; the second gets 409 "already in review". */
export async function startReview(ctx: CommandContext, principal: Principal, id: string, version?: number): Promise<CorrectionDetail> {
  const r = await lockForReviewer(ctx, principal, id, 'correction.review');
  if (r.status === 'in_review' && r.reviewer_id === principal.employeeId) return detailFor(ctx.tx, principal, id);
  if (r.status === 'in_review') throw stateConflict('This request is already in review', { status: r.status, reviewer: r.reviewer_name });
  if (r.status !== 'submitted') throw terminalConflict(r);
  await assertVersion(ctx, principal, r, version);
  const next = await repo.transition(ctx.tx, id, r.version, { status: 'in_review', reviewerId: actorId(ctx), reviewStartedAt: ctx.now });
  if (next === null) throw await conflictFor(ctx, principal, r);
  await audited(ctx, 'data_correction_request.review_started', r);
  return detailFor(ctx.tx, principal, id);
}

/** FE3-REQ-3: In review → Submitted (reviewer or Owner). */
export async function releaseReview(ctx: CommandContext, principal: Principal, id: string, version: number): Promise<CorrectionDetail> {
  const r = await lockForReviewer(ctx, principal, id, 'correction.review');
  if (r.status === 'submitted') return detailFor(ctx.tx, principal, id);
  assertReviewer(principal, r);
  await assertVersion(ctx, principal, r, version);
  const next = await repo.transition(ctx.tx, id, r.version, { status: 'submitted', reviewerId: null, reviewStartedAt: null });
  if (next === null) throw await conflictFor(ctx, principal, r);
  await audited(ctx, 'data_correction_request.released', r, { payload: { cause: 'released' } });
  return detailFor(ctx.tx, principal, id);
}

async function finishResolved(ctx: CommandContext, r: repo.CorrectionDbRow, note: string | null): Promise<void> {
  const next = await repo.transition(ctx.tx, r.id, r.version, {
    status: 'resolved',
    resolutionNote: note,
    resolvedBy: actorId(ctx),
    resolvedAt: ctx.now,
  });
  if (next === null) throw await conflictFor(ctx, actorPrincipal(ctx), r);
  await audited(ctx, 'data_correction_request.resolved', r);
  await emitOutcome(ctx, 'data_correction_request.resolved', r);
}

/** BL-17: requester notice for a finished request. Ids only; consumers re-read and re-check access. */
async function emitOutcome(
  ctx: CommandContext,
  name: 'data_correction_request.resolved' | 'data_correction_request.rejected' | 'data_correction_request.closed',
  r: repo.CorrectionDbRow
): Promise<void> {
  await outbox.emit(ctx.tx, { name, aggregateType: 'data_correction_request', aggregateId: r.id, payload: { businessId: r.business_id } });
}

/**
 * AC-DFIX-004: apply = business update (+ edit history) and Resolved in ONE transaction. A duplicate block
 * rolls the whole save back, so the request stays In review (AC-DUP-013). Run inside `runBusinessCommand`.
 */
export async function resolveCorrection(ctx: CommandContext, principal: Principal, id: string, input: ResolveInput): Promise<CorrectionDetail> {
  const r = await lockForReviewer(ctx, principal, id, 'correction.apply');
  assertReviewer(principal, r);
  await assertVersion(ctx, principal, r, input.version);
  await updateBusiness(ctx, principal, r.business_id, input.business, { viaCorrectionId: id });
  await finishResolved(ctx, r, input.note ?? null);
  return detailFor(ctx.tx, principal, id);
}

export async function rejectCorrection(ctx: CommandContext, principal: Principal, id: string, version: number, reason: string): Promise<CorrectionDetail> {
  const r = await lockForReviewer(ctx, principal, id, 'correction.reject');
  if (r.status === 'rejected') return detailFor(ctx.tx, principal, id);
  assertReviewer(principal, r);
  await assertVersion(ctx, principal, r, version);
  const next = await repo.transition(ctx.tx, id, r.version, { status: 'rejected', resolutionNote: reason, resolvedBy: actorId(ctx), resolvedAt: ctx.now });
  if (next === null) throw await conflictFor(ctx, principal, r);
  await audited(ctx, 'data_correction_request.rejected', r, { reason });
  await emitOutcome(ctx, 'data_correction_request.rejected', r);
  return detailFor(ctx.tx, principal, id);
}

export async function closeNoChange(ctx: CommandContext, principal: Principal, id: string, version: number, note: string): Promise<CorrectionDetail> {
  const r = await lockForReviewer(ctx, principal, id, 'correction.close');
  if (r.status === 'closed') return detailFor(ctx.tx, principal, id);
  assertReviewer(principal, r);
  await assertVersion(ctx, principal, r, version);
  const next = await repo.transition(ctx.tx, id, r.version, { status: 'closed', resolutionNote: note, resolvedBy: actorId(ctx), resolvedAt: ctx.now });
  if (next === null) throw await conflictFor(ctx, principal, r);
  await audited(ctx, 'data_correction_request.closed', r, { reason: note });
  await emitOutcome(ctx, 'data_correction_request.closed', r);
  return detailFor(ctx.tx, principal, id);
}

/** AC-DFIX-006: the requester withdraws while Submitted or In review. */
export async function withdrawCorrection(ctx: CommandContext, principal: Principal, id: string, version: number): Promise<CorrectionDetail> {
  const r = await repo.findCorrection(ctx.tx, id, true);
  if (!r) throw notFound();
  if (r.requested_by !== principal.employeeId) throw permissionDenied();
  if (r.status === 'withdrawn') return detailFor(ctx.tx, principal, id);
  if (!OPEN_STATUSES.includes(r.status)) throw terminalConflict(r);
  await assertVersion(ctx, principal, r, version);
  const next = await repo.transition(ctx.tx, id, r.version, { status: 'withdrawn', reviewerId: null });
  if (next === null) throw await conflictFor(ctx, principal, r);
  await audited(ctx, 'data_correction_request.withdrawn', r);
  return detailFor(ctx.tx, principal, id);
}

/** N-4 / AC-DFIX-008: a deactivated reviewer's In-review requests return to Submitted (system actor). */
export async function releaseForDeactivatedReviewer(ctx: CommandContext, employeeId: string): Promise<number> {
  const rows = await repo.inReviewByReviewer(ctx.tx, employeeId);
  for (const row of rows) {
    const next = await repo.transition(ctx.tx, row.id, row.version, { status: 'submitted', reviewerId: null, reviewStartedAt: null });
    if (next === null) continue;
    await audit(ctx, {
      eventName: 'data_correction_request.released',
      entityType: 'data_correction_request',
      entityId: row.id,
      payload: { cause: 'reviewer_deactivated', reviewerId: employeeId },
    });
  }
  return rows.length;
}

export const releaseOnDeactivationConsumer = {
  name: 'corrections.release_on_reviewer_deactivation',
  events: ['account.deactivated'] as const,
  async handle(ctx: CommandContext, event: DeliveredEvent): Promise<void> {
    await releaseForDeactivatedReviewer(ctx, event.aggregateId);
  },
};

// ---------------------------------------------------------------------------------------------
// Bridge for MOD-business (detail summaries; PATCH with `correctionId`)
// ---------------------------------------------------------------------------------------------

export const correctionsBridge: CorrectionsBridge = {
  async openSummaries(db, businessIds, viewer) {
    const rows = await repo.openForBusinesses(db, businessIds);
    const out = new Map<string, OpenCorrections>();
    const seesAll = viewer.role === 'owner' || viewer.role === 'data_entry';
    for (const r of rows) {
      const entry = out.get(r.business_id) ?? { count: 0, items: [] as BusinessCorrectionSummary[] };
      entry.count += 1;
      const mine = r.requested_by === viewer.employeeId;
      if (seesAll || mine) {
        entry.items.push({
          id: r.id,
          issueType: r.issue_type,
          status: r.status as 'submitted' | 'in_review',
          reviewer: r.reviewer_name,
          mine,
          since: iso(r.status === 'in_review' ? r.review_started_at : r.created_at) as string,
        });
      }
      out.set(r.business_id, entry);
    }
    return out;
  },

  async prepareApply(ctx, principal, correctionId, businessId): Promise<CorrectionApplyHandle> {
    const r = await repo.findCorrection(ctx.tx, correctionId, true);
    if (!r || r.business_id !== businessId) throw stateConflict('The correction request does not belong to this business', { reason: 'CORRECTION_MISMATCH' });
    assertReviewer(principal, r);
    return { finish: (note) => finishResolved(ctx, r, note) };
  },
};
