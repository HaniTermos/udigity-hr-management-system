/**
 * MOD-calls — commands and public operations (docs/implementation/calling-design.md §6–§8). Owner: BE3.
 *
 * Policies: only U-01 ("Accepted keeps reservation") is APPROVED. Everything else read here —
 * calls.saveAfterReservationLoss (B3-Q05 FLAG), calls.acceptedNoteMinLength, followUps.overdueMinutes,
 * D2/D4/DEC-016/B3-Q04/Q12 rules — is "Demonstration alternative — not approved (docs/policy-defaults.md)".
 *
 * Lock order (every command): reservation row → business_calling_states row → follow_ups row.
 */
import type { Queryable } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { access, assertAllowed, type Action, type Principal } from '../../shared/access.js';
import { HttpError, notFound, permissionDenied, ruleViolation, stateConflict } from '../../shared/errors.js';
import { DEMO_LABEL, flags } from '../../shared/flags.js';
import { outbox, type OutboxEventName } from '../../shared/outbox.js';
import { orderByClause, pageClause, toPage, type PageResult } from '../../shared/pagination.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { getSetting } from '../admin/service.js';
import { clock } from '../platform/clock.js';
import {
  activeFor,
  assertCallingAccess,
  checkBusiness,
  endAfterSave,
  keepAfterSave,
  liveHolders,
  principalOf,
  reservationLost,
  validateLease,
} from '../reservation/service.js';
import { businessInfo, employees, isActiveCallingUser } from './directory.js';
import { opportunities } from './opportunityPort.js';
import * as repo from './repo.js';
import { firstMeetingAtByDeal } from '../meetings/service.js';
import type { AttemptRow, FollowUpRow, StateRow } from './repo.js';
import { CALL_OUTCOMES, QUEUE_BUCKETS, canKeepReservation } from './schemas.js';
import type {
  CallAttemptDto,
  CallingStateDto,
  CallOutcome,
  DoNotCallItemDto,
  DoNotCallQuery,
  ListFollowUpsQuery,
  OpportunitiesDto,
  OpportunitiesQuery,
  QueueBucket,
  QueueDto,
  QueueQuery,
  WorkspaceDto,
  CancelFollowUpBody,
  CompleteFollowUpBody,
  CreateFollowUpBody,
  FollowUpCommandResultDto,
  FollowUpDto,
  FollowUpInput,
  LogAttemptBody,
  LogAttemptResultDto,
  LogInboundRejectionBody,
  ReopenBody,
  ReopenResultDto,
  UpdateFollowUpBody,
} from './schemas.js';
import type { z } from 'zod';

type LogAttempt = z.infer<typeof LogAttemptBody>;
type InboundRejection = z.infer<typeof LogInboundRejectionBody>;

// ---------------------------------------------------------------------------
// Policy seam (B3-Q05 FLAG; both branches are tested)
// ---------------------------------------------------------------------------
type SaveAfterLoss = 'keepAttemptOnly' | 'reject';
let saveAfterLossOverride: SaveAfterLoss | null = null;

export function saveAfterLossPolicy(): SaveAfterLoss {
  return saveAfterLossOverride ?? flags['calls.saveAfterReservationLoss'];
}

/** Test seam (NODE_ENV=test only): flip calls.saveAfterReservationLoss without restarting. */
export function setSaveAfterLossOverride(value: SaveAfterLoss | null): void {
  if (config.env !== 'test') throw new Error('setSaveAfterLossOverride is available only when NODE_ENV=test');
  saveAfterLossOverride = value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const invalid = (field: string, message: string) => new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { [field]: [message] });
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const actorIdOf = (ctx: CommandContext) => (ctx.actor.kind === 'employee' ? ctx.actor.employeeId : null);

export function stateDto(row: StateRow): CallingStateDto {
  return {
    businessId: row.business_id,
    outcome: row.outcome,
    outcomeChangedAt: iso(row.outcome_changed_at),
    rejectionReason: row.rejection_reason,
    callbackMarker: row.callback_marker,
    lastTouchpointAt: iso(row.last_touchpoint_at),
    version: row.version,
  };
}

export function attemptDto(row: AttemptRow, names: Map<string, { name: string }>): CallAttemptDto {
  return {
    id: row.id,
    businessId: row.business_id,
    agentId: row.agent_id,
    agentName: names.get(row.agent_id)?.name ?? '',
    attemptedAt: row.attempted_at.toISOString(),
    channel: row.channel,
    outcome: row.outcome,
    outcomeApplied: row.outcome_applied,
    notes: row.notes,
    rejectionReason: row.rejection_reason,
    clientNeedsNote: row.client_needs_note,
    serviceInterest: row.service_interest,
  };
}

/** Map follow-up rows with names and derived flags (due, overdue, responsible inactive). */
export async function followUpDtos(db: Queryable, rows: FollowUpRow[]): Promise<FollowUpDto[]> {
  if (rows.length === 0) return [];
  const now = clock.now().getTime();
  const overdueMinutes = await getSetting(db, 'followUps.overdueMinutes');
  // Sequential: `db` may be a transaction client (one query at a time).
  const biz = await businessInfo(db, rows.map((r) => r.business_id));
  const people = await employees(db, rows.map((r) => r.responsible_id));
  return rows.map((r) => {
    const open = r.state === 'scheduled';
    const at = r.scheduled_for.getTime();
    const person = people.get(r.responsible_id);
    return {
      id: r.id,
      businessId: r.business_id,
      businessName: biz.get(r.business_id)?.name ?? '',
      responsibleId: r.responsible_id,
      responsibleName: person?.name ?? '',
      scheduledFor: r.scheduled_for.toISOString(),
      purpose: r.purpose,
      state: r.state,
      due: open && at <= now,
      overdue: open && at + overdueMinutes * 60_000 < now,
      responsibleInactive: person ? !person.isActive : false,
      completedAt: iso(r.completed_at),
      cancelledAt: iso(r.cancelled_at),
      cancelReason: r.cancel_reason,
      cancelSource: r.cancel_source,
      version: r.version,
    };
  });
}

async function emit(ctx: CommandContext, name: OutboxEventName, aggregateType: string, aggregateId: string, payload: Record<string, string | number | boolean | null>) {
  await outbox.emit(ctx.tx, { name, aggregateType, aggregateId, payload });
}

async function auditFollowUp(ctx: CommandContext, eventName: string, row: FollowUpRow, extra: { before?: Record<string, unknown>; reason?: string | null } = {}) {
  await audit(ctx, {
    eventName,
    entityType: 'follow_up',
    entityId: row.id,
    payload: { businessId: row.business_id, responsibleId: row.responsible_id },
    before: extra.before ?? null,
    after: { state: row.state, scheduledFor: row.scheduled_for.toISOString(), responsibleId: row.responsible_id },
    reason: extra.reason ?? null,
  });
}

async function auditMarker(ctx: CommandContext, businessId: string, set: boolean) {
  await audit(ctx, {
    eventName: set ? 'callback_marker.set' : 'callback_marker.cleared',
    entityType: 'business',
    entityId: businessId,
    after: { callbackMarker: set },
  });
}

/** Business resource state (step 9): exists, not archived. */
async function assertBusinessOpen(db: Queryable, businessId: string): Promise<void> {
  const info = (await businessInfo(db, [businessId])).get(businessId);
  if (!info) throw notFound();
  if (info.archived) throw stateConflict('This business is archived', { reason: 'archived' });
}

const dncConflict = () => stateConflict('This business asked not to be called (do not call)', { reason: 'do_not_call' });

/** Create the 1:1 row if missing, then lock it. */
export async function lockCallingState(db: Queryable, businessId: string): Promise<StateRow> {
  await repo.insertState(db, businessId);
  const row = await repo.findState(db, businessId, true);
  if (!row) throw notFound();
  return row;
}

/** Follow-up responsible: Call Center may name only themselves; must be an active Call Center agent or Owner. */
async function resolveResponsible(db: Queryable, principal: Principal, requested: string | undefined): Promise<string> {
  const id = requested ?? principal.employeeId;
  if (principal.role !== 'owner' && id !== principal.employeeId) throw permissionDenied();
  if (!(await isActiveCallingUser(db, id))) throw ruleViolation('The responsible person must be an active Call Center agent or the Owner', { field: 'responsibleId' });
  return id;
}

function futureTime(field: string, value: string): Date {
  const at = new Date(value);
  const now = clock.now().getTime();
  if (at.getTime() <= now) throw invalid(field, 'Must be in the future');
  // R2-11 / R3-09: no far-future callbacks (they would extend row-5 context access indefinitely).
  const maxDays = flags['followUps.maxScheduleDays'];
  if (at.getTime() > now + maxDays * 86_400_000) throw invalid(field, `Must be within ${maxDays} days`);
  return at;
}

/**
 * Schedule a follow-up; B3-Q04: when one is already open it is rescheduled (and/or reassigned)
 * instead of duplicated. Caller holds the calling-state lock.
 */
async function scheduleOrReschedule(
  ctx: CommandContext,
  principal: Principal,
  businessId: string,
  input: FollowUpInput,
  attemptId: string | null,
  field = 'followUp'
): Promise<{ row: FollowUpRow; rescheduled: boolean }> {
  const scheduledFor = futureTime(`${field}.scheduledFor`, input.scheduledFor);
  const responsibleId = await resolveResponsible(ctx.tx, principal, input.responsibleId);
  const now = clock.now();
  const open = await repo.findOpenFollowUp(ctx.tx, businessId, true);
  if (open) {
    const updated = await repo.rescheduleFollowUp(ctx.tx, open.id, {
      scheduledFor,
      responsibleId,
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      now,
    });
    await changeEvents(ctx, open, updated, null);
    return { row: updated, rescheduled: true };
  }
  const row = await repo.insertFollowUp(ctx.tx, {
    businessId,
    responsibleId,
    scheduledFor,
    purpose: input.purpose ?? null,
    createdBy: principal.employeeId,
    attemptId,
    now,
  });
  await repo.insertFollowUpChange(ctx.tx, { followUpId: row.id, kind: 'scheduled', newScheduledFor: scheduledFor, newResponsibleId: responsibleId, changedBy: principal.employeeId, now });
  await auditFollowUp(ctx, 'follow_up.scheduled', row);
  await emit(ctx, 'follow_up.scheduled', 'follow_up', row.id, { businessId });
  return { row, rescheduled: false };
}

/** History + audit + outbox for a reschedule and/or a change of responsible. */
async function changeEvents(ctx: CommandContext, before: FollowUpRow, after: FollowUpRow, reason: string | null): Promise<void> {
  const now = clock.now();
  const by = actorIdOf(ctx);
  if (before.scheduled_for.getTime() !== after.scheduled_for.getTime()) {
    await repo.insertFollowUpChange(ctx.tx, { followUpId: after.id, kind: 'rescheduled', oldScheduledFor: before.scheduled_for, newScheduledFor: after.scheduled_for, reason, changedBy: by, now });
    await auditFollowUp(ctx, 'follow_up.rescheduled', after, { before: { scheduledFor: before.scheduled_for.toISOString() }, reason });
    await emit(ctx, 'follow_up.rescheduled', 'follow_up', after.id, { businessId: after.business_id });
  }
  if (before.responsible_id !== after.responsible_id) {
    await repo.insertFollowUpChange(ctx.tx, { followUpId: after.id, kind: 'reassigned', oldResponsibleId: before.responsible_id, newResponsibleId: after.responsible_id, reason, changedBy: by, now });
    await auditFollowUp(ctx, 'follow_up.reassigned', after, { before: { responsibleId: before.responsible_id }, reason });
    await emit(ctx, 'follow_up.reassigned', 'follow_up', after.id, { businessId: after.business_id });
  }
}

async function completeRow(ctx: CommandContext, row: FollowUpRow, attemptId: string | null, note: string | null): Promise<FollowUpRow | null> {
  const now = clock.now();
  const done = await repo.completeFollowUp(ctx.tx, row.id, { attemptId, note, now });
  if (!done) return null;
  await repo.insertFollowUpChange(ctx.tx, { followUpId: row.id, kind: 'completed', changedBy: actorIdOf(ctx), now });
  await auditFollowUp(ctx, 'follow_up.completed', done, { before: { state: 'scheduled' } });
  await emit(ctx, 'follow_up.completed', 'follow_up', row.id, { businessId: row.business_id });
  return done;
}

async function cancelRow(
  ctx: CommandContext,
  row: FollowUpRow,
  source: 'user' | 'reassignment' | 'outcome_rejected',
  reason: string | null
): Promise<FollowUpRow | null> {
  const now = clock.now();
  const done = await repo.cancelFollowUp(ctx.tx, row.id, { reason, source, now });
  if (!done) return null;
  await repo.insertFollowUpChange(ctx.tx, { followUpId: row.id, kind: 'cancelled', reason, changedBy: actorIdOf(ctx), now });
  await auditFollowUp(ctx, 'follow_up.cancelled', done, { before: { state: 'scheduled' }, reason });
  await emit(ctx, 'follow_up.cancelled', 'follow_up', row.id, { businessId: row.business_id });
  return done;
}

function versionConflictWith(state: StateRow): HttpError {
  return new HttpError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', { currentVersion: state.version, current: stateDto(state) });
}

// ---------------------------------------------------------------------------
// Public ops for other modules
// ---------------------------------------------------------------------------

/**
 * BE2 calls this inside the business-insert transaction (ORCH-4 d): outcome Pending, Unassigned (C-02).
 * Accepts the transaction client or a CommandContext. Idempotent.
 */
export async function initCallingState(txOrCtx: Queryable | CommandContext, businessId: string): Promise<void> {
  const db = 'tx' in txOrCtx ? txOrCtx.tx : txOrCtx;
  await repo.insertState(db, businessId);
}

/** Read op (assignment eligibility, workspace): current calling state, `null` = never initialised (Pending). */
export async function callingStateOf(db: Queryable, businessId: string): Promise<CallingStateDto | null> {
  const row = await repo.findState(db, businessId);
  return row ? stateDto(row) : null;
}

/** Read op: the open follow-up of a business (OWN-008 impact preview). */
export async function openFollowUpOf(db: Queryable, businessId: string): Promise<FollowUpDto | null> {
  const row = await repo.findOpenFollowUp(db, businessId);
  return row ? (await followUpDtos(db, [row]))[0] : null;
}

/**
 * MOD-assignment, inside the reassign/unassign transaction (B3-Q03): one explicit choice per open
 * follow-up, no server default. The caller already holds the calling-state lock.
 * `toEmployeeId = null` (unassign) forbids `transfer`.
 */
export async function transferFollowUps(
  ctx: CommandContext,
  input: {
    businessId: string;
    fromEmployeeId: string;
    toEmployeeId: string | null;
    decisions: { followUpId: string; action: 'transfer' | 'cancel' | 'keep'; reason?: string }[];
  }
): Promise<{ warnings: string[] }> {
  const open = await repo.findOpenFollowUp(ctx.tx, input.businessId, true);
  const unknown = input.decisions.filter((d) => d.followUpId !== open?.id);
  if (unknown.length > 0) throw ruleViolation('A follow-up choice does not match the open follow-up', { followUpIds: unknown.map((d) => d.followUpId) });
  if (!open) return { warnings: [] };
  const choice = input.decisions.find((d) => d.followUpId === open.id);
  if (!choice) throw ruleViolation('Choose what happens to the open follow-up', { followUpId: open.id });
  if (choice.action === 'transfer') {
    if (!input.toEmployeeId) throw ruleViolation('A follow-up cannot be transferred when the business is unassigned', { followUpId: open.id });
    const updated = await repo.rescheduleFollowUp(ctx.tx, open.id, { scheduledFor: open.scheduled_for, responsibleId: input.toEmployeeId, now: clock.now() });
    await changeEvents(ctx, open, updated, 'calling reassignment');
    return { warnings: [] };
  }
  if (choice.action === 'cancel') {
    await cancelRow(ctx, open, 'reassignment', choice.reason ?? null);
    // D2: cancelling the last open follow-up of a Needs-another-call business sets the marker.
    const state = await repo.findState(ctx.tx, input.businessId, true);
    if (state && state.outcome === 'needs_another_call' && !state.callback_marker) {
      await repo.updateState(ctx.tx, input.businessId, {
        outcome: state.outcome,
        outcomeChanged: false,
        actorId: actorIdOf(ctx),
        rejectionReason: state.rejection_reason,
        callbackMarker: true,
        touch: false,
        now: clock.now(),
      });
      await auditMarker(ctx, input.businessId, true);
    }
    return { warnings: [] };
  }
  return { warnings: ['follow_up_kept_with_previous_responsible'] };
}

/** Deactivation open-items list (WF-EMP-001 M3), composed at the API edge by MOD-employees. */
export async function openItemsFor(db: Queryable, employeeId: string): Promise<{ type: 'follow_up'; id: string }[]> {
  const rows = await repo.openFollowUpsOf(db, employeeId);
  return rows.map((r) => ({ type: 'follow_up' as const, id: r.id }));
}

/** Batched `openItemsFor` (BE-LEAD V-02: one query for a page of employees). Count of open follow-ups per id. */
export async function openFollowUpCounts(db: Queryable, employeeIds: string[]): Promise<Map<string, number>> {
  const out = new Map(employeeIds.map((id) => [id, 0]));
  if (employeeIds.length === 0) return out;
  const { rows } = await db.query<{ responsible_id: string; n: string }>(
    `SELECT responsible_id, COUNT(*)::text AS n FROM follow_ups
     WHERE responsible_id = ANY($1::uuid[]) AND state = 'scheduled' GROUP BY responsible_id`,
    [employeeIds]
  );
  for (const r of rows) if (out.has(r.responsible_id)) out.set(r.responsible_id, Number(r.n));
  return out;
}

/** Guard registered with MOD-reservation for acquire (step 9). */
export async function acquireGuard(db: Queryable, businessId: string): Promise<void> {
  await assertBusinessOpen(db, businessId);
  const state = await repo.findState(db, businessId);
  if (state?.outcome === 'rejected') throw dncConflict();
}

export const resolveFollowUpBusiness = repo.businessOfFollowUp;
export const resolveAttemptBusiness = repo.businessOfAttempt;

// ---------------------------------------------------------------------------
// SEQ-11 / SEQ-13: log attempt + outcome (+ follow-up / D2 / E5 deal) in one transaction
// ---------------------------------------------------------------------------

export interface LogAttemptCommit {
  result: Omit<LogAttemptResultDto, 'reservation' | 'reservationLease'> & { reservation?: 'lost' };
  /** For the post-commit step (AR-03). Absent on the save-after-loss branch. */
  reservationId?: string;
  keepReservation: boolean;
}

async function validateAttemptInput(db: Queryable, body: LogAttempt): Promise<void> {
  if (body.outcome === 'accepted') {
    const min = await getSetting(db, 'calls.acceptedNoteMinLength');
    if (body.clientNeedsNote.trim().length < min) throw invalid('clientNeedsNote', `At least ${min} characters`);
  }
  if ((body.outcome === 'on_hold' || body.outcome === 'needs_another_call') && body.followUp) {
    futureTime('followUp.scheduledFor', body.followUp.scheduledFor);
  }
}

export async function logAttempt(ctx: CommandContext, body: LogAttempt, idempotencyKey: string): Promise<LogAttemptCommit> {
  const principal = principalOf(ctx);
  const now = clock.now();
  await validateAttemptInput(ctx.tx, body);
  if (await repo.findAttemptByKey(ctx.tx, principal.employeeId, idempotencyKey)) {
    throw stateConflict('This attempt was already saved', { reason: 'already_saved' });
  }
  // B7 + step 9: access and resource state first (refused in both save-after-loss branches).
  assertCallingAccess(await checkBusiness(ctx.tx, principal, 'call.log_attempt', body.businessId));
  await assertBusinessOpen(ctx.tx, body.businessId);
  const lease = await validateLease(ctx, { reservationId: body.reservationId, leaseToken: body.leaseToken, businessId: body.businessId });
  const state = await lockCallingState(ctx.tx, body.businessId);
  if (state.outcome === 'rejected') throw dncConflict();

  const outcomeNotes = {
    rejectionReason: body.outcome === 'rejected' ? body.rejectionReason : null,
    clientNeedsNote: body.outcome === 'accepted' ? body.clientNeedsNote : null,
    serviceInterest: body.outcome === 'accepted' ? body.serviceInterest ?? null : null,
  };
  const people = await employees(ctx.tx, [principal.employeeId]);

  // B3-Q05 (DEMO FLAG): the reservation was lost before this save.
  if (!lease.held) {
    if (saveAfterLossPolicy() === 'reject') throw reservationLost(lease.reason === 'not_found' ? 'token_mismatch' : lease.reason);
    // R2-12 / R3-08: save-after-loss covers a reservation THIS caller held on THIS business and lost
    // (elapsed, idle, max total, access, override, release). A caller who never held it is refused.
    const own = lease.row && lease.row.holder_id === principal.employeeId && lease.row.business_id === body.businessId;
    if (!own || lease.reason === 'not_found' || (lease.reason === 'token_mismatch' && lease.row?.state === 'active')) {
      throw reservationLost('token_mismatch');
    }
    const attempt = await repo.insertAttempt(ctx.tx, {
      businessId: body.businessId,
      agentId: principal.employeeId,
      reservationId: lease.row?.id ?? null,
      now,
      channel: body.channel,
      outcome: body.outcome,
      outcomeApplied: false,
      reservationHeld: false,
      notes: body.notes ?? null,
      ...outcomeNotes,
      fulfilsFollowUpId: null,
      idempotencyKey,
    });
    await repo.touch(ctx.tx, body.businessId, now);
    await audit(ctx, {
      eventName: 'call_attempt.logged',
      entityType: 'call_attempt',
      entityId: attempt.id,
      payload: { businessId: body.businessId, outcome: body.outcome, channel: body.channel, outcomeApplied: false, reservationLost: lease.reason },
    });
    const current = (await repo.findState(ctx.tx, body.businessId))!;
    return {
      result: {
        attempt: attemptDto(attempt, people),
        state: stateDto(current),
        followUp: null,
        completedFollowUpId: null,
        dealId: null,
        developerAssigned: false,
        cancelledFollowUpIds: [],
        reservation: 'lost',
        warning: 'outcome_not_applied',
      },
      keepReservation: false,
    };
  }

  if (state.version !== body.stateVersion) throw versionConflictWith(state);
  const from = state.outcome;
  const to: CallOutcome = body.outcome;
  // B3-Q12: agents cannot change Accepted; an attempt may still be logged with outcome accepted.
  if (from === 'accepted' && to !== 'accepted') {
    throw ruleViolation('An Accepted business cannot change outcome here; the Owner re-queues it after the deal is Not proceeding', { outcome: from });
  }
  const changed = from !== to;

  const attempt = await repo.insertAttempt(ctx.tx, {
    businessId: body.businessId,
    agentId: principal.employeeId,
    reservationId: lease.row.id,
    now,
    channel: body.channel,
    outcome: to,
    outcomeApplied: true,
    reservationHeld: true,
    notes: body.notes ?? null,
    ...outcomeNotes,
    fulfilsFollowUpId: body.fulfilsFollowUpId ?? null,
    idempotencyKey,
  });

  let completedFollowUpId: string | null = null;
  if (body.fulfilsFollowUpId) {
    const fu = await repo.findFollowUp(ctx.tx, body.fulfilsFollowUpId, true);
    if (!fu || fu.business_id !== body.businessId) throw ruleViolation('The follow-up does not belong to this business', { field: 'fulfilsFollowUpId' });
    if (fu.state === 'cancelled') throw stateConflict('This follow-up was cancelled', { followUpId: fu.id });
    if (fu.state === 'scheduled' && (await completeRow(ctx, fu, attempt.id, null))) completedFollowUpId = fu.id;
  }

  let followUp: FollowUpRow | null = null;
  let marker = false;
  let rejectionReason: string | null = null;
  const cancelled: string[] = [];
  let dealId: string | null = null;
  let developerAssigned = false;

  switch (body.outcome) {
    case 'on_hold':
      if (body.followUp) followUp = (await scheduleOrReschedule(ctx, principal, body.businessId, body.followUp, attempt.id)).row;
      break;
    case 'needs_another_call':
      if (body.followUp) {
        followUp = (await scheduleOrReschedule(ctx, principal, body.businessId, body.followUp, attempt.id)).row;
      } else {
        // D2 (DEMO): the marker means "no follow-up yet"; an open one must be rescheduled or completed instead.
        if (await repo.findOpenFollowUp(ctx.tx, body.businessId)) {
          throw ruleViolation('An open follow-up exists: reschedule it, or complete it in this save, instead of setting the marker', { field: 'callbackToBeScheduled' });
        }
        marker = true;
      }
      break;
    case 'rejected': {
      rejectionReason = body.rejectionReason;
      // D4 (DEMO): Rejected cancels the open follow-up in the same save.
      const open = await repo.findOpenFollowUp(ctx.tx, body.businessId, true);
      if (open && (await cancelRow(ctx, open, 'outcome_rejected', body.rejectionReason))) cancelled.push(open.id);
      break;
    }
    case 'accepted':
      // D4 (DEMO): Accepted keeps open follow-ups. E5: the deal is created in this transaction.
      if (changed) {
        const r = await opportunities().createAcceptedOpportunity(ctx, {
          businessId: body.businessId,
          callAttemptId: attempt.id,
          acceptingAgentId: principal.employeeId,
          clientNeedsNote: body.clientNeedsNote,
          ...(body.serviceInterest ? { serviceInterest: body.serviceInterest } : {}),
          ...(body.developerId ? { developerId: body.developerId } : {}),
        });
        dealId = r.dealId;
        developerAssigned = Boolean(body.developerId);
      }
      break;
  }

  const updated = await repo.updateState(ctx.tx, body.businessId, {
    outcome: to,
    outcomeChanged: changed,
    actorId: principal.employeeId,
    rejectionReason,
    callbackMarker: marker,
    touch: true,
    now,
  });

  await audit(ctx, {
    eventName: 'call_attempt.logged',
    entityType: 'call_attempt',
    entityId: attempt.id,
    payload: { businessId: body.businessId, outcome: to, channel: body.channel, outcomeApplied: true },
  });
  if (changed) {
    await audit(ctx, {
      eventName: 'call_outcome.changed',
      entityType: 'business',
      entityId: body.businessId,
      payload: { attemptId: attempt.id, ...(dealId ? { dealId } : {}) },
      before: { outcome: from },
      after: { outcome: to },
      reason: rejectionReason,
    });
    await emit(ctx, 'call_outcome.changed', 'business', body.businessId, { from, to, attemptId: attempt.id });
  }
  if (state.callback_marker !== marker) await auditMarker(ctx, body.businessId, marker);

  const followUpDto = followUp ? (await followUpDtos(ctx.tx, [followUp]))[0] : null;
  return {
    result: {
      attempt: attemptDto(attempt, people),
      state: stateDto(updated),
      followUp: followUpDto,
      completedFollowUpId,
      dealId,
      developerAssigned,
      cancelledFollowUpIds: cancelled,
    },
    reservationId: lease.row.id,
    keepReservation: body.keepReservation,
  };
}

/**
 * B3-Q10 (DEMO) inbound do-not-call outside a call: separate route (ORCH-4 b), no reservation.
 * Assignee or Owner; cancels the open follow-up (D4) and clears the D2 marker.
 */
export async function logInboundRejection(ctx: CommandContext, body: InboundRejection, idempotencyKey: string) {
  const principal = principalOf(ctx);
  const now = clock.now();
  if (await repo.findAttemptByKey(ctx.tx, principal.employeeId, idempotencyKey)) {
    throw stateConflict('This attempt was already saved', { reason: 'already_saved' });
  }
  assertCallingAccess(await checkBusiness(ctx.tx, principal, 'call.log_attempt', body.businessId));
  await assertBusinessOpen(ctx.tx, body.businessId);
  const state = await lockCallingState(ctx.tx, body.businessId);
  if (state.outcome === 'rejected') throw dncConflict();
  if (state.version !== body.stateVersion) throw versionConflictWith(state);
  if (state.outcome === 'accepted') {
    throw ruleViolation('An Accepted business cannot change outcome here; the Owner re-queues it after the deal is Not proceeding', { outcome: state.outcome });
  }
  const attempt = await repo.insertAttempt(ctx.tx, {
    businessId: body.businessId,
    agentId: principal.employeeId,
    reservationId: null,
    now,
    channel: 'inbound_other',
    outcome: 'rejected',
    outcomeApplied: true,
    reservationHeld: false,
    notes: body.notes ?? null,
    rejectionReason: body.rejectionReason,
    clientNeedsNote: null,
    serviceInterest: null,
    fulfilsFollowUpId: null,
    idempotencyKey,
  });
  const cancelled: string[] = [];
  const open = await repo.findOpenFollowUp(ctx.tx, body.businessId, true);
  if (open && (await cancelRow(ctx, open, 'outcome_rejected', body.rejectionReason))) cancelled.push(open.id);
  const updated = await repo.updateState(ctx.tx, body.businessId, {
    outcome: 'rejected',
    outcomeChanged: true,
    actorId: principal.employeeId,
    rejectionReason: body.rejectionReason,
    callbackMarker: false,
    touch: true,
    now,
  });
  await audit(ctx, {
    eventName: 'call_attempt.logged',
    entityType: 'call_attempt',
    entityId: attempt.id,
    payload: { businessId: body.businessId, outcome: 'rejected', channel: 'inbound_other', outcomeApplied: true },
  });
  await audit(ctx, {
    eventName: 'call_outcome.changed',
    entityType: 'business',
    entityId: body.businessId,
    payload: { attemptId: attempt.id, inbound: true },
    before: { outcome: state.outcome },
    after: { outcome: 'rejected' },
    reason: body.rejectionReason,
  });
  await emit(ctx, 'call_outcome.changed', 'business', body.businessId, { from: state.outcome, to: 'rejected', attemptId: attempt.id });
  if (state.callback_marker) await auditMarker(ctx, body.businessId, false);
  return {
    attempt: attemptDto(attempt, await employees(ctx.tx, [principal.employeeId])),
    state: stateDto(updated),
    cancelledFollowUpIds: cancelled,
  };
}

// ---------------------------------------------------------------------------
// DEC-016 reopen / B3-Q12 re-queue (Owner + 2FA, reason)
// ---------------------------------------------------------------------------
async function reopenOrRequeue(ctx: CommandContext, businessId: string, body: z.infer<typeof ReopenBody>, kind: 'reopen' | 'requeue'): Promise<ReopenResultDto> {
  const principal = principalOf(ctx);
  const action = kind === 'reopen' ? 'business.reopen_rejected' : 'business.requeue';
  assertAllowed(await access.check(ctx.tx, principal, action as Action, { type: 'business', id: businessId }));
  await assertBusinessOpen(ctx.tx, businessId);
  const state = await lockCallingState(ctx.tx, businessId);
  const required = kind === 'reopen' ? 'rejected' : 'accepted';
  if (state.outcome !== required) {
    throw stateConflict(kind === 'reopen' ? 'Only a Rejected business can be reopened' : 'Only an Accepted business can be re-queued', { outcome: state.outcome });
  }
  if (state.version !== body.stateVersion) throw versionConflictWith(state);
  if (kind === 'requeue' && !(await opportunities().dealIsNotProceeding(ctx.tx, businessId))) {
    throw stateConflict('Re-queue is possible only after the deal is marked Not proceeding', { reason: 'deal_open' });
  }
  const now = clock.now();
  const updated = await repo.updateState(ctx.tx, businessId, {
    outcome: 'pending',
    outcomeChanged: true,
    actorId: principal.employeeId,
    rejectionReason: null,
    callbackMarker: false,
    touch: false,
    now,
  });
  const reopeningId = await repo.insertReopening(ctx.tx, { businessId, kind, previous: state.outcome, reason: body.reason, by: principal.employeeId, now });
  await audit(ctx, {
    // Placeholder names (G2): call_outcome.reopened / call_outcome.requeued.
    eventName: kind === 'reopen' ? 'call_outcome.reopened' : 'call_outcome.requeued',
    entityType: 'business',
    entityId: businessId,
    payload: { reopeningId },
    before: { outcome: state.outcome },
    after: { outcome: 'pending' },
    reason: body.reason,
  });
  await emit(ctx, 'call_outcome.changed', 'business', businessId, { from: state.outcome, to: 'pending', reopeningId });
  return { state: stateDto(updated), reopeningId };
}

export const reopenRejected = (ctx: CommandContext, businessId: string, body: z.infer<typeof ReopenBody>) => reopenOrRequeue(ctx, businessId, body, 'reopen');
export const requeueAccepted = (ctx: CommandContext, businessId: string, body: z.infer<typeof ReopenBody>) => reopenOrRequeue(ctx, businessId, body, 'requeue');

// ---------------------------------------------------------------------------
// Follow-up commands (/api/follow-ups)
// ---------------------------------------------------------------------------

/** POST /api/follow-ups — B3-Q04: an open follow-up is rescheduled instead of duplicated. Clears the D2 marker. */
export async function createFollowUp(ctx: CommandContext, body: z.infer<typeof CreateFollowUpBody>): Promise<FollowUpCommandResultDto> {
  const principal = principalOf(ctx);
  assertCallingAccess(await checkBusiness(ctx.tx, principal, 'follow_up.create', body.businessId));
  await assertBusinessOpen(ctx.tx, body.businessId);
  const state = await lockCallingState(ctx.tx, body.businessId);
  if (state.outcome === 'rejected') throw dncConflict();
  const r = await scheduleOrReschedule(
    ctx,
    principal,
    body.businessId,
    { scheduledFor: body.scheduledFor, ...(body.purpose !== undefined ? { purpose: body.purpose } : {}), ...(body.responsibleId ? { responsibleId: body.responsibleId } : {}) },
    null,
    'followUp'
  );
  let newState: StateRow | undefined;
  const now = clock.now();
  if (state.callback_marker) {
    newState = await repo.updateState(ctx.tx, body.businessId, {
      outcome: state.outcome,
      outcomeChanged: false,
      actorId: principal.employeeId,
      rejectionReason: state.rejection_reason,
      callbackMarker: false,
      touch: true,
      now,
    });
    await auditMarker(ctx, body.businessId, false);
  } else {
    await repo.touch(ctx.tx, body.businessId, now);
  }
  return {
    followUp: (await followUpDtos(ctx.tx, [r.row]))[0],
    rescheduled: r.rescheduled,
    ...(newState ? { state: stateDto(newState) } : {}),
  };
}

/** Load a follow-up for a command: access check on it (B7), then the lock order state → follow-up. */
async function loadForCommand(ctx: CommandContext, id: string, action: string): Promise<{ principal: Principal; state: StateRow; row: FollowUpRow }> {
  const principal = principalOf(ctx);
  const peek = await repo.findFollowUp(ctx.tx, id);
  if (!peek) throw notFound();
  assertCallingAccess(await access.check(ctx.tx, principal, action as Action, { type: 'follow_up', id }));
  const state = await lockCallingState(ctx.tx, peek.business_id);
  const row = (await repo.findFollowUp(ctx.tx, id, true))!;
  return { principal, state, row };
}

/** PATCH /api/follow-ups/:id — reschedule and/or change responsible (responsible, assignee or Owner). */
export async function updateFollowUp(ctx: CommandContext, id: string, body: z.infer<typeof UpdateFollowUpBody>): Promise<FollowUpCommandResultDto> {
  const { principal, state, row } = await loadForCommand(ctx, id, 'follow_up.reschedule');
  if (state.outcome === 'rejected') throw dncConflict();
  if (row.state !== 'scheduled') throw stateConflict('Only a scheduled follow-up can be changed', { state: row.state });
  if (row.version !== body.version) throw new HttpError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', { currentVersion: row.version });
  const scheduledFor = body.scheduledFor ? futureTime('scheduledFor', body.scheduledFor) : row.scheduled_for;
  const responsibleId =
    body.responsibleId && body.responsibleId !== row.responsible_id ? await resolveResponsible(ctx.tx, principal, body.responsibleId) : row.responsible_id;
  const updated = await repo.rescheduleFollowUp(ctx.tx, row.id, { scheduledFor, responsibleId, now: clock.now() });
  await changeEvents(ctx, row, updated, body.reason ?? null);
  return { followUp: (await followUpDtos(ctx.tx, [updated]))[0], rescheduled: true };
}

/**
 * D2 (DEMO): closing the last open follow-up of a Needs-another-call business needs a replacement
 * follow-up or the "callback to be scheduled" marker in the same save.
 */
async function applyReplacement(
  ctx: CommandContext,
  principal: Principal,
  state: StateRow,
  replacement: z.infer<typeof CompleteFollowUpBody>['replacement']
): Promise<{ followUp: FollowUpRow | null; state: StateRow | undefined }> {
  if (state.outcome === 'needs_another_call' && !replacement) {
    throw ruleViolation('This is the last open follow-up of a Needs another call business: add a new follow-up or mark "callback to be scheduled"', {
      code: 'D2_REPLACEMENT_REQUIRED',
    });
  }
  if (!replacement) return { followUp: null, state: undefined };
  if (replacement === 'callback_to_be_scheduled') {
    if (state.callback_marker) return { followUp: null, state: undefined };
    const updated = await repo.updateState(ctx.tx, state.business_id, {
      outcome: state.outcome,
      outcomeChanged: false,
      actorId: principal.employeeId,
      rejectionReason: state.rejection_reason,
      callbackMarker: true,
      touch: false,
      now: clock.now(),
    });
    await auditMarker(ctx, state.business_id, true);
    return { followUp: null, state: updated };
  }
  const r = await scheduleOrReschedule(ctx, principal, state.business_id, replacement, null, 'replacement');
  return { followUp: r.row, state: undefined };
}

async function assertMayClose(principal: Principal, row: FollowUpRow): Promise<void> {
  // Design §7: complete/cancel = responsible or Owner.
  if (principal.role !== 'owner' && row.responsible_id !== principal.employeeId) throw permissionDenied();
}

/** POST /api/follow-ups/:id/complete */
export async function completeFollowUp(ctx: CommandContext, id: string, body: z.infer<typeof CompleteFollowUpBody>) {
  const { principal, state, row } = await loadForCommand(ctx, id, 'follow_up.complete');
  await assertMayClose(principal, row);
  if (row.state === 'completed') return { followUp: (await followUpDtos(ctx.tx, [row]))[0], replacement: null, state: stateDto(state) };
  if (row.state === 'cancelled') throw stateConflict('This follow-up was cancelled', { state: row.state });
  if (row.version !== body.version) throw new HttpError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', { currentVersion: row.version });
  if (!body.attemptId && !body.completionNote) throw invalid('completionNote', 'Link the call attempt or add a completion note');
  if (body.attemptId) {
    const a = await repo.findAttempt(ctx.tx, body.attemptId);
    if (!a || a.business_id !== row.business_id) throw ruleViolation('The attempt does not belong to this business', { field: 'attemptId' });
  }
  const done = (await completeRow(ctx, row, body.attemptId ?? null, body.completionNote ?? null))!;
  const rep = await applyReplacement(ctx, principal, state, body.replacement);
  const dtos = await followUpDtos(ctx.tx, rep.followUp ? [done, rep.followUp] : [done]);
  return { followUp: dtos[0], replacement: dtos[1] ?? null, state: stateDto(rep.state ?? state) };
}

/** POST /api/follow-ups/:id/cancel */
export async function cancelFollowUp(ctx: CommandContext, id: string, body: z.infer<typeof CancelFollowUpBody>) {
  const { principal, state, row } = await loadForCommand(ctx, id, 'follow_up.cancel');
  await assertMayClose(principal, row);
  if (row.state === 'cancelled') return { followUp: (await followUpDtos(ctx.tx, [row]))[0], replacement: null, state: stateDto(state) };
  if (row.state === 'completed') throw stateConflict('This follow-up was completed', { state: row.state });
  if (row.version !== body.version) throw new HttpError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', { currentVersion: row.version });
  const done = (await cancelRow(ctx, row, 'user', body.reason))!;
  const rep = await applyReplacement(ctx, principal, state, body.replacement);
  const dtos = await followUpDtos(ctx.tx, rep.followUp ? [done, rep.followUp] : [done]);
  return { followUp: dtos[0], replacement: dtos[1] ?? null, state: stateDto(rep.state ?? state) };
}

// ---------------------------------------------------------------------------
// Post-commit step after a call save (AR-03, U-01): separate transaction, never fails the save
// ---------------------------------------------------------------------------

/**
 * Runs AFTER the save transaction committed. U-01 (APPROVED: "Accepted keeps reservation"): with
 * keepReservation the lease is renewed (allowed for every outcome except Rejected); otherwise the
 * reservation is released with reason `call_saved`. Any failure is reported, never thrown.
 */
export async function finishSave(
  run: <T>(fn: (ctx: CommandContext) => Promise<T>) => Promise<T>,
  commit: LogAttemptCommit
): Promise<LogAttemptResultDto> {
  const base = commit.result;
  if (base.reservation === 'lost' || !commit.reservationId) return { ...base, reservation: 'lost' };
  const reservationId = commit.reservationId;
  try {
    if (commit.keepReservation && canKeepReservation(base.attempt.outcome)) {
      const lease = await run((ctx) => keepAfterSave(ctx, reservationId));
      return lease ? { ...base, reservation: 'kept', reservationLease: lease } : { ...base, reservation: 'lost' };
    }
    await run((ctx) => endAfterSave(ctx, reservationId));
    return { ...base, reservation: 'released' };
  } catch (err) {
    console.error('calls: post-commit reservation step failed', { reservationId, error: (err as Error).message });
    return { ...base, reservation: 'release_failed' };
  }
}

// ---------------------------------------------------------------------------
// Reads: queue (CC-001), workspace (CC-002), do-not-call (CC-008), opportunities (CC-007), calendar (CC-004)
// ---------------------------------------------------------------------------

async function companyTz(db: Queryable): Promise<string> {
  const tz = await getSetting(db, 'company.timezone');
  return typeof tz === 'string' && tz ? tz : 'UTC';
}

const emptyCounts = (): Record<QueueBucket, number> =>
  Object.fromEntries(QUEUE_BUCKETS.map((b) => [b, 0])) as Record<QueueBucket, number>;

/** GET /api/calling/queue — CC: own queue (Asg) only; Owner: all agents or `agentId`. Counted after scopeFilter. */
export async function queue(db: Queryable, principal: Principal, q: z.infer<typeof QueueQuery>): Promise<QueueDto> {
  if (q.agentId && principal.role !== 'owner' && q.agentId !== principal.employeeId) throw permissionDenied();
  const agentId = principal.role === 'owner' ? q.agentId ?? null : principal.employeeId;
  const params = new SqlParams();
  const where = [access.scopeFilter(principal, 'calling.queue.read', 'business', { alias: 'b', params })];
  if (agentId) where.push(`ca.assignee_id = ${params.add(agentId)}::uuid`);
  const ph = {
    now: `${params.add(clock.now().toISOString())}::timestamptz`,
    tz: `${params.add(await companyTz(db))}::text`,
    overdue: `${params.add(await getSetting(db, 'followUps.overdueMinutes'))}::int`,
  };
  const cte = repo.queueCte(where, ph);
  const countsMap = await repo.queueCounts(db, cte, [...params.values]);
  const counts = emptyCounts();
  for (const [k, n] of countsMap) if (k in counts) counts[k as QueueBucket] = n;
  const total = q.bucket ? counts[q.bucket] : Object.values(counts).reduce((a, b) => a + b, 0);

  const filter = q.bucket ? `WHERE bucket = ${params.add(q.bucket)}` : '';
  const order = orderByClause(q, { businessName: 'business_name', nextAction: 'next_action_at', lastAttemptAt: 'last_attempt_at' }, 'nextAction');
  const tail = `${filter} ${order} NULLS LAST, business_id ${pageClause(q, params)}`;
  const rows = await repo.queuePage(db, cte, tail, params.values);
  const holders = await liveHolders(db, rows.map((r) => r.business_id));
  return {
    items: rows.map((r) => {
      const holder = holders.get(r.business_id);
      return {
        businessId: r.business_id,
        businessName: r.business_name,
        bucket: r.bucket as QueueBucket,
        outcome: r.outcome,
        callbackMarker: r.callback_marker,
        openFollowUp: r.fu_id && r.fu_at && r.fu_responsible ? { id: r.fu_id, scheduledFor: r.fu_at.toISOString(), responsibleId: r.fu_responsible } : null,
        nextActionAt: iso(r.next_action_at),
        lastAttemptAt: iso(r.last_attempt_at),
        attemptCount: r.attempt_count,
        reservedByOther: Boolean(holder && holder !== principal.employeeId),
        reservedByMe: holder === principal.employeeId,
        assigneeId: r.assignee_id,
        assignedAt: r.assigned_at.toISOString(),
      };
    }),
    page: q.page,
    pageSize: q.pageSize,
    total,
    counts,
    agentId,
  };
}

/** Calling state for display: a missing row is the initial Pending state (version 1, as initCallingState creates it). */
function stateOrInitial(row: StateRow | null, businessId: string): CallingStateDto {
  return row
    ? stateDto(row)
    : { businessId, outcome: 'pending', outcomeChangedAt: null, rejectionReason: null, callbackMarker: false, lastTouchpointAt: null, version: 1 };
}

/**
 * GET /api/calling/businesses/:id/workspace — CC-002. Access: full/owner, or DEC-002 row 5 (scheduled callback).
 * Returns `{ dto, ownerViewedHidden }`; the route audits an Owner hidden read (OI-05).
 */
export async function workspace(db: Queryable, principal: Principal, businessId: string): Promise<{ dto: WorkspaceDto; ownerViewedHidden: boolean }> {
  const decision = await access.check(db, principal, 'calling.queue.read', { type: 'business', id: businessId });
  assertCallingAccess(decision);
  assertAllowed(decision);
  const info = (await businessInfo(db, [businessId])).get(businessId);
  if (!info) throw notFound();
  const [stateRow, assignment, reservation, openFu, attempts] = await Promise.all([
    repo.findState(db, businessId),
    repo.openAssignment(db, businessId),
    activeFor(db, businessId),
    repo.findOpenFollowUp(db, businessId),
    repo.listAttempts(db, businessId, 50),
  ]);
  const state = stateOrInitial(stateRow, businessId);
  const names = await employees(db, [assignment?.assignee_id ?? null, ...attempts.map((a) => a.agent_id)]);
  const resState: WorkspaceDto['reservation']['state'] = !reservation ? 'none' : reservation.holderId === principal.employeeId ? 'mine' : 'other';
  const outcomes: CallOutcome[] = state.outcome === 'rejected' ? [] : state.outcome === 'accepted' ? ['accepted'] : [...CALL_OUTCOMES];
  const contactable = state.outcome !== 'rejected' && !info.archived;
  const keep = Object.fromEntries(CALL_OUTCOMES.map((o) => [o, canKeepReservation(o)])) as Record<CallOutcome, boolean>;
  const isOwner = principal.role === 'owner';
  return {
    ownerViewedHidden: Boolean(decision.ownerViewedHidden),
    dto: {
      businessId,
      businessName: info.name,
      archived: info.archived,
      access: { level: decision.level, exceptionRow: decision.exceptionRow ?? null },
      state,
      assignment: assignment
        ? {
            assigneeId: assignment.assignee_id,
            assigneeName: names.get(assignment.assignee_id)?.name ?? '',
            assignedAt: assignment.started_at.toISOString(),
            isMe: assignment.assignee_id === principal.employeeId,
          }
        : null,
      reservation: {
        state: resState,
        id: reservation?.id ?? null,
        holderName: reservation?.holderName ?? null,
        acquiredAt: reservation ? reservation.acquiredAt.toISOString() : null,
        leaseExpiresAt: reservation ? reservation.leaseExpiresAt.toISOString() : null,
      },
      openFollowUp: openFu ? (await followUpDtos(db, [openFu]))[0] : null,
      attempts: attempts.map((a) => attemptDto(a, names)),
      allowed: {
        startContact: contactable && resState !== 'other',
        logAttempt: contactable && resState === 'mine',
        keepReservation: keep,
        outcomes,
        reopen: isOwner && state.outcome === 'rejected',
        requeue: isOwner && state.outcome === 'accepted',
      },
      policy: {
        acceptedNoteMinLength: await getSetting(db, 'calls.acceptedNoteMinLength'),
        heartbeatSeconds: await getSetting(db, 'reservation.heartbeatSeconds'),
        saveAfterReservationLoss: saveAfterLossPolicy(),
        label: DEMO_LABEL,
      },
    },
  };
}

/** GET /api/calling/do-not-call — CC-008. Rejected businesses the caller may see (scopeFilter before count). */
export async function doNotCall(db: Queryable, principal: Principal, q: z.infer<typeof DoNotCallQuery>): Promise<PageResult<DoNotCallItemDto>> {
  const params = new SqlParams();
  const where = [access.scopeFilter(principal, 'call_attempt.list_do_not_call', 'business', { alias: 'b', params })];
  if (q.q) where.push(`b.name ILIKE ${params.add(`%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)}`);
  const countValues = [...params.values];
  const order = orderByClause(q, { businessName: 'b.name', rejectedAt: 's.outcome_changed_at' }, 'rejectedAt');
  const tail = `${order} NULLS LAST, b.id ${pageClause(q, params)}`;
  const { rows, total } = await repo.listDoNotCall(db, where, countValues, tail, params.values.slice(countValues.length));
  const names = await employees(db, rows.flatMap((r) => [r.rejected_by, r.assignee_id]));
  return toPage(
    rows.map((r) => ({
      businessId: r.business_id,
      businessName: r.business_name,
      rejectedAt: iso(r.rejected_at),
      rejectionReason: r.rejection_reason,
      rejectedById: r.rejected_by,
      rejectedByName: r.rejected_by ? names.get(r.rejected_by)?.name ?? null : null,
      assigneeId: r.assignee_id,
      assigneeName: r.assignee_id ? names.get(r.assignee_id)?.name ?? null : null,
      attemptCount: r.attempt_count,
      stateVersion: r.version,
    })),
    total,
    q
  );
}

/**
 * GET /api/calling/opportunities — CC-007. Deals come from the BE4 read op (scopeFilter on `deal.read`, so hidden
 * businesses are omitted and not counted, OI-07); each row is enriched with the accepting attempt's notes.
 */
export async function listOpportunityItems(db: Queryable, principal: Principal, q: z.infer<typeof OpportunitiesQuery>): Promise<OpportunitiesDto> {
  // CC-007 lists accepted opportunities only: closed and not-proceeding deals are not opportunities.
  const page = await opportunities().listOpportunities(db, principal, {
    page: q.page,
    pageSize: q.pageSize,
    openOnly: true,
    ...(q.developerAssigned !== undefined ? { developerAssigned: q.developerAssigned } : {}),
  });
  const attempts = await repo.latestAcceptedAttempts(db, page.items.map((d) => d.businessId));
  const names = await employees(db, page.items.map((d) => d.acceptedById));
  const decisions = await access.checkMany(
    db,
    principal,
    'call_attempt.list_opportunities',
    page.items.map((d) => ({ type: 'business' as const, id: d.businessId }))
  );
  const firstMeetings = await firstMeetingAtByDeal(db, page.items.map((d) => d.dealId));
  return {
    items: page.items.map((d) => {
      const a = attempts.get(d.businessId);
      const dec = decisions.get(d.businessId);
      return {
        businessId: d.businessId,
        businessName: d.businessName ?? '',
        acceptedAt: d.acceptedAt,
        acceptedById: d.acceptedById,
        acceptedByName: names.get(d.acceptedById)?.name ?? null,
        attemptId: a?.id ?? null,
        clientNeedsNote: a?.client_needs_note ?? null,
        serviceInterest: a?.service_interest ?? null,
        callNotes: a?.notes ?? null,
        deal: { dealId: d.dealId, stage: d.stage, developerId: d.assignedDeveloperId, developerName: d.assignedDeveloperName, firstMeetingAt: firstMeetings.get(d.dealId) ?? null },
        accessLevel: dec && dec.allowed ? dec.level : 'context_limited',
      };
    }),
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    dealInfoAvailable: true,
  };
}

const CALENDAR_CAP = 1000;

/**
 * GET /api/follow-ups — CC: own responsibility only (matrix §3.7), Owner: all or `responsibleId`.
 * Rows also pass scopeFilter on `follow_up` (hidden businesses omitted and not counted). With `from`/`to` the
 * whole range is returned (calendar, max 62 days, capped at 1000 rows) instead of a page.
 */
export async function listFollowUpItems(db: Queryable, principal: Principal, q: z.infer<typeof ListFollowUpsQuery>): Promise<PageResult<FollowUpDto>> {
  if (q.responsibleId && principal.role !== 'owner' && q.responsibleId !== principal.employeeId) throw permissionDenied();
  const params = new SqlParams();
  const where = [access.scopeFilter(principal, 'follow_up.read', 'follow_up', { alias: 'fu', params, idColumn: 'business_id' })];
  const responsible = principal.role === 'owner' ? q.responsibleId : principal.employeeId;
  if (responsible) where.push(`fu.responsible_id = ${params.add(responsible)}::uuid`);
  if (q.state) where.push(`fu.state = ${params.add(q.state)}`);
  if (q.from && q.to) where.push(`fu.scheduled_for >= ${params.add(q.from)}::timestamptz AND fu.scheduled_for < ${params.add(q.to)}::timestamptz`);
  const countValues = [...params.values];
  const order = orderByClause(q, { scheduledFor: 'fu.scheduled_for', businessName: 'b.name' }, 'scheduledFor');
  const calendar = Boolean(q.from && q.to);
  const paging = calendar ? `LIMIT ${params.add(CALENDAR_CAP)}` : pageClause(q, params);
  const { rows, total } = await repo.listFollowUps(db, where, countValues, `${order}, fu.id ${paging}`, params.values.slice(countValues.length));
  const items = await followUpDtos(db, rows);
  return calendar ? { items, page: 1, pageSize: items.length, total } : toPage(items, total, q);
}
