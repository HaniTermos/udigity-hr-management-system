/**
 * MOD-calls — repository (raw parameterised SQL on this module's own tables). Owner: BE3.
 * Owned tables: business_calling_states, call_attempts (append-only), follow_ups, follow_up_changes,
 * outcome_reopenings. List queries also read the `access_facts` view (the one allowed cross-module
 * read) and, temporarily, `businesses.name` / `employees.full_name` (see directory.ts).
 */
import type { Queryable } from '../../db/pool.js';
import type { BusinessOutcome, CallOutcome, FollowUpState } from './schemas.js';

// ---------------------------------------------------------------------------
// business_calling_states
// ---------------------------------------------------------------------------
export interface StateRow {
  business_id: string;
  outcome: BusinessOutcome;
  outcome_changed_at: Date | null;
  outcome_changed_by: string | null;
  rejection_reason: string | null;
  callback_marker: boolean;
  callback_marker_set_at: Date | null;
  last_touchpoint_at: Date | null;
  version: number;
}

const STATE_COLS = `business_id, outcome, outcome_changed_at, outcome_changed_by, rejection_reason, callback_marker,
  callback_marker_set_at, last_touchpoint_at, version`;

/** Idempotent: outcome Pending, Unassigned (C-02). */
export async function insertState(db: Queryable, businessId: string): Promise<void> {
  await db.query(`INSERT INTO business_calling_states (business_id) VALUES ($1) ON CONFLICT (business_id) DO NOTHING`, [businessId]);
}

export async function findState(db: Queryable, businessId: string, forUpdate = false): Promise<StateRow | null> {
  const { rows } = await db.query<StateRow>(
    `SELECT ${STATE_COLS} FROM business_calling_states WHERE business_id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [businessId]
  );
  return rows[0] ?? null;
}

export async function updateState(
  db: Queryable,
  businessId: string,
  patch: {
    outcome: BusinessOutcome;
    outcomeChanged: boolean;
    actorId: string | null;
    rejectionReason: string | null;
    callbackMarker: boolean;
    touch: boolean;
    now: Date;
  }
): Promise<StateRow> {
  const { rows } = await db.query<StateRow>(
    `UPDATE business_calling_states
        SET outcome = $2,
            outcome_changed_at = CASE WHEN $3 THEN $5::timestamptz ELSE outcome_changed_at END,
            outcome_changed_by = CASE WHEN $3 THEN $4::uuid ELSE outcome_changed_by END,
            rejection_reason = $6,
            callback_marker_set_at = CASE WHEN $7 AND NOT callback_marker THEN $5::timestamptz WHEN NOT $7 THEN NULL ELSE callback_marker_set_at END,
            callback_marker = $7,
            last_touchpoint_at = CASE WHEN $8 THEN $5::timestamptz ELSE last_touchpoint_at END,
            version = version + 1,
            updated_at = $5
      WHERE business_id = $1
      RETURNING ${STATE_COLS}`,
    [businessId, patch.outcome, patch.outcomeChanged, patch.actorId, patch.now, patch.rejectionReason, patch.callbackMarker, patch.touch]
  );
  return rows[0];
}

/**
 * Touchpoint only (save-after-loss keepAttemptOnly: a real contact happened, nothing else changed).
 * The version is not bumped: no user-visible calling field changed, so open workspaces stay valid.
 */
export async function touch(db: Queryable, businessId: string, now: Date): Promise<void> {
  await db.query(
    `UPDATE business_calling_states SET last_touchpoint_at = GREATEST(COALESCE(last_touchpoint_at, $2), $2), updated_at = $2 WHERE business_id = $1`,
    [businessId, now]
  );
}

// ---------------------------------------------------------------------------
// call_attempts (append-only)
// ---------------------------------------------------------------------------
export interface AttemptRow {
  id: string;
  business_id: string;
  agent_id: string;
  reservation_id: string | null;
  attempted_at: Date;
  channel: 'outbound_call' | 'inbound_other';
  outcome: CallOutcome;
  outcome_applied: boolean;
  reservation_held: boolean;
  notes: string | null;
  rejection_reason: string | null;
  client_needs_note: string | null;
  service_interest: string | null;
  fulfils_follow_up_id: string | null;
}

const ATTEMPT_COLS = `id, business_id, agent_id, reservation_id, attempted_at, channel, outcome, outcome_applied, reservation_held,
  notes, rejection_reason, client_needs_note, service_interest, fulfils_follow_up_id`;

export async function findAttemptByKey(db: Queryable, agentId: string, key: string): Promise<AttemptRow | null> {
  const { rows } = await db.query<AttemptRow>(
    `SELECT ${ATTEMPT_COLS} FROM call_attempts WHERE agent_id = $1 AND idempotency_key = $2`,
    [agentId, key]
  );
  return rows[0] ?? null;
}

export async function insertAttempt(
  db: Queryable,
  a: {
    businessId: string;
    agentId: string;
    reservationId: string | null;
    now: Date;
    channel: 'outbound_call' | 'inbound_other';
    outcome: CallOutcome;
    outcomeApplied: boolean;
    reservationHeld: boolean;
    notes: string | null;
    rejectionReason: string | null;
    clientNeedsNote: string | null;
    serviceInterest: string | null;
    fulfilsFollowUpId: string | null;
    idempotencyKey: string;
  }
): Promise<AttemptRow> {
  const { rows } = await db.query<AttemptRow>(
    `INSERT INTO call_attempts (business_id, agent_id, reservation_id, attempted_at, channel, outcome, outcome_applied,
        reservation_held, notes, rejection_reason, client_needs_note, service_interest, fulfils_follow_up_id, idempotency_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $4)
     RETURNING ${ATTEMPT_COLS}`,
    [
      a.businessId, a.agentId, a.reservationId, a.now, a.channel, a.outcome, a.outcomeApplied, a.reservationHeld,
      a.notes, a.rejectionReason, a.clientNeedsNote, a.serviceInterest, a.fulfilsFollowUpId, a.idempotencyKey,
    ]
  );
  return rows[0];
}

export async function listAttempts(db: Queryable, businessId: string, limit = 50): Promise<AttemptRow[]> {
  const { rows } = await db.query<AttemptRow>(
    `SELECT ${ATTEMPT_COLS} FROM call_attempts WHERE business_id = $1 ORDER BY attempted_at DESC, created_at DESC LIMIT $2`,
    [businessId, limit]
  );
  return rows;
}

export async function findAttempt(db: Queryable, id: string): Promise<AttemptRow | null> {
  const { rows } = await db.query<AttemptRow>(`SELECT ${ATTEMPT_COLS} FROM call_attempts WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// follow_ups + follow_up_changes
// ---------------------------------------------------------------------------
export interface FollowUpRow {
  id: string;
  business_id: string;
  responsible_id: string;
  scheduled_for: Date;
  purpose: string | null;
  state: FollowUpState;
  created_by: string;
  created_by_attempt_id: string | null;
  completed_by_attempt_id: string | null;
  completed_at: Date | null;
  completion_note: string | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  cancel_source: 'user' | 'reassignment' | 'outcome_rejected' | null;
  version: number;
}

const FU_COLS = `id, business_id, responsible_id, scheduled_for, purpose, state, created_by, created_by_attempt_id,
  completed_by_attempt_id, completed_at, completion_note, cancelled_at, cancel_reason, cancel_source, version`;

export async function findFollowUp(db: Queryable, id: string, forUpdate = false): Promise<FollowUpRow | null> {
  const { rows } = await db.query<FollowUpRow>(`SELECT ${FU_COLS} FROM follow_ups WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function findOpenFollowUp(db: Queryable, businessId: string, forUpdate = false): Promise<FollowUpRow | null> {
  const { rows } = await db.query<FollowUpRow>(
    `SELECT ${FU_COLS} FROM follow_ups WHERE business_id = $1 AND state = 'scheduled' ${forUpdate ? 'FOR UPDATE' : ''}`,
    [businessId]
  );
  return rows[0] ?? null;
}

export async function insertFollowUp(
  db: Queryable,
  f: { businessId: string; responsibleId: string; scheduledFor: Date; purpose: string | null; createdBy: string; attemptId: string | null; now: Date }
): Promise<FollowUpRow> {
  const { rows } = await db.query<FollowUpRow>(
    `INSERT INTO follow_ups (business_id, responsible_id, scheduled_for, purpose, created_by, created_by_attempt_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING ${FU_COLS}`,
    [f.businessId, f.responsibleId, f.scheduledFor, f.purpose, f.createdBy, f.attemptId, f.now]
  );
  return rows[0];
}

export async function rescheduleFollowUp(
  db: Queryable,
  id: string,
  p: { scheduledFor: Date; responsibleId: string; purpose?: string | null; now: Date }
): Promise<FollowUpRow> {
  const { rows } = await db.query<FollowUpRow>(
    `UPDATE follow_ups SET scheduled_for = $2, responsible_id = $3, purpose = CASE WHEN $5::boolean THEN $4::varchar ELSE purpose END,
            version = version + 1, updated_at = $6
      WHERE id = $1 AND state = 'scheduled' RETURNING ${FU_COLS}`,
    [id, p.scheduledFor, p.responsibleId, p.purpose ?? null, p.purpose !== undefined, p.now]
  );
  return rows[0];
}

export async function completeFollowUp(
  db: Queryable,
  id: string,
  p: { attemptId: string | null; note: string | null; now: Date }
): Promise<FollowUpRow | null> {
  const { rows } = await db.query<FollowUpRow>(
    `UPDATE follow_ups SET state = 'completed', completed_at = $2, completed_by_attempt_id = $3, completion_note = $4,
            version = version + 1, updated_at = $2
      WHERE id = $1 AND state = 'scheduled' RETURNING ${FU_COLS}`,
    [id, p.now, p.attemptId, p.note]
  );
  return rows[0] ?? null;
}

export async function cancelFollowUp(
  db: Queryable,
  id: string,
  p: { reason: string | null; source: 'user' | 'reassignment' | 'outcome_rejected'; now: Date }
): Promise<FollowUpRow | null> {
  const { rows } = await db.query<FollowUpRow>(
    `UPDATE follow_ups SET state = 'cancelled', cancelled_at = $2, cancel_reason = $3, cancel_source = $4,
            version = version + 1, updated_at = $2
      WHERE id = $1 AND state = 'scheduled' RETURNING ${FU_COLS}`,
    [id, p.now, p.reason, p.source]
  );
  return rows[0] ?? null;
}

export async function insertFollowUpChange(
  db: Queryable,
  c: {
    followUpId: string;
    kind: 'scheduled' | 'rescheduled' | 'reassigned' | 'completed' | 'cancelled';
    oldScheduledFor?: Date | null;
    newScheduledFor?: Date | null;
    oldResponsibleId?: string | null;
    newResponsibleId?: string | null;
    reason?: string | null;
    changedBy: string | null;
    now: Date;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO follow_up_changes (follow_up_id, kind, old_scheduled_for, new_scheduled_for, old_responsible_id, new_responsible_id,
        reason, changed_by, changed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      c.followUpId, c.kind, c.oldScheduledFor ?? null, c.newScheduledFor ?? null, c.oldResponsibleId ?? null,
      c.newResponsibleId ?? null, c.reason ?? null, c.changedBy, c.now,
    ]
  );
}

export async function openFollowUpsOf(db: Queryable, responsibleId: string): Promise<{ id: string }[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM follow_ups WHERE responsible_id = $1 AND state = 'scheduled' ORDER BY scheduled_for`,
    [responsibleId]
  );
  return rows;
}

export async function businessOfFollowUp(db: Queryable, id: string): Promise<string | null> {
  const { rows } = await db.query<{ business_id: string }>('SELECT business_id FROM follow_ups WHERE id = $1', [id]);
  return rows[0]?.business_id ?? null;
}

export async function businessOfAttempt(db: Queryable, id: string): Promise<string | null> {
  const { rows } = await db.query<{ business_id: string }>('SELECT business_id FROM call_attempts WHERE id = $1', [id]);
  return rows[0]?.business_id ?? null;
}

// ---------------------------------------------------------------------------
// outcome_reopenings
// ---------------------------------------------------------------------------
export async function insertReopening(
  db: Queryable,
  r: { businessId: string; kind: 'reopen' | 'requeue'; previous: BusinessOutcome; reason: string; by: string; now: Date }
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO outcome_reopenings (business_id, kind, previous_outcome, new_outcome, reason, performed_by, performed_at)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6) RETURNING id`,
    [r.businessId, r.kind, r.previous, r.reason, r.by, r.now]
  );
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Reads for the calling surfaces (queue, workspace, do-not-call, opportunities, calendar).
// calling_assignments is BE3's own table (MOD-assignment); MOD-calls reads it here instead of
// importing MOD-assignment (dependency direction assignment -> calls only, AR-07).
// ---------------------------------------------------------------------------
export interface OpenAssignmentRow {
  id: string;
  assignee_id: string;
  started_at: Date;
}

export async function openAssignment(db: Queryable, businessId: string): Promise<OpenAssignmentRow | null> {
  const { rows } = await db.query<OpenAssignmentRow>(
    'SELECT id, assignee_id, started_at FROM calling_assignments WHERE business_id = $1 AND ended_at IS NULL',
    [businessId]
  );
  return rows[0] ?? null;
}

export interface QueueRow {
  business_id: string;
  business_name: string;
  bucket: string;
  outcome: BusinessOutcome;
  callback_marker: boolean;
  fu_id: string | null;
  fu_at: Date | null;
  fu_responsible: string | null;
  next_action_at: Date | null;
  last_attempt_at: Date | null;
  attempt_count: number;
  assignee_id: string;
  assigned_at: Date;
}

/**
 * Derived queue (nothing stored). `scope` is the access predicate over `b` (applied before count/sort/page).
 * `$tz`, `$now`, `$overdue` are passed by the caller through `params`.
 */
export function queueCte(where: string[], ph: { now: string; tz: string; overdue: string }): string {
  return `WITH q AS (
    SELECT b.id AS business_id, b.name AS business_name,
           COALESCE(s.outcome, 'pending') AS outcome, COALESCE(s.callback_marker, false) AS callback_marker,
           fu.id AS fu_id, fu.scheduled_for AS fu_at, fu.responsible_id AS fu_responsible,
           COALESCE(fu.scheduled_for, ca.started_at) AS next_action_at,
           st.last_attempt_at, COALESCE(st.attempt_count, 0) AS attempt_count,
           ca.assignee_id, ca.started_at AS assigned_at,
           CASE
             WHEN fu.id IS NOT NULL AND fu.scheduled_for + make_interval(mins => ${ph.overdue}) < ${ph.now} THEN 'overdue_follow_up'
             WHEN fu.id IS NOT NULL AND fu.scheduled_for < ((date_trunc('day', timezone(${ph.tz}, ${ph.now})) + interval '1 day') AT TIME ZONE ${ph.tz}) THEN 'callback_due'
             WHEN COALESCE(s.callback_marker, false) THEN 'callback_to_schedule'
             WHEN COALESCE(s.outcome, 'pending') = 'pending' AND COALESCE(st.attempt_count, 0) = 0 THEN 'new_assigned'
             WHEN s.outcome = 'on_hold' THEN 'on_hold'
             WHEN fu.id IS NOT NULL THEN 'upcoming_follow_up'
             ELSE 'requires_contact'
           END AS bucket
      FROM calling_assignments ca
      JOIN businesses b ON b.id = ca.business_id
      LEFT JOIN business_calling_states s ON s.business_id = b.id
      LEFT JOIN follow_ups fu ON fu.business_id = b.id AND fu.state = 'scheduled'
      LEFT JOIN LATERAL (
        SELECT max(a.attempted_at) AS last_attempt_at, count(*)::int AS attempt_count
          FROM call_attempts a WHERE a.business_id = b.id
      ) st ON TRUE
     WHERE ca.ended_at IS NULL
       AND b.archived_at IS NULL
       AND COALESCE(s.outcome, 'pending') NOT IN ('accepted', 'rejected')
       AND ${where.length ? where.join(' AND ') : 'TRUE'}
  )`;
}

export async function queueCounts(db: Queryable, cte: string, values: unknown[]): Promise<Map<string, number>> {
  const { rows } = await db.query<{ bucket: string; n: number }>(`${cte} SELECT bucket, count(*)::int AS n FROM q GROUP BY bucket`, values);
  return new Map(rows.map((r) => [r.bucket, r.n]));
}

export async function queuePage(db: Queryable, cte: string, tail: string, values: unknown[]): Promise<QueueRow[]> {
  const { rows } = await db.query<QueueRow>(`${cte} SELECT * FROM q ${tail}`, values);
  return rows;
}

export interface DncRow {
  business_id: string;
  business_name: string;
  rejected_at: Date | null;
  rejection_reason: string | null;
  rejected_by: string | null;
  assignee_id: string | null;
  attempt_count: number;
  version: number;
}

export async function listDoNotCall(
  db: Queryable,
  where: string[],
  values: unknown[],
  tail: string,
  tailValues: unknown[]
): Promise<{ rows: DncRow[]; total: number }> {
  const from = `FROM business_calling_states s
      JOIN businesses b ON b.id = s.business_id
      LEFT JOIN calling_assignments ca ON ca.business_id = b.id AND ca.ended_at IS NULL
     WHERE s.outcome = 'rejected' AND ${where.length ? where.join(' AND ') : 'TRUE'}`;
  const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, values);
  const { rows } = await db.query<DncRow>(
    `SELECT b.id AS business_id, b.name AS business_name, s.outcome_changed_at AS rejected_at, s.rejection_reason,
            s.outcome_changed_by AS rejected_by, ca.assignee_id,
            (SELECT count(*)::int FROM call_attempts a WHERE a.business_id = b.id) AS attempt_count, s.version
       ${from} ${tail}`,
    [...values, ...tailValues]
  );
  return { rows, total: count.rows[0].n };
}

export async function listFollowUps(
  db: Queryable,
  where: string[],
  values: unknown[],
  tail: string,
  tailValues: unknown[]
): Promise<{ rows: FollowUpRow[]; total: number }> {
  const from = `FROM follow_ups fu JOIN businesses b ON b.id = fu.business_id WHERE ${where.length ? where.join(' AND ') : 'TRUE'}`;
  const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, values);
  const { rows } = await db.query<FollowUpRow>(
    `SELECT ${FU_COLS.split(',').map((c) => `fu.${c.trim()}`).join(', ')} ${from} ${tail}`,
    [...values, ...tailValues]
  );
  return { rows, total: count.rows[0].n };
}

/** Latest applied Accepted attempt per business (CC-007 enrichment). */
export async function latestAcceptedAttempts(db: Queryable, businessIds: readonly string[]): Promise<Map<string, AttemptRow>> {
  const out = new Map<string, AttemptRow>();
  if (businessIds.length === 0) return out;
  const { rows } = await db.query<AttemptRow>(
    `SELECT DISTINCT ON (business_id) ${ATTEMPT_COLS} FROM call_attempts
      WHERE business_id = ANY($1::uuid[]) AND outcome = 'accepted' AND outcome_applied
      ORDER BY business_id, attempted_at DESC`,
    [[...new Set(businessIds)]]
  );
  for (const r of rows) out.set(r.business_id, r);
  return out;
}
