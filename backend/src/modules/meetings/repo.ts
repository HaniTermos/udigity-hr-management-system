/**
 * MOD-meetings — repository (raw parameterised SQL on this module's own tables only). Owner: BE4.
 * Owned tables: meetings, meeting_attendees, meeting_changes.
 */
import type { Queryable } from '../../db/pool.js';
import { SqlParams } from '../../shared/sql.js';
import type { MeetingStatus } from './schemas.js';

export interface MeetingRow {
  id: string;
  deal_id: string;
  business_id: string;
  status: MeetingStatus;
  title: string | null;
  starts_at: Date;
  ends_at: Date | null;
  location: string | null;
  agenda: string | null;
  discovery_notes: string | null;
  cancel_reason: string | null;
  outcome_recorded_at: Date | null;
  outcome_recorded_by_id: string | null;
  reschedule_count: number;
  created_by_id: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export async function findById(db: Queryable, id: string, forUpdate = false): Promise<MeetingRow | null> {
  const { rows } = await db.query<MeetingRow>(`SELECT * FROM meetings WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function insertMeeting(
  db: Queryable,
  v: { dealId: string; businessId: string; title: string | null; startsAt: string; endsAt: string | null; location: string | null; agenda: string | null; createdById: string; now: Date }
): Promise<MeetingRow> {
  const { rows } = await db.query<MeetingRow>(
    `INSERT INTO meetings (deal_id, business_id, title, starts_at, ends_at, location, agenda, created_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
    [v.dealId, v.businessId, v.title, v.startsAt, v.endsAt, v.location, v.agenda, v.createdById, v.now]
  );
  return rows[0];
}

export type MeetingColumn =
  | 'status'
  | 'title'
  | 'starts_at'
  | 'ends_at'
  | 'location'
  | 'agenda'
  | 'discovery_notes'
  | 'cancel_reason'
  | 'outcome_recorded_at'
  | 'outcome_recorded_by_id'
  | 'reschedule_count';

const SETTABLE: ReadonlySet<MeetingColumn> = new Set<MeetingColumn>([
  'status',
  'title',
  'starts_at',
  'ends_at',
  'location',
  'agenda',
  'discovery_notes',
  'cancel_reason',
  'outcome_recorded_at',
  'outcome_recorded_by_id',
  'reschedule_count',
]);

export async function updateMeeting(
  db: Queryable,
  id: string,
  expectedVersion: number,
  set: Partial<Record<MeetingColumn, unknown>>,
  now: Date
): Promise<MeetingRow | null> {
  const p = new SqlParams();
  const parts: string[] = [];
  for (const [col, value] of Object.entries(set) as [MeetingColumn, unknown][]) {
    if (!SETTABLE.has(col)) throw new Error(`meetings.updateMeeting: column not settable: ${col}`);
    parts.push(`${col} = ${p.add(value)}`);
  }
  const { rows } = await db.query<MeetingRow>(
    `UPDATE meetings SET ${parts.join(', ')}${parts.length ? ', ' : ''}version = version + 1, updated_at = ${p.add(now)}
      WHERE id = ${p.add(id)} AND version = ${p.add(expectedVersion)} RETURNING *`,
    p.values
  );
  return rows[0] ?? null;
}

export async function currentAttendees(db: Queryable, meetingIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (meetingIds.length === 0) return out;
  const { rows } = await db.query<{ meeting_id: string; employee_id: string }>(
    `SELECT meeting_id, employee_id FROM meeting_attendees WHERE meeting_id = ANY($1::uuid[]) AND removed_at IS NULL ORDER BY added_at, employee_id`,
    [meetingIds]
  );
  for (const r of rows) out.set(r.meeting_id, [...(out.get(r.meeting_id) ?? []), r.employee_id]);
  return out;
}

/** Replace the current attendee set: removed rows get removed_at, re-added rows are restored. */
export async function setAttendees(db: Queryable, meetingId: string, employeeIds: string[], now: Date): Promise<void> {
  await db.query(
    `UPDATE meeting_attendees SET removed_at = $3 WHERE meeting_id = $1 AND removed_at IS NULL AND NOT (employee_id = ANY($2::uuid[]))`,
    [meetingId, employeeIds, now]
  );
  for (const e of employeeIds) {
    await db.query(
      `INSERT INTO meeting_attendees (meeting_id, employee_id, added_at) VALUES ($1, $2, $3)
       ON CONFLICT (meeting_id, employee_id) DO UPDATE SET removed_at = NULL,
         added_at = CASE WHEN meeting_attendees.removed_at IS NULL THEN meeting_attendees.added_at ELSE EXCLUDED.added_at END`,
      [meetingId, e, now]
    );
  }
}

export type MeetingChangeType = 'scheduled' | 'rescheduled' | 'held' | 'missed' | 'cancelled' | 'notes_updated';

export async function insertChange(
  db: Queryable,
  v: { meetingId: string; type: MeetingChangeType; before?: unknown; after?: unknown; reason?: string | null; actorId: string; now: Date }
): Promise<void> {
  await db.query(
    `INSERT INTO meeting_changes (meeting_id, change_type, before_value, after_value, reason, actor_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      v.meetingId,
      v.type,
      v.before === undefined ? null : JSON.stringify(v.before),
      v.after === undefined ? null : JSON.stringify(v.after),
      v.reason ?? null,
      v.actorId,
      v.now,
    ]
  );
}

/** Calendar list (WHERE built by the service, incl. scopeFilter on `m.business_id`). */
export async function listMeetings(db: Queryable, where: string[], params: SqlParams): Promise<MeetingRow[]> {
  const { rows } = await db.query<MeetingRow>(
    `SELECT m.*
       FROM meetings m
      WHERE ${where.join(' AND ')}
      ORDER BY m.starts_at, m.id
      LIMIT 500`,
    params.values
  );
  return rows;
}

/**
 * Staff picker for meeting attendees (FX-BE-C3). Active employees only, id + name + role (no e-mail,
 * phone or security fields). `employees` is read-only here.
 */
export async function attendeeOptions(
  db: Queryable,
  q: { q?: string; role?: string; pageSize: number },
  /** E-07: when set, only these people, plus every active employee holding one of `roles`. */
  limitTo?: { ids: string[]; roles: string[] }
): Promise<{ id: string; full_name: string; role: string }[]> {
  const params = new SqlParams();
  const where = ['e.is_active = true'];
  if (limitTo) {
    where.push(`(e.id = ANY(${params.add(limitTo.ids)}::uuid[]) OR e.role = ANY(${params.add(limitTo.roles)}::text[]))`);
  }
  if (q.q) where.push(`e.full_name ILIKE ${params.add('%' + q.q.replace(/[\\%_]/g, (c) => '\\' + c) + '%')} ESCAPE '\\'`);
  if (q.role) where.push(`e.role = ${params.add(q.role)}`);
  const { rows } = await db.query<{ id: string; full_name: string; role: string }>(
    `SELECT e.id, e.full_name, e.role FROM employees e WHERE ${where.join(' AND ')} ORDER BY e.full_name, e.id LIMIT ${params.add(q.pageSize)}`,
    params.values
  );
  return rows;
}

/** E-07: the business's current Call Center assignee (read-only lookup of the open assignment row). */
export async function currentAssigneeOf(db: Queryable, businessId: string): Promise<string | null> {
  const { rows } = await db.query<{ assignee_id: string }>(
    'SELECT assignee_id FROM calling_assignments WHERE business_id = $1 AND ended_at IS NULL LIMIT 1',
    [businessId]
  );
  return rows[0]?.assignee_id ?? null;
}
