/**
 * MOD-meetings — service (SM-MEETING-001). Owner: BE4. Design: docs/implementation/delivery-design.md §6.
 *
 * States: scheduled, held, cancelled, missed (Missed = Proposed state R-13). Reschedule is an event
 * (self-transition, `reschedule_count`, `meeting_changes` before/after), allowed from scheduled and
 * missed (missed returns to scheduled). held/missed need the start time reached; cancel needs a reason
 * and is final; a held meeting only accepts notes amendments. Times are never in the past on
 * create/reschedule; at least one attendee (checked here, same transaction).
 *
 * Access goes through the deal's business (OI-29: attendance grants nothing). Developers act on
 * meetings only when `deals.developerPreClosure = assigned` and they are the deal's assigned Developer
 * (DEC-005). Every pending policy is "Demonstration alternative — not approved (docs/policy-defaults.md)".
 * One command = one transaction: lock, access.check, guards, change, meeting_changes, audit, outbox E-06.
 */
import type { Queryable } from '../../db/pool.js';
import { access, type Principal } from '../../shared/access.js';
import { HttpError, notFound, permissionDenied, ruleViolation, stateConflict, versionConflict } from '../../shared/errors.js';
import { outbox, type DeliveredEvent, type OutboxEventName } from '../../shared/outbox.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import {
  actorIdOf,
  assertActiveEmployee,
  assignDeveloper,
  authorize,
  businessNames,
  deliveryPolicy,
  developerMayActOnDeal,
  developerMayReadDeal,
  employeeNames,
  getDealSummaries,
  getDealSummary,
  inSequence,
  iso,
  principalOf,
  type DealSummary,
} from '../deals/service.js';
import * as repo from './repo.js';
import type { MeetingRow } from './repo.js';
import type { MeetingDto, MeetingStatus } from './schemas.js';
import { findOpenForBusiness } from '../deals/repo.js';
import { OPEN_DEAL_STAGES as DEAL_OPEN_STAGES } from '../deals/schemas.js';

/** D16: every open deal stage (incl. meeting scheduled / proposal sent), from the deals stage list. */
const OPEN_DEAL_STAGES = new Set<string>(DEAL_OPEN_STAGES);

/** Reason written on meetings cancelled because their deal stopped (delivery-design §6). */
export const DEAL_NOT_PROCEEDING_REASON = 'Deal not proceeding';

// ---------------------------------------------------------------------------
// Resolver + helpers
// ---------------------------------------------------------------------------
/** Access resolver for `meeting` (BE2-C1): the business stored on the meeting (copied from its deal). */
/**
 * BL-11 read op for CC-007: the earliest meeting of each deal that is still scheduled (or the first
 * held one when none is scheduled), one query. Callers have already authorized the deals.
 */
export async function firstMeetingAtByDeal(db: Queryable, dealIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(dealIds)];
  if (ids.length === 0) return out;
  const { rows } = await db.query<{ deal_id: string; starts_at: Date }>(
    `SELECT DISTINCT ON (deal_id) deal_id, starts_at FROM meetings
      WHERE deal_id = ANY($1::uuid[]) AND status IN ('scheduled', 'held')
      ORDER BY deal_id, (status = 'scheduled') DESC, starts_at`,
    [ids]
  );
  for (const r of rows) out.set(r.deal_id, r.starts_at.toISOString());
  return out;
}

export async function resolveMeetingBusiness(db: Queryable, id: string): Promise<string | null> {
  const m = await repo.findById(db, id);
  return m ? m.business_id : null;
}

/** Who may change a meeting once `access.check` passed: Owner, Call Center, or the assigned Developer (DEC-005). */
function mayAct(p: Principal, deal: Pick<DealSummary, 'assignedDeveloperId'>): boolean {
  if (p.role === 'owner' || p.role === 'call_center') return true;
  return developerMayActOnDeal(p, deal);
}

function assertMayAct(p: Principal, deal: DealSummary): void {
  if (!mayAct(p, deal)) throw permissionDenied();
}

/** BL-09: a stale version answers 409 with `details.current` = the meeting as this caller may see it. */
async function assertVersion(ctx: CommandContext, m: MeetingRow, version: number): Promise<void> {
  if (m.version !== version) throw versionConflict(m.version, await result(ctx, m));
}

function assertNotPast(ctx: CommandContext, startsAt: string, endsAt: string | null | undefined): void {
  const start = Date.parse(startsAt);
  if (start < ctx.now.getTime()) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { startsAt: ['The meeting time must not be in the past'] });
  }
  if (endsAt && Date.parse(endsAt) <= start) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { endsAt: ['The end must be after the start'] });
  }
}

async function assertAttendees(ctx: CommandContext, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { attendeeIds: ['At least one attendee'] });
  }
  for (const [i, id] of unique.entries()) await assertActiveEmployee(ctx.tx, id, `attendeeIds.${i}`);
  return unique;
}

const scheduleOf = (m: MeetingRow, attendeeIds: string[]) => ({
  startsAt: iso(m.starts_at),
  endsAt: iso(m.ends_at),
  location: m.location,
  attendeeIds,
});

async function save(ctx: CommandContext, m: MeetingRow, set: Partial<Record<repo.MeetingColumn, unknown>>): Promise<MeetingRow> {
  const next = await repo.updateMeeting(ctx.tx, m.id, m.version, set, ctx.now);
  if (!next) {
    const cur = await repo.findById(ctx.tx, m.id);
    if (!cur) throw notFound();
    throw versionConflict(cur.version, await result(ctx, cur));
  }
  return next;
}

async function emit(ctx: CommandContext, name: OutboxEventName, m: MeetingRow): Promise<void> {
  await outbox.emit(ctx.tx, {
    name,
    aggregateType: 'meeting',
    aggregateId: m.id,
    payload: { meetingId: m.id, dealId: m.deal_id, startsAt: iso(m.starts_at) },
  });
}

/** Lock the meeting, check access through its business, load the deal summary. */
async function lockAndAuthorize(ctx: CommandContext, id: string, action: string): Promise<{ m: MeetingRow; deal: DealSummary }> {
  const m = await repo.findById(ctx.tx, id, true);
  if (!m) throw notFound();
  await authorize(ctx, action, { type: 'meeting', id });
  const deal = await getDealSummary(ctx.tx, m.deal_id);
  if (!deal) throw notFound();
  assertMayAct(principalOf(ctx), deal);
  return { m, deal };
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------
async function toDtos(db: Queryable, p: Principal, rows: MeetingRow[], now: Date): Promise<MeetingDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [attendees, deals, biz] = await inSequence([
    () => repo.currentAttendees(db, ids),
    () => getDealSummaries(db, rows.map((r) => r.deal_id)),
    () => businessNames(db, rows.map((r) => r.business_id)),
  ]);
  const names = await employeeNames(db, [...attendees.values()].flat());
  return rows.map((m) => {
    const deal = deals.get(m.deal_id);
    const act = deal ? mayAct(p, deal) : false;
    const started = m.starts_at.getTime() <= now.getTime();
    const open = m.status === 'scheduled' || m.status === 'missed';
    return {
      id: m.id,
      dealId: m.deal_id,
      dealCode: deal?.code ?? null,
      businessId: m.business_id,
      businessName: biz.get(m.business_id) ?? null,
      version: m.version,
      status: m.status,
      title: m.title,
      startsAt: iso(m.starts_at)!,
      endsAt: iso(m.ends_at),
      location: m.location,
      agenda: m.agenda,
      discoveryNotes: m.discovery_notes,
      cancelReason: m.cancel_reason,
      attendees: (attendees.get(m.id) ?? []).map((employeeId) => ({ employeeId, fullName: names.get(employeeId) ?? '' })),
      rescheduleCount: m.reschedule_count,
      awaitingOutcome: m.status === 'scheduled' && started,
      upcoming: m.status === 'scheduled' && !started,
      allowed: {
        reschedule: act && open,
        recordOutcome: act && ((m.status === 'scheduled' && started) || m.status === 'held'),
        cancel: act && open,
        viewNotes: true,
      },
      createdAt: iso(m.created_at)!,
      updatedAt: iso(m.updated_at)!,
    };
  });
}

async function result(ctx: CommandContext, m: MeetingRow): Promise<MeetingDto> {
  const [dto] = await toDtos(ctx.tx, principalOf(ctx), [m], ctx.now);
  return dto;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export interface MeetingListQuery {
  from?: string;
  to?: string;
  mine?: boolean;
  dealId?: string;
  status?: MeetingStatus;
  awaitingOutcome?: boolean;
}

/**
 * GET /api/meetings — calendar range (≤ 62 days). scopeFilter on `m.business_id` before LIMIT;
 * the Developer confinement (DEC-005 / OI-27) is applied on the deal summaries afterwards, so the
 * response never holds a meeting of a deal the caller may not read.
 */
export async function listMeetings(db: Queryable, p: Principal, q: MeetingListQuery): Promise<{ items: MeetingDto[] }> {
  const now = new Date();
  const params = new SqlParams();
  const where: string[] = [];
  if (q.from) where.push(`m.starts_at >= ${params.add(q.from)}::timestamptz`);
  if (q.to) where.push(`m.starts_at < ${params.add(q.to)}::timestamptz`);
  if (q.dealId) where.push(`m.deal_id = ${params.add(q.dealId)}::uuid`);
  if (q.status) where.push(`m.status = ${params.add(q.status)}`);
  if (q.awaitingOutcome) where.push(`m.status = 'scheduled' AND m.starts_at <= ${params.add(now)}::timestamptz`);
  if (q.mine) {
    where.push(
      `EXISTS (SELECT 1 FROM meeting_attendees ma WHERE ma.meeting_id = m.id AND ma.removed_at IS NULL AND ma.employee_id = ${params.add(p.employeeId)}::uuid)`
    );
  }
  where.push(access.scopeFilter(p, 'meeting.read', 'meeting', { alias: 'm', params }));
  const rows = await repo.listMeetings(db, where, params);
  let visible = rows;
  if (p.role === 'developer') {
    const deals = await getDealSummaries(db, rows.map((r) => r.deal_id));
    // OI-29: attendance alone grants nothing; only the DEC-005 deal relation counts.
    visible = rows.filter((r) => {
      const d = deals.get(r.deal_id);
      return d ? developerMayReadDeal(p, d) : false;
    });
  }
  return { items: await toDtos(db, p, visible, now) };
}

/** GET /api/meetings/:id after `access.check` passed in the route. */
export async function getMeetingForReader(db: Queryable, p: Principal, id: string): Promise<MeetingDto> {
  const m = await repo.findById(db, id);
  if (!m) throw notFound();
  if (p.role === 'developer') {
    // OI-29: attendance alone grants nothing.
    const deal = await getDealSummary(db, m.deal_id);
    if (!deal || !developerMayReadDeal(p, deal)) throw permissionDenied();
  }
  const [dto] = await toDtos(db, p, [m], new Date());
  return dto;
}

/** Read op for the deal detail (SCR-DEV-002 meetings card). The caller already passed the deal check. */
export async function meetingsForDeal(db: Queryable, p: Principal, dealId: string): Promise<MeetingDto[]> {
  const params = new SqlParams();
  const rows = await repo.listMeetings(db, [`m.deal_id = ${params.add(dealId)}::uuid`], params);
  return toDtos(db, p, rows, new Date());
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
export async function createMeeting(
  ctx: CommandContext,
  body: { dealId?: string; businessId?: string; title?: string; startsAt: string; endsAt?: string; location?: string; agenda?: string; attendeeIds: string[] }
): Promise<MeetingDto> {
  // R3-01 (P0): authorize BEFORE any read that could leak and before any write. Meetings never
  // create call attempts or deals and never change a deal directly: a deal comes only from the
  // BE3 Accepted save (createAcceptedOpportunity), a Developer only from deals.assignDeveloper.
  let deal: DealSummary | null = null;
  if (body.dealId) {
    deal = await getDealSummary(ctx.tx, body.dealId);
    if (!deal) throw notFound();
    if (body.businessId && body.businessId !== deal.businessId) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { businessId: ['The business does not match the deal'] });
    }
  } else if (body.businessId) {
    // "Meeting from a business": the caller must be able to read the business, and the business must
    // already have an open deal (DEC-017). No deal is fabricated here.
    await authorize(ctx, 'business.read', { type: 'business', id: body.businessId });
    const existing = await findOpenForBusiness(ctx.tx, body.businessId);
    if (!existing) {
      throw ruleViolation('This business has no open deal. Log an Accepted call first to create the opportunity, then schedule the meeting.', {
        code: 'NO_OPEN_DEAL',
        businessId: body.businessId,
      });
    }
    deal = await getDealSummary(ctx.tx, existing.id);
  }
  if (!deal) throw notFound();

  await authorize(ctx, 'meeting.create', { type: 'deal', id: deal.id });
  const p = principalOf(ctx);
  // DEC-005: Developers schedule only under `assigned`, on their own deal.
  if (p.role === 'developer' && deliveryPolicy().developerPreClosure !== 'assigned') throw permissionDenied();
  assertMayAct(p, deal);
  if (!OPEN_DEAL_STAGES.has(deal.stage)) throw stateConflict('Meetings are scheduled only for open deals');
  assertNotPast(ctx, body.startsAt, body.endsAt);
  const attendeeIds = await assertAttendees(ctx, body.attendeeIds);
  // A Developer attendee on a deal with no Developer is assigned through the audited deals command
  // (version bump, deal_developer_assignments row, audit, outbox E-08), and only for roles that may
  // assign Developers (Owner, Call Center). Attendance alone never grants access (OI-29).
  if (!deal.assignedDeveloperId && (p.role === 'owner' || p.role === 'call_center')) {
    const dev = await ctx.tx.query<{ id: string }>(
      `SELECT id FROM employees WHERE id = ANY($1::uuid[]) AND role = 'developer' AND is_active = true ORDER BY array_position($1::uuid[], id) LIMIT 1`,
      [attendeeIds]
    );
    if (dev.rows[0]) {
      const v = await ctx.tx.query<{ version: number }>('SELECT version FROM deals WHERE id = $1', [deal.id]);
      await assignDeveloper(ctx, deal.id, { version: v.rows[0].version, developerId: dev.rows[0].id });
      deal = (await getDealSummary(ctx.tx, deal.id))!;
    }
  }
  const m = await repo.insertMeeting(ctx.tx, {
    dealId: deal.id,
    businessId: deal.businessId,
    title: body.title ?? null,
    startsAt: body.startsAt,
    endsAt: body.endsAt ?? null,
    location: body.location ?? null,
    agenda: body.agenda ?? null,
    createdById: actorIdOf(ctx)!,
    now: ctx.now,
  });
  await repo.setAttendees(ctx.tx, m.id, attendeeIds, ctx.now);
  await repo.insertChange(ctx.tx, { meetingId: m.id, type: 'scheduled', after: scheduleOf(m, attendeeIds), actorId: actorIdOf(ctx)!, now: ctx.now });
  await audit(ctx, { eventName: 'meeting.scheduled', entityType: 'meeting', entityId: m.id, after: { dealId: deal.id, ...scheduleOf(m, attendeeIds) } });
  await emit(ctx, 'meeting.scheduled', m);
  return result(ctx, m);
}

export async function rescheduleMeeting(
  ctx: CommandContext,
  id: string,
  body: {
    version: number;
    startsAt: string;
    endsAt?: string | null;
    location?: string | null;
    agenda?: string | null;
    attendeeIds?: string[];
    reason?: string;
  }
): Promise<MeetingDto> {
  const { m } = await lockAndAuthorize(ctx, id, 'meeting.reschedule');
  if (m.status !== 'scheduled' && m.status !== 'missed') throw stateConflict('Only scheduled or missed meetings can be rescheduled');
  const dealNow = await getDealSummary(ctx.tx, m.deal_id);
  if (!dealNow || !OPEN_DEAL_STAGES.has(dealNow.stage)) throw stateConflict('Meetings are rescheduled only for open deals');
  const before = await repo.currentAttendees(ctx.tx, [m.id]);
  const beforeIds = before.get(m.id) ?? [];
  const nextIds = body.attendeeIds ? await assertAttendees(ctx, body.attendeeIds) : beforeIds;
  const sameTime = iso(m.starts_at) === new Date(body.startsAt).toISOString();
  const sameEnd = body.endsAt === undefined || (iso(m.ends_at) ?? null) === (body.endsAt ? new Date(body.endsAt).toISOString() : null);
  const sameAttendees = nextIds.length === beforeIds.length && nextIds.every((x) => beforeIds.includes(x));
  const sameLoc = body.location === undefined || body.location === m.location;
  const sameAgenda = body.agenda === undefined || body.agenda === m.agenda;
  if (m.status === 'scheduled' && sameTime && sameEnd && sameAttendees && sameLoc && sameAgenda) return result(ctx, m); // no-op
  await assertVersion(ctx, m, body.version);
  const endsAt = body.endsAt === undefined ? (m.ends_at ? iso(m.ends_at) : null) : body.endsAt;
  assertNotPast(ctx, body.startsAt, endsAt);
  const set: Partial<Record<repo.MeetingColumn, unknown>> = {
    status: 'scheduled',
    starts_at: body.startsAt,
    ends_at: endsAt,
    reschedule_count: m.reschedule_count + 1,
  };
  if (body.location !== undefined) set.location = body.location;
  if (body.agenda !== undefined) set.agenda = body.agenda;
  if (m.status === 'missed') {
    set.outcome_recorded_at = null;
    set.outcome_recorded_by_id = null;
  }
  const next = await save(ctx, m, set);
  if (body.attendeeIds) await repo.setAttendees(ctx.tx, m.id, nextIds, ctx.now);
  const beforeV = { status: m.status, ...scheduleOf(m, beforeIds) };
  const afterV = { status: next.status, ...scheduleOf(next, nextIds) };
  await repo.insertChange(ctx.tx, { meetingId: m.id, type: 'rescheduled', before: beforeV, after: afterV, reason: body.reason ?? null, actorId: actorIdOf(ctx)!, now: ctx.now });
  await audit(ctx, { eventName: 'meeting.rescheduled', entityType: 'meeting', entityId: m.id, before: beforeV, after: afterV, reason: body.reason ?? null });
  await emit(ctx, 'meeting.rescheduled', next);
  return result(ctx, next);
}

/** Held: start time reached; discovery notes attach to the deal. On a held meeting this amends the notes. */
export async function markHeld(ctx: CommandContext, id: string, body: { version: number; discoveryNotes: string }): Promise<MeetingDto> {
  const { m } = await lockAndAuthorize(ctx, id, 'meeting.complete');
  if (m.status === 'held') {
    if (m.discovery_notes === body.discoveryNotes) return result(ctx, m);
    await assertVersion(ctx, m, body.version);
    const next = await save(ctx, m, { discovery_notes: body.discoveryNotes });
    await repo.insertChange(ctx.tx, { meetingId: m.id, type: 'notes_updated', before: { notesLength: m.discovery_notes?.length ?? 0 }, after: { notesLength: body.discoveryNotes.length }, actorId: actorIdOf(ctx)!, now: ctx.now });
    await audit(ctx, { eventName: 'meeting.notes_updated', entityType: 'meeting', entityId: m.id });
    return result(ctx, next);
  }
  if (m.status !== 'scheduled') throw stateConflict('Only a scheduled meeting can be recorded as held');
  if (m.starts_at.getTime() > ctx.now.getTime()) throw stateConflict('The meeting has not started yet');
  await assertVersion(ctx, m, body.version);
  const next = await save(ctx, m, {
    status: 'held',
    discovery_notes: body.discoveryNotes,
    outcome_recorded_at: ctx.now,
    outcome_recorded_by_id: actorIdOf(ctx),
  });
  await repo.insertChange(ctx.tx, { meetingId: m.id, type: 'held', before: { status: m.status }, after: { status: 'held' }, actorId: actorIdOf(ctx)!, now: ctx.now });
  await audit(ctx, { eventName: 'meeting.held', entityType: 'meeting', entityId: m.id, before: { status: m.status }, after: { status: 'held' } });
  await emit(ctx, 'meeting.held', next);
  return result(ctx, next);
}

/** Missed (R-13, Proposed state): start time passed. It can be rescheduled afterwards. */
export async function markMissed(ctx: CommandContext, id: string, body: { version: number; note?: string }): Promise<MeetingDto> {
  const { m } = await lockAndAuthorize(ctx, id, 'meeting.mark_missed');
  if (m.status === 'missed') return result(ctx, m);
  if (m.status !== 'scheduled') throw stateConflict('Only a scheduled meeting can be recorded as missed');
  if (m.starts_at.getTime() > ctx.now.getTime()) throw stateConflict('The meeting has not started yet');
  await assertVersion(ctx, m, body.version);
  const next = await save(ctx, m, { status: 'missed', outcome_recorded_at: ctx.now, outcome_recorded_by_id: actorIdOf(ctx) });
  await repo.insertChange(ctx.tx, { meetingId: m.id, type: 'missed', before: { status: m.status }, after: { status: 'missed' }, reason: body.note ?? null, actorId: actorIdOf(ctx)!, now: ctx.now });
  await audit(ctx, { eventName: 'meeting.missed', entityType: 'meeting', entityId: m.id, before: { status: m.status }, after: { status: 'missed' }, reason: body.note ?? null });
  await emit(ctx, 'meeting.missed', next);
  return result(ctx, next);
}

/** Cancel: reason required, final (never reopened). */
export async function cancelMeeting(ctx: CommandContext, id: string, body: { version: number; reason: string }): Promise<MeetingDto> {
  const { m } = await lockAndAuthorize(ctx, id, 'meeting.reschedule');
  if (m.status === 'cancelled') return result(ctx, m);
  if (m.status === 'held') throw stateConflict('A held meeting cannot be cancelled');
  await assertVersion(ctx, m, body.version);
  const next = await save(ctx, m, { status: 'cancelled', cancel_reason: body.reason });
  await repo.insertChange(ctx.tx, { meetingId: m.id, type: 'cancelled', before: { status: m.status }, after: { status: 'cancelled' }, reason: body.reason, actorId: actorIdOf(ctx)!, now: ctx.now });
  await audit(ctx, { eventName: 'meeting.cancelled', entityType: 'meeting', entityId: m.id, before: { status: m.status }, after: { status: 'cancelled' }, reason: body.reason });
  await emit(ctx, 'meeting.cancelled', next);
  return result(ctx, next);
}

// ---------------------------------------------------------------------------
// Outbox consumer: deal.not_proceeding -> cancel the deal's Scheduled meetings (delivery-design §6)
// ---------------------------------------------------------------------------
/**
 * Runs in its own transaction with a system actor. Idempotent: only `scheduled` rows change, so a
 * replay finds nothing to do. `meeting_changes.actor_id` is the employee who marked the deal (payload).
 */
export async function cancelScheduledMeetingsForDeal(ctx: CommandContext, event: Pick<DeliveredEvent, 'payload'>): Promise<number> {
  const dealId = typeof event.payload.dealId === 'string' ? event.payload.dealId : null;
  const actorId = typeof event.payload.actorId === 'string' ? event.payload.actorId : null;
  if (!dealId || !actorId) return 0;
  const params = new SqlParams();
  const rows = await repo.listMeetings(ctx.tx, [`m.deal_id = ${params.add(dealId)}::uuid`, `m.status = 'scheduled'`], params);
  let n = 0;
  for (const row of rows) {
    const m = await repo.findById(ctx.tx, row.id, true);
    if (!m || m.status !== 'scheduled') continue;
    const next = await repo.updateMeeting(ctx.tx, m.id, m.version, { status: 'cancelled', cancel_reason: DEAL_NOT_PROCEEDING_REASON }, ctx.now);
    if (!next) continue;
    await repo.insertChange(ctx.tx, { meetingId: m.id, type: 'cancelled', before: { status: 'scheduled' }, after: { status: 'cancelled' }, reason: DEAL_NOT_PROCEEDING_REASON, actorId, now: ctx.now });
    await audit(ctx, { eventName: 'meeting.cancelled', entityType: 'meeting', entityId: m.id, before: { status: 'scheduled' }, after: { status: 'cancelled' }, reason: DEAL_NOT_PROCEEDING_REASON });
    await emit(ctx, 'meeting.cancelled', next);
    n++;
  }
  return n;
}
