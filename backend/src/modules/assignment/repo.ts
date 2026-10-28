/**
 * MOD-assignment — repository (raw parameterised SQL). Owner: BE3.
 * Owned table: calling_assignments (migration 300; history rows, one open row per business).
 * Every function takes a Queryable (pool or ctx.tx) as its first argument.
 *
 * Temporary reads (precedent BE5-R2, REQUESTs BE3-R2/BE3-R3 on the board): `businesses` (id, name,
 * archived_at, created_at), `business_phones` (existence only, B2) and `employees` (full_name,
 * is_active, role). They are read-only and replaced by BE2/BE1 service ops when those exist.
 */
import type { Queryable } from '../../db/pool.js';
import { pageClause } from '../../shared/pagination.js';
import type { SqlParams } from '../../shared/sql.js';

export type AssignmentSource = 'manual' | 'work_list' | 'automatic';

export interface AssignmentRow {
  id: string;
  business_id: string;
  assignee_id: string;
  assigned_by: string | null;
  source: AssignmentSource;
  reason: string | null;
  started_at: Date;
  ended_at: Date | null;
  end_reason: 'reassigned' | 'unassigned' | null;
  version: number;
}

const COLS = 'id, business_id, assignee_id, assigned_by, source, reason, started_at, ended_at, end_reason, version';

export async function findOpen(db: Queryable, businessId: string, forUpdate = false): Promise<AssignmentRow | null> {
  const { rows } = await db.query<AssignmentRow>(
    `SELECT ${COLS} FROM calling_assignments WHERE business_id = $1 AND ended_at IS NULL ${forUpdate ? 'FOR UPDATE' : ''}`,
    [businessId]
  );
  return rows[0] ?? null;
}

export async function findById(db: Queryable, id: string): Promise<AssignmentRow | null> {
  const { rows } = await db.query<AssignmentRow>(`SELECT ${COLS} FROM calling_assignments WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Insert the open row. The partial unique index is the arbiter of a race: `null` = already assigned. */
export async function insertOpen(
  db: Queryable,
  a: { businessId: string; assigneeId: string; assignedBy: string | null; source: AssignmentSource; reason: string | null; now: Date }
): Promise<AssignmentRow | null> {
  const { rows } = await db.query<AssignmentRow>(
    `INSERT INTO calling_assignments (business_id, assignee_id, assigned_by, source, reason, started_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6, $6)
     ON CONFLICT (business_id) WHERE ended_at IS NULL DO NOTHING
     RETURNING ${COLS}`,
    [a.businessId, a.assigneeId, a.assignedBy, a.source, a.reason, a.now]
  );
  return rows[0] ?? null;
}

/** Close the open row with an optimistic version check. `null` = changed meanwhile. */
export async function endOpen(
  db: Queryable,
  id: string,
  version: number,
  e: { endedBy: string | null; endReason: 'reassigned' | 'unassigned'; now: Date }
): Promise<AssignmentRow | null> {
  const { rows } = await db.query<AssignmentRow>(
    `UPDATE calling_assignments SET ended_at = $3, ended_by = $4, end_reason = $5, version = version + 1, updated_at = $3
      WHERE id = $1 AND version = $2 AND ended_at IS NULL RETURNING ${COLS}`,
    [id, version, e.now, e.endedBy, e.endReason]
  );
  return rows[0] ?? null;
}

/** Number of assignments an agent received since `since` (DEC-021 per-agent daily cap). */
export async function countAssignedSince(db: Queryable, assigneeId: string, since: Date): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM calling_assignments WHERE assignee_id = $1 AND started_at >= $2',
    [assigneeId, since]
  );
  return rows[0].n;
}

/** Start of "today" in the company timezone (UTC fallback until company.timezone is set). */
export async function startOfCompanyDay(db: Queryable, tz: string, now: Date): Promise<Date> {
  const { rows } = await db.query<{ d: Date }>(
    `SELECT (date_trunc('day', timezone($1::text, $2::timestamptz)) AT TIME ZONE $1::text) AS d`,
    [tz || 'UTC', now]
  );
  return rows[0].d;
}

/**
 * DEC-021 autofill candidates: unassigned, not archived, has a phone (B2), not Rejected/Accepted (B1, B6 proxy),
 * oldest first. The caller re-checks every candidate with the full eligibility rule (incl. open deal) under lock.
 */
export async function autofillCandidates(db: Queryable, limit: number): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT b.id FROM businesses b
       LEFT JOIN business_calling_states s ON s.business_id = b.id
      WHERE b.archived_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM calling_assignments ca WHERE ca.business_id = b.id AND ca.ended_at IS NULL)
        AND COALESCE(s.outcome, 'pending') NOT IN ('rejected', 'accepted')
        AND EXISTS (SELECT 1 FROM business_phones p WHERE p.business_id = b.id)
      ORDER BY b.created_at ASC, b.id
      LIMIT $1`,
    [limit]
  );
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Temporary cross-module reads (see header)
// ---------------------------------------------------------------------------
export interface BusinessFacts {
  id: string;
  name: string;
  archived: boolean;
  hasPhone: boolean;
}

export async function businessFacts(db: Queryable, id: string): Promise<BusinessFacts | null> {
  const { rows } = await db.query<{ id: string; name: string; archived_at: Date | null; has_phone: boolean }>(
    `SELECT b.id, b.name, b.archived_at, EXISTS (SELECT 1 FROM business_phones p WHERE p.business_id = b.id) AS has_phone
       FROM businesses b WHERE b.id = $1`,
    [id]
  );
  const r = rows[0];
  return r ? { id: r.id, name: r.name, archived: r.archived_at !== null, hasPhone: r.has_phone } : null;
}

// ---------------------------------------------------------------------------
// OWN-007 list: businesses with their open assignment (or none)
// ---------------------------------------------------------------------------
export interface AssignmentListRow {
  business_id: string;
  business_name: string;
  id: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_active: boolean | null;
  assigned_by: string | null;
  source: AssignmentSource | null;
  started_at: Date | null;
  version: number | null;
  outcome: string;
  // BL-01 (additive): OWN-007 columns.
  category_name: string | null;
  phone: string | null;
  phone_count: number;
  reservation_holder_id: string | null;
  reservation_holder_name: string | null;
  reservation_acquired_at: Date | null;
  last_attempt_at: Date | null;
  last_attempt_outcome: string | null;
  attempt_count: number;
}

export async function list(
  db: Queryable,
  where: string[],
  params: SqlParams,
  orderBy: string,
  q: { page: number; pageSize: number }
): Promise<{ rows: AssignmentListRow[]; total: number }> {
  // BL-01: category, first phone, active reservation (holder) and last attempt, one row per business.
  const from = `FROM businesses b
     LEFT JOIN calling_assignments ca ON ca.business_id = b.id AND ca.ended_at IS NULL
     LEFT JOIN employees e ON e.id = ca.assignee_id
     LEFT JOIN business_calling_states s ON s.business_id = b.id
     LEFT JOIN categories cat ON cat.id = b.category_id
     LEFT JOIN LATERAL (
       SELECT (SELECT bp.normalized_phone FROM business_phones bp WHERE bp.business_id = b.id ORDER BY bp.position, bp.normalized_phone LIMIT 1) AS phone,
              (SELECT count(*) FROM business_phones bp WHERE bp.business_id = b.id) AS phone_count
     ) ph ON TRUE
     LEFT JOIN contact_reservations r ON r.business_id = b.id AND r.state = 'active'
     LEFT JOIN employees rh ON rh.id = r.holder_id
     LEFT JOIN LATERAL (
       SELECT a.attempted_at, a.outcome, count(*) OVER () AS attempt_count
         FROM call_attempts a WHERE a.business_id = b.id ORDER BY a.attempted_at DESC LIMIT 1
     ) la ON TRUE
    WHERE ${where.length ? where.join(' AND ') : 'TRUE'}`;
  const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, [...params.values]);
  const page = pageClause(q, params);
  const { rows } = await db.query<AssignmentListRow>(
    `SELECT b.id AS business_id, b.name AS business_name, ca.id, ca.assignee_id, e.full_name AS assignee_name,
            e.is_active AS assignee_active, ca.assigned_by, ca.source, ca.started_at, ca.version,
            COALESCE(s.outcome, 'pending') AS outcome,
            cat.name AS category_name,
            ph.phone, COALESCE(ph.phone_count, 0)::int AS phone_count,
            r.holder_id AS reservation_holder_id, rh.full_name AS reservation_holder_name, r.acquired_at AS reservation_acquired_at,
            la.attempted_at AS last_attempt_at, la.outcome AS last_attempt_outcome, COALESCE(la.attempt_count, 0)::int AS attempt_count
       ${from} ${orderBy} ${page}`,
    params.values
  );
  return { rows, total: count.rows[0].n };
}
