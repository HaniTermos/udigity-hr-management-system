/**
 * MOD-assignment — service (SM-ASSIGNMENT-001, WF-CALL-001; docs/implementation/calling-design.md §4). Owner: BE3.
 *
 * B8: only this module creates or changes calling assignments. Owner + completed 2FA only (B3-Q01, B3-Q15).
 * Policies used here — B1/B2/B4/B6 eligibility, B3-Q03 per-follow-up choice — are "Demonstration alternative —
 * not approved (docs/policy-defaults.md)". Auto-fill follows the approved policy baseline 2026-10-29 §D8
 * (round-robin, queue cap work.autofillQueueCap = 40 current eligible assigned businesses per agent).
 *
 * Lock order (same as MOD-calls): business_calling_states row → calling_assignments row → follow_ups row.
 * Reassign/unassign never touch an Active reservation (AR-03): the Owner overrides it first (separate call).
 */
import type { Queryable } from '../../db/pool.js';
import { access, assertAllowed, type Principal } from '../../shared/access.js';
import { HttpError, notFound, ruleViolation, stateConflict } from '../../shared/errors.js';
import { outbox } from '../../shared/outbox.js';
import { orderByClause, toPage, type PageResult } from '../../shared/pagination.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { readCompanySettings } from '../admin/repo.js';
import { getSetting } from '../admin/service.js';
import { callingStateOf, lockCallingState, openFollowUpOf, transferFollowUps } from '../calls/service.js';
import { employees, isActiveCallingUser } from '../calls/directory.js';
import { findOpenDeal } from '../deals/service.js';
import { clock } from '../platform/clock.js';
import { activeFor, principalOf } from '../reservation/service.js';
import * as repo from './repo.js';
import type { AssignmentRow, AssignmentSource } from './repo.js';
import type {
  AssignBody,
  AssignResultDto,
  AutofillAgentResultDto,
  AutofillBody,
  CallingAssignmentDto,
  FollowUpChoice,
  ListAssignmentsQuery,
  ReassignBody,
  ReassignImpactDto,
  UnassignBody,
} from './schemas.js';
import type { z } from 'zod';

type Ineligible = { code: string; message: string };

// ---------------------------------------------------------------------------
// Eligibility (B1 rejected, B2 no phone, B4 archived, B6/DEC-017 open deal) — DEMO working defaults
// ---------------------------------------------------------------------------
export async function ineligibility(db: Queryable, businessId: string): Promise<Ineligible[] | null> {
  const biz = await repo.businessFacts(db, businessId);
  if (!biz) return null;
  const out: Ineligible[] = [];
  if (biz.archived) out.push({ code: 'archived', message: 'The business is archived' });
  if (!biz.hasPhone) out.push({ code: 'no_phone', message: 'The business has no phone number' });
  const state = await callingStateOf(db, businessId);
  if (state?.outcome === 'rejected') out.push({ code: 'do_not_call', message: 'The business asked not to be called' });
  const deal = await findOpenDeal(db, businessId);
  if (deal) out.push({ code: 'open_deal', message: 'The business has an open deal' });
  return out;
}

async function assertAssignee(db: Queryable, assigneeId: string, field = 'assigneeId'): Promise<void> {
  if (!(await isActiveCallingUser(db, assigneeId, ['call_center']))) {
    throw ruleViolation('The assignee must be an active Call Center agent', { field });
  }
}

function toDto(row: AssignmentRow, names: Map<string, { name: string; isActive: boolean }>, inaccessible = false): CallingAssignmentDto {
  const person = names.get(row.assignee_id);
  return {
    id: row.id,
    businessId: row.business_id,
    assigneeId: row.assignee_id,
    assigneeName: person?.name ?? '',
    assignedBy: row.assigned_by,
    source: row.source,
    startedAt: row.started_at.toISOString(),
    version: row.version,
    assigneeInactive: person ? !person.isActive : false,
    assignedButInaccessible: inaccessible,
  };
}

/** Owner check on the business (Owner skips steps 5–8; still 404 for a missing row). */
async function ownerCheck(ctx: CommandContext, action: string, businessId: string): Promise<Principal> {
  const principal = principalOf(ctx);
  assertAllowed(await access.check(ctx.tx, principal, action as never, { type: 'business', id: businessId }));
  return principal;
}

async function auditAssignment(ctx: CommandContext, eventName: string, row: AssignmentRow, extra: { before?: Record<string, unknown>; reason?: string | null } = {}) {
  await audit(ctx, {
    eventName,
    entityType: 'calling_assignment',
    entityId: row.id,
    payload: { businessId: row.business_id, assigneeId: row.assignee_id, source: row.source },
    before: extra.before ?? null,
    after: { assigneeId: row.assignee_id, endedAt: row.ended_at ? row.ended_at.toISOString() : null },
    reason: extra.reason ?? null,
  });
}

/** One business, inside the caller's transaction. Returns the new row or a skip reason. */
async function assignOne(
  ctx: CommandContext,
  businessId: string,
  assigneeId: string,
  source: AssignmentSource
): Promise<{ row: AssignmentRow } | { skip: Ineligible }> {
  const principal = principalOf(ctx);
  const decision = await access.check(ctx.tx, principal, 'calling.assign', { type: 'business', id: businessId });
  if (!decision.allowed) return { skip: { code: 'not_found', message: 'Business not found' } };
  if (!(await repo.businessFacts(ctx.tx, businessId))) return { skip: { code: 'not_found', message: 'Business not found' } };
  await lockCallingState(ctx.tx, businessId);
  const reasons = (await ineligibility(ctx.tx, businessId)) ?? [];
  if (reasons.length) return { skip: reasons[0] };
  const row = await repo.insertOpen(ctx.tx, { businessId, assigneeId, assignedBy: principal.employeeId, source, reason: null, now: clock.now() });
  if (!row) return { skip: { code: 'already_assigned', message: 'The business is already assigned; use reassign' } };
  await auditAssignment(ctx, 'calling_assignment.assigned', row);
  await outbox.emit(ctx.tx, {
    name: 'calling_assignment.assigned',
    aggregateType: 'calling_assignment',
    aggregateId: row.id,
    payload: { businessId, assigneeId },
  });
  return { row };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** POST /api/calling-assignments/assign — bulk; ineligible or already-assigned items are skipped and listed. */
export async function assign(ctx: CommandContext, body: z.infer<typeof AssignBody>): Promise<AssignResultDto> {
  await assertAssignee(ctx.tx, body.assigneeId);
  const assigned: AssignmentRow[] = [];
  const skipped: AssignResultDto['skipped'] = [];
  for (const businessId of [...new Set(body.businessIds)]) {
    const r = await assignOne(ctx, businessId, body.assigneeId, body.source);
    if ('row' in r) assigned.push(r.row);
    else skipped.push({ businessId, ...r.skip });
  }
  const names = await employees(ctx.tx, [body.assigneeId]);
  return { assigned: assigned.map((r) => toDto(r, names)), skipped };
}

/** POST /api/calling-assignments/reassign-impact — OWN-008 preview, read-only. */
export async function reassignImpact(ctx: CommandContext, body: { businessId: string; newAssigneeId: string }): Promise<ReassignImpactDto> {
  await ownerCheck(ctx, 'calling.assign', body.businessId);
  const reasons = await ineligibility(ctx.tx, body.businessId);
  if (!reasons) throw notFound();
  const current = await repo.findOpen(ctx.tx, body.businessId);
  const people = await employees(ctx.tx, [current?.assignee_id ?? null, body.newAssigneeId]);
  const ineligible = [...reasons];
  if (!(await isActiveCallingUser(ctx.tx, body.newAssigneeId, ['call_center']))) {
    ineligible.push({ code: 'assignee_ineligible', message: 'The new assignee must be an active Call Center agent' });
  }
  if (current && current.assignee_id === body.newAssigneeId) ineligible.push({ code: 'same_assignee', message: 'Already assigned to this agent' });
  const fu = await openFollowUpOf(ctx.tx, body.businessId);
  const state = await callingStateOf(ctx.tx, body.businessId);
  const reservation = await activeFor(ctx.tx, body.businessId);
  return {
    currentAssignment: current
      ? { id: current.id, assigneeId: current.assignee_id, assigneeName: people.get(current.assignee_id)?.name ?? '', version: current.version }
      : null,
    openFollowUps: fu ? [{ id: fu.id, scheduledFor: fu.scheduledFor, responsibleId: fu.responsibleId, preselected: 'transfer' }] : [],
    callbackMarker: state?.callbackMarker ?? false,
    activeReservation: reservation
      ? { id: reservation.id, holderName: reservation.holderName, leaseExpiresAt: reservation.leaseExpiresAt.toISOString() }
      : null,
    ineligible,
  };
}

/** Shared guard for reassign/unassign: lock state, load the open row, version, no live reservation. */
async function lockOpenForChange(ctx: CommandContext, action: string, businessId: string, version: number): Promise<AssignmentRow> {
  await ownerCheck(ctx, action, businessId);
  if (!(await repo.businessFacts(ctx.tx, businessId))) throw notFound();
  await lockCallingState(ctx.tx, businessId);
  const open = await repo.findOpen(ctx.tx, businessId, true);
  if (!open) throw stateConflict('The business is not assigned', { reason: 'not_assigned' });
  if (open.version !== version) {
    throw new HttpError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', { currentVersion: open.version });
  }
  const reservation = await activeFor(ctx.tx, businessId);
  if (reservation) {
    // AR-03: the save never releases a reservation. The Owner chooses Wait or Override (POST /api/reservations/:id/override).
    throw stateConflict('Someone is working on this contact; wait or override the reservation first', {
      reason: 'reservation_active',
      reservationId: reservation.id,
      leaseExpiresAt: reservation.leaseExpiresAt.toISOString(),
    });
  }
  return open;
}

function choices(list: FollowUpChoice[]) {
  return list.map((c) => ({ followUpId: c.followUpId, action: c.action, ...(c.action === 'cancel' ? { reason: c.reason } : {}) }));
}

/** POST /api/calling-assignments/reassign — one business per save (WF-CALL-001). */
export async function reassign(ctx: CommandContext, body: z.infer<typeof ReassignBody>): Promise<{ assignment: CallingAssignmentDto; warnings: string[] }> {
  const open = await lockOpenForChange(ctx, 'calling.reassign', body.businessId, body.version);
  if (open.assignee_id === body.newAssigneeId) throw ruleViolation('The business is already assigned to this agent', { field: 'newAssigneeId' });
  await assertAssignee(ctx.tx, body.newAssigneeId, 'newAssigneeId');
  const reasons = (await ineligibility(ctx.tx, body.businessId)) ?? [];
  if (reasons.length) throw ruleViolation(reasons[0].message, { reason: reasons[0].code });
  const now = clock.now();
  const principal = principalOf(ctx);
  const ended = await repo.endOpen(ctx.tx, open.id, open.version, { endedBy: principal.employeeId, endReason: 'reassigned', now });
  if (!ended) throw new HttpError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', { currentVersion: open.version + 1 });
  const row = await repo.insertOpen(ctx.tx, {
    businessId: body.businessId,
    assigneeId: body.newAssigneeId,
    assignedBy: principal.employeeId,
    source: 'manual',
    reason: body.reason,
    now,
  });
  if (!row) throw stateConflict('The business was assigned meanwhile', { reason: 'already_assigned' });
  const { warnings } = await transferFollowUps(ctx, {
    businessId: body.businessId,
    fromEmployeeId: open.assignee_id,
    toEmployeeId: body.newAssigneeId,
    decisions: choices(body.followUps),
  });
  await auditAssignment(ctx, 'calling_assignment.reassigned', row, { before: { assigneeId: open.assignee_id, assignmentId: open.id }, reason: body.reason });
  await outbox.emit(ctx.tx, {
    name: 'calling_assignment.reassigned',
    aggregateType: 'calling_assignment',
    aggregateId: row.id,
    payload: { businessId: body.businessId, assigneeId: body.newAssigneeId, previousAssigneeId: open.assignee_id },
  });
  const names = await employees(ctx.tx, [row.assignee_id]);
  return { assignment: toDto(row, names), warnings };
}

/** POST /api/calling-assignments/unassign (B3-Q15). Transfer is not a valid follow-up choice here. */
export async function unassign(ctx: CommandContext, body: z.infer<typeof UnassignBody>): Promise<{ businessId: string; unassigned: true; warnings: string[] }> {
  const open = await lockOpenForChange(ctx, 'calling.unassign', body.businessId, body.version);
  const ended = await repo.endOpen(ctx.tx, open.id, open.version, { endedBy: principalOf(ctx).employeeId, endReason: 'unassigned', now: clock.now() });
  if (!ended) throw new HttpError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', { currentVersion: open.version + 1 });
  const { warnings } = await transferFollowUps(ctx, {
    businessId: body.businessId,
    fromEmployeeId: open.assignee_id,
    toEmployeeId: null,
    decisions: choices(body.followUps),
  });
  await auditAssignment(ctx, 'calling_assignment.unassigned', ended, { before: { assigneeId: open.assignee_id }, reason: body.reason });
  return { businessId: body.businessId, unassigned: true, warnings };
}

const LEGACY_QUEUE_CAP_KEY = 'work.autofillPerAgentPerDay';

/**
 * D8 queue cap. `work.autofillQueueCap` when the Owner saved it; else a value saved under the retired
 * key `work.autofillPerAgentPerDay` (read-only fallback, never rewritten); else the registry default (40).
 */
export async function autofillQueueCap(db: Queryable): Promise<number> {
  const stored = (await readCompanySettings(db)).values;
  if (!Object.prototype.hasOwnProperty.call(stored, 'work.autofillQueueCap')) {
    const legacy = Number(stored[LEGACY_QUEUE_CAP_KEY]);
    if (Number.isInteger(legacy) && legacy >= 1) return legacy;
  }
  return getSetting(db, 'work.autofillQueueCap');
}

/** Round-robin step (pure, unit-tested): the agent at `cursor` among the agents that still have room. */
export function roundRobinPick(open: readonly string[], cursor: number): { agentId: string; index: number } | null {
  if (open.length === 0) return null;
  const index = cursor % open.length;
  return { agentId: open[index], index };
}

/**
 * POST /api/calling-assignments/autofill — D8 "Auto-fill queues" (Owner-triggered; no scheduled run in v1).
 * Candidates: eligible, unassigned, non-rejected businesses, oldest first (unassigned only, so a business
 * with an open follow-up, active reservation, accepted opportunity or active deal is never moved).
 * Distribution: round-robin across active Call Center agents (or the one `agentId`), each filled up to the
 * queue cap of current eligible assigned businesses. Queue cap, not a performance quota.
 */
export async function autofill(
  ctx: CommandContext,
  body: z.infer<typeof AutofillBody>
): Promise<AssignResultDto & { cap: number; agents: AutofillAgentResultDto[] }> {
  // C-03: serialise auto-fills. The queue sizes are read in this transaction, so a parallel run must not
  // proceed until the first one commits or both would fill past the cap. H-03: a run that finds another one in
  // progress answers 409 AUTOFILL_RUNNING at once (nothing changed) instead of waiting into lock_timeout (503).
  const { rows: lock } = await ctx.tx.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_xact_lock(hashtextextended('calling.autofill', 0)) AS locked`
  );
  if (!lock[0]?.locked) {
    throw new HttpError(409, 'AUTOFILL_RUNNING', 'Auto-fill is already running. Try again when it has finished.');
  }
  if (body.agentId) await assertAssignee(ctx.tx, body.agentId, 'agentId');
  const agentIds = body.agentId ? [body.agentId] : await repo.activeCallCenterAgents(ctx.tx);
  const cap = await autofillQueueCap(ctx.tx);
  const before = await repo.eligibleQueueSizes(ctx.tx, agentIds);
  const room = new Map(agentIds.map((id) => [id, Math.max(0, cap - (before.get(id) ?? 0))]));
  const totalRoom = Math.min(body.limit ?? Number.MAX_SAFE_INTEGER, [...room.values()].reduce((a, b) => a + b, 0));
  const assigned: AssignmentRow[] = [];
  const skipped: AssignResultDto['skipped'] = [];
  const open = agentIds.filter((id) => (room.get(id) ?? 0) > 0);
  let cursor = 0;
  if (totalRoom > 0) {
    // Over-fetch: some candidates fail the full rule (open deal) or lose a race.
    for (const businessId of await repo.autofillCandidates(ctx.tx, totalRoom * 2 + 10)) {
      if (assigned.length >= totalRoom) break;
      const pick = roundRobinPick(open, cursor);
      if (!pick) break;
      const r = await assignOne(ctx, businessId, pick.agentId, 'automatic');
      if (!('row' in r)) {
        skipped.push({ businessId, ...r.skip });
        continue; // the same agent gets the next candidate
      }
      assigned.push(r.row);
      const left = (room.get(pick.agentId) ?? 0) - 1;
      room.set(pick.agentId, left);
      if (left <= 0) {
        open.splice(pick.index, 1); // the next agent slides into this index
        cursor = pick.index;
      } else {
        cursor = pick.index + 1;
      }
    }
  }
  const names = await employees(ctx.tx, agentIds);
  const agents = agentIds.map((id) => ({
    agentId: id,
    agentName: names.get(id)?.name ?? '',
    queueBefore: before.get(id) ?? 0,
    assignedNow: assigned.filter((a) => a.assignee_id === id).length,
  }));
  return { assigned: assigned.map((r) => toDto(r, names)), skipped, cap, agents };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface AssignmentListItemDto {
  businessId: string;
  businessName: string;
  outcome: string;
  assignment: CallingAssignmentDto | null;
  // BL-01 (additive): OWN-007 columns.
  categoryName: string | null;
  /** First phone (E.164), or null for "No phone". */
  phone: string | null;
  phoneCount: number;
  reservation: { state: 'reserved'; holderId: string; holderName: string; acquiredAt: string } | { state: 'free' };
  lastAttempt: { at: string; outcome: string } | null;
  attemptCount: number;
}

/** GET /api/calling-assignments — OWN-007 (Owner). `inaccessible` = assignee inactive or no longer has access (B7). */
export async function list(db: Queryable, principal: Principal, q: z.infer<typeof ListAssignmentsQuery>): Promise<PageResult<AssignmentListItemDto>> {
  const params = new SqlParams();
  const where: string[] = [access.scopeFilter(principal, 'calling.assign', 'business', { alias: 'b', params })];
  where.push('b.archived_at IS NULL');
  if (q.assigneeId) where.push(`ca.assignee_id = ${params.add(q.assigneeId)}::uuid`);
  if (q.status === 'assigned') where.push('ca.id IS NOT NULL');
  if (q.status === 'unassigned') where.push('ca.id IS NULL');
  if (q.status === 'inaccessible') where.push('ca.id IS NOT NULL AND e.is_active = false');
  if (q.q) {
    // LIKE wildcards in the user's text are literal (ESCAPE '\').
    const term = params.add(`%${q.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    const digits = q.q.replace(/\D/g, '');
    const phoneMatch = digits.length >= 3
      ? ` OR EXISTS (SELECT 1 FROM business_phones bq WHERE bq.business_id = b.id AND bq.normalized_phone LIKE ${params.add(`%${digits}%`)})`
      : '';
    where.push(`(b.name ILIKE ${term} ESCAPE ${String.raw`'\'`}${phoneMatch})`);
  }
  if (q.reservation === 'reserved') where.push("EXISTS (SELECT 1 FROM contact_reservations rq WHERE rq.business_id = b.id AND rq.state = 'active')");
  if (q.reservation === 'free') where.push("NOT EXISTS (SELECT 1 FROM contact_reservations rq WHERE rq.business_id = b.id AND rq.state = 'active')");
  const order = orderByClause(q, { businessName: 'b.name', assignee: 'e.full_name', startedAt: 'ca.started_at' }, 'startedAt');
  const { rows, total } = await repo.list(db, where, params, `${order} NULLS LAST, b.id`, q);

  // B7 derived flag: does the assignee still pass the access check on the business?
  const inaccessible = new Set<string>();
  const byAssignee = new Map<string, string[]>();
  for (const r of rows) if (r.assignee_id) byAssignee.set(r.assignee_id, [...(byAssignee.get(r.assignee_id) ?? []), r.business_id]);
  for (const [assigneeId, ids] of byAssignee) {
    const decisions = await access.checkMany(
      db,
      { employeeId: assigneeId, role: 'call_center', sessionState: 'active' },
      'calling.queue.read',
      ids.map((id) => ({ type: 'business' as const, id }))
    );
    for (const id of ids) if (!decisions.get(id)?.allowed) inaccessible.add(id);
  }

  return toPage(
    rows.map((r) => ({
      businessId: r.business_id,
      businessName: r.business_name,
      outcome: r.outcome,
      assignment:
        r.id && r.assignee_id && r.started_at && r.version !== null
          ? {
              id: r.id,
              businessId: r.business_id,
              assigneeId: r.assignee_id,
              assigneeName: r.assignee_name ?? '',
              assignedBy: r.assigned_by,
              source: r.source ?? 'manual',
              startedAt: r.started_at.toISOString(),
              version: r.version,
              assigneeInactive: r.assignee_active === false,
              assignedButInaccessible: r.assignee_active !== false && inaccessible.has(r.business_id),
            }
          : null,
      categoryName: r.category_name,
      phone: r.phone,
      phoneCount: r.phone_count,
      reservation:
        r.reservation_holder_id && r.reservation_acquired_at
          ? {
              state: 'reserved' as const,
              holderId: r.reservation_holder_id,
              holderName: r.reservation_holder_name ?? '',
              acquiredAt: r.reservation_acquired_at.toISOString(),
            }
          : { state: 'free' as const },
      lastAttempt: r.last_attempt_at ? { at: r.last_attempt_at.toISOString(), outcome: r.last_attempt_outcome ?? '' } : null,
      attemptCount: r.attempt_count,
    })),
    total,
    q
  );
}

/** Read op for other modules: the current assignee of a business (null = Unassigned). */
export async function currentAssignee(db: Queryable, businessId: string): Promise<string | null> {
  return (await repo.findOpen(db, businessId))?.assignee_id ?? null;
}

/** Resource resolver (`calling_assignment` is an own-record type: the assignee). */
export async function resolveAssignmentOwner(db: Queryable, id: string): Promise<string[] | null> {
  const row = await repo.findById(db, id);
  return row ? [row.assignee_id] : null;
}
