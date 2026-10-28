/**
 * MOD-corrections — repository (raw parameterised SQL). Owner: BE2.
 * Owned table: data_correction_requests. Reads `employees` for display names and `access_facts` (BE2 view)
 * for the archive fact only.
 */
import type { Queryable } from '../../db/pool.js';
import type { SqlParams } from '../../shared/sql.js';
import type { CorrectionStatus } from './schemas.js';

export interface CorrectionDbRow {
  id: string;
  business_id: string;
  requested_by: string;
  requested_by_name: string | null;
  requested_by_role: string | null;
  issue_type: string;
  field: string | null;
  description: string;
  suggested_value: string | null;
  status: CorrectionStatus;
  reviewer_id: string | null;
  reviewer_name: string | null;
  review_started_at: Date | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `
  SELECT r.id, r.business_id, r.requested_by, rq.full_name AS requested_by_name, rq.role AS requested_by_role,
         r.issue_type, r.field, r.description, r.suggested_value, r.status, r.reviewer_id, rv.full_name AS reviewer_name,
         r.review_started_at, r.resolution_note, r.resolved_by, rs.full_name AS resolved_by_name, r.resolved_at,
         r.version, r.created_at, r.updated_at
    FROM data_correction_requests r
    LEFT JOIN employees rq ON rq.id = r.requested_by
    LEFT JOIN employees rv ON rv.id = r.reviewer_id
    LEFT JOIN employees rs ON rs.id = r.resolved_by`;

export async function findCorrection(db: Queryable, id: string, forUpdate = false): Promise<CorrectionDbRow | null> {
  const { rows } = await db.query<CorrectionDbRow>(`${SELECT} WHERE r.id = $1 ${forUpdate ? 'FOR UPDATE OF r' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function insertCorrection(
  db: Queryable,
  v: { businessId: string; requestedBy: string; issueType: string; field: string | null; description: string; suggestedValue: string | null }
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO data_correction_requests (business_id, requested_by, issue_type, field, description, suggested_value)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [v.businessId, v.requestedBy, v.issueType, v.field, v.description, v.suggestedValue]
  );
  return rows[0].id;
}

export interface Transition {
  status: CorrectionStatus;
  reviewerId?: string | null;
  reviewStartedAt?: Date | null;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
}

/** State change with the optimistic version check (plan §4.5). Returns the new version or null. */
export async function transition(db: Queryable, id: string, expectedVersion: number, t: Transition): Promise<number | null> {
  const keep = (v: unknown) => v === undefined;
  const { rows } = await db.query<{ version: number }>(
    `UPDATE data_correction_requests
        SET status = $3,
            reviewer_id = CASE WHEN $4 THEN reviewer_id ELSE $5::uuid END,
            review_started_at = CASE WHEN $6 THEN review_started_at ELSE $7::timestamptz END,
            resolution_note = CASE WHEN $8 THEN resolution_note ELSE $9::varchar END,
            resolved_by = CASE WHEN $10 THEN resolved_by ELSE $11::uuid END,
            resolved_at = CASE WHEN $12 THEN resolved_at ELSE $13::timestamptz END,
            version = version + 1, updated_at = now()
      WHERE id = $1 AND version = $2
      RETURNING version`,
    [
      id,
      expectedVersion,
      t.status,
      keep(t.reviewerId),
      t.reviewerId ?? null,
      keep(t.reviewStartedAt),
      t.reviewStartedAt ?? null,
      keep(t.resolutionNote),
      t.resolutionNote ?? null,
      keep(t.resolvedBy),
      t.resolvedBy ?? null,
      keep(t.resolvedAt),
      t.resolvedAt ?? null,
    ]
  );
  return rows[0]?.version ?? null;
}

export async function inReviewByReviewer(db: Queryable, reviewerId: string): Promise<{ id: string; version: number }[]> {
  const { rows } = await db.query<{ id: string; version: number }>(
    `SELECT id, version FROM data_correction_requests WHERE reviewer_id = $1 AND status = 'in_review' FOR UPDATE`,
    [reviewerId]
  );
  return rows;
}

export async function openForBusinesses(db: Queryable, businessIds: readonly string[]): Promise<CorrectionDbRow[]> {
  if (businessIds.length === 0) return [];
  const { rows } = await db.query<CorrectionDbRow>(
    `${SELECT} WHERE r.business_id = ANY($1::uuid[]) AND r.status IN ('submitted', 'in_review') ORDER BY r.created_at`,
    [businessIds]
  );
  return rows;
}

export async function openBusinessIds(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ business_id: string }>(
    `SELECT DISTINCT business_id FROM data_correction_requests WHERE status IN ('submitted', 'in_review')`
  );
  return rows.map((r) => r.business_id);
}

export interface ListSql {
  /** Predicates without the tab/status filter (used for tabCounts and requesters). */
  base: string[];
  /** Tab + status predicates. */
  tab: string[];
  params: SqlParams;
  orderBy: string;
  page: number;
  pageSize: number;
}

export async function listCorrections(
  db: Queryable,
  q: ListSql
): Promise<{ rows: CorrectionDbRow[]; total: number; tabCounts: { open: number; resolved: number; closed: number; withdrawn: number }; requesters: string[] }> {
  const base = q.base.length ? q.base.join(' AND ') : 'TRUE';
  const all = q.tab.length ? `${base} AND ${q.tab.join(' AND ')}` : base;
  const p = q.params;
  const FROM = `FROM data_correction_requests r LEFT JOIN employees rq ON rq.id = r.requested_by`;
  const { rows: c } = await db.query<{ total: number; open: number; resolved: number; closed: number; withdrawn: number }>(
    `SELECT (SELECT count(*)::int ${FROM} WHERE ${all}) AS total,
            count(*) FILTER (WHERE r.status IN ('submitted', 'in_review'))::int AS open,
            count(*) FILTER (WHERE r.status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE r.status IN ('closed', 'rejected'))::int AS closed,
            count(*) FILTER (WHERE r.status = 'withdrawn')::int AS withdrawn
       ${FROM} WHERE ${base}`,
    p.values
  );
  const { rows: names } = await db.query<{ names: string[] | null }>(
    `SELECT array_agg(DISTINCT rq.full_name ORDER BY rq.full_name) AS names ${FROM} WHERE ${base} AND rq.full_name IS NOT NULL`,
    p.values
  );
  const limit = p.add(q.pageSize);
  const offset = p.add((q.page - 1) * q.pageSize);
  const { rows } = await db.query<CorrectionDbRow>(`${SELECT} WHERE ${all} ${q.orderBy} LIMIT ${limit} OFFSET ${offset}`, p.values);
  const t = c[0];
  return {
    rows,
    total: t.total,
    tabCounts: { open: t.open, resolved: t.resolved, closed: t.closed, withdrawn: t.withdrawn },
    requesters: (names[0].names ?? []).slice(0, 200),
  };
}
