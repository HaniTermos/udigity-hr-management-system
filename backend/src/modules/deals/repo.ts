/**
 * MOD-deals — repository (raw parameterised SQL on this module's own tables only). Owner: BE4.
 * Owned tables: deals, deal_developer_assignments, closure_reviews, deal_changes.
 * Every function takes a Queryable (pool or ctx.tx) as its first argument.
 */
import type { Queryable } from '../../db/pool.js';
import { SqlParams } from '../../shared/sql.js';
import { keepPagePlaceholders } from '../../shared/pagination.js';
import type { DealStage } from './schemas.js';

export interface DealRow {
  id: string;
  code: string;
  business_id: string;
  accepted_attempt_id: string;
  accepted_by_id: string;
  stage: DealStage;
  client_needs_note: string;
  assigned_developer_id: string | null;
  signature_date: string | null;
  signature_reference: string | null;
  signature_recorded_by_id: string | null;
  signature_recorded_at: Date | null;
  payment_date: string | null;
  payment_reference: string | null;
  payment_amount: string | null;
  payment_currency: string | null;
  payment_recorded_by_id: string | null;
  payment_recorded_at: Date | null;
  /** D16 contract amount (987). NULL = missing, never zero. */
  contract_amount: string | null;
  contract_currency: string | null;
  closed_at: Date | null;
  closed_by_id: string | null;
  closure_mode: 'ownerVerify' | 'direct' | null;
  not_proceeding_reason: string | null;
  not_proceeding_at: Date | null;
  not_proceeding_by_id: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/** DATE columns as text so no timezone shift happens in the driver. */
const DEAL_COLUMNS = `d.id, d.code, d.business_id, d.accepted_attempt_id, d.accepted_by_id, d.stage, d.client_needs_note,
  d.assigned_developer_id, d.signature_date::text AS signature_date, d.signature_reference, d.signature_recorded_by_id,
  d.signature_recorded_at, d.payment_date::text AS payment_date, d.payment_reference, d.payment_amount::text AS payment_amount,
  d.payment_currency, d.payment_recorded_by_id, d.payment_recorded_at, d.contract_amount::text AS contract_amount,
  d.contract_currency, d.closed_at, d.closed_by_id, d.closure_mode,
  d.not_proceeding_reason, d.not_proceeding_at, d.not_proceeding_by_id, d.version, d.created_at, d.updated_at`;

export async function findById(db: Queryable, id: string, forUpdate = false): Promise<DealRow | null> {
  const { rows } = await db.query<DealRow>(
    `SELECT ${DEAL_COLUMNS} FROM deals d WHERE d.id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findByAttempt(db: Queryable, attemptId: string): Promise<DealRow | null> {
  const { rows } = await db.query<DealRow>(`SELECT ${DEAL_COLUMNS} FROM deals d WHERE d.accepted_attempt_id = $1`, [attemptId]);
  return rows[0] ?? null;
}

export async function findOpenForBusiness(db: Queryable, businessId: string, exceptId?: string): Promise<DealRow | null> {
  const { rows } = await db.query<DealRow>(
    `SELECT ${DEAL_COLUMNS} FROM deals d
      WHERE d.business_id = $1 AND d.stage NOT IN ('closed','not_proceeding') AND ($2::uuid IS NULL OR d.id <> $2::uuid)
      LIMIT 1`,
    [businessId, exceptId ?? null]
  );
  return rows[0] ?? null;
}

export async function insertDeal(
  db: Queryable,
  v: { businessId: string; attemptId: string; acceptedById: string; clientNeedsNote: string; developerId: string | null }
): Promise<DealRow | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO deals (business_id, accepted_attempt_id, accepted_by_id, client_needs_note, assigned_developer_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (accepted_attempt_id) DO NOTHING
     RETURNING id`,
    [v.businessId, v.attemptId, v.acceptedById, v.clientNeedsNote, v.developerId]
  );
  return rows[0] ? findById(db, rows[0].id) : null;
}

/** Columns a command may set (whitelist: identifiers never come from input). */
export type DealColumn =
  | 'stage'
  | 'assigned_developer_id'
  | 'signature_date'
  | 'signature_reference'
  | 'signature_recorded_by_id'
  | 'signature_recorded_at'
  | 'payment_date'
  | 'payment_reference'
  | 'payment_amount'
  | 'payment_currency'
  | 'payment_recorded_by_id'
  | 'payment_recorded_at'
  | 'contract_amount'
  | 'contract_currency'
  | 'closed_at'
  | 'closed_by_id'
  | 'closure_mode'
  | 'not_proceeding_reason'
  | 'not_proceeding_at'
  | 'not_proceeding_by_id';

const DEAL_SETTABLE: ReadonlySet<DealColumn> = new Set<DealColumn>([
  'stage',
  'assigned_developer_id',
  'signature_date',
  'signature_reference',
  'signature_recorded_by_id',
  'signature_recorded_at',
  'payment_date',
  'payment_reference',
  'payment_amount',
  'payment_currency',
  'payment_recorded_by_id',
  'payment_recorded_at',
  'contract_amount',
  'contract_currency',
  'closed_at',
  'closed_by_id',
  'closure_mode',
  'not_proceeding_reason',
  'not_proceeding_at',
  'not_proceeding_by_id',
]);

/** Optimistic update. Returns null when the version no longer matches (caller re-reads). */
export async function updateDeal(
  db: Queryable,
  id: string,
  expectedVersion: number,
  set: Partial<Record<DealColumn, unknown>>,
  now: Date
): Promise<DealRow | null> {
  const p = new SqlParams();
  const parts: string[] = [];
  for (const [col, value] of Object.entries(set) as [DealColumn, unknown][]) {
    if (!DEAL_SETTABLE.has(col)) throw new Error(`deals.updateDeal: column not settable: ${col}`);
    parts.push(`${col} = ${p.add(value)}`);
  }
  const idPh = p.add(id);
  const vPh = p.add(expectedVersion);
  const nowPh = p.add(now);
  const { rows } = await db.query<{ id: string }>(
    `UPDATE deals SET ${parts.join(', ')}${parts.length ? ', ' : ''}version = version + 1, updated_at = ${nowPh}
      WHERE id = ${idPh} AND version = ${vPh} RETURNING id`,
    p.values
  );
  return rows[0] ? findById(db, rows[0].id) : null;
}

// ----- developer assignment history -----
export async function closeCurrentAssignment(db: Queryable, dealId: string, now: Date): Promise<void> {
  await db.query('UPDATE deal_developer_assignments SET unassigned_at = $2 WHERE deal_id = $1 AND unassigned_at IS NULL', [dealId, now]);
}

export async function insertAssignment(db: Queryable, dealId: string, developerId: string, byId: string, now: Date): Promise<void> {
  await db.query(
    'INSERT INTO deal_developer_assignments (deal_id, developer_id, assigned_by_id, assigned_at) VALUES ($1, $2, $3, $4)',
    [dealId, developerId, byId, now]
  );
}

// ----- closure reviews -----
export interface ClosureReviewRow {
  id: string;
  deal_id: string;
  status: 'requested' | 'verified' | 'rejected';
  requested_by_id: string;
  requested_at: Date;
  request_note: string | null;
  decided_by_id: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export async function openReview(db: Queryable, dealId: string): Promise<ClosureReviewRow | null> {
  const { rows } = await db.query<ClosureReviewRow>(
    `SELECT * FROM closure_reviews WHERE deal_id = $1 AND status = 'requested'`,
    [dealId]
  );
  return rows[0] ?? null;
}

export async function latestReview(db: Queryable, dealId: string): Promise<ClosureReviewRow | null> {
  const { rows } = await db.query<ClosureReviewRow>(
    'SELECT * FROM closure_reviews WHERE deal_id = $1 ORDER BY requested_at DESC, created_at DESC LIMIT 1',
    [dealId]
  );
  return rows[0] ?? null;
}

export async function insertReview(db: Queryable, dealId: string, byId: string, note: string | null, now: Date): Promise<ClosureReviewRow> {
  const { rows } = await db.query<ClosureReviewRow>(
    `INSERT INTO closure_reviews (deal_id, requested_by_id, requested_at, request_note) VALUES ($1, $2, $3, $4) RETURNING *`,
    [dealId, byId, now, note]
  );
  return rows[0];
}

export async function decideReview(
  db: Queryable,
  reviewId: string,
  status: 'verified' | 'rejected',
  byId: string,
  reason: string | null,
  now: Date
): Promise<void> {
  await db.query(
    `UPDATE closure_reviews SET status = $2, decided_by_id = $3, decided_at = $4, reject_reason = $5
      WHERE id = $1 AND status = 'requested'`,
    [reviewId, status, byId, now, reason]
  );
}

// ----- history -----
export type DealChangeType =
  | 'signature_recorded'
  | 'payment_recorded'
  | 'fact_removed'
  | 'handoff_updated'
  | 'not_proceeding'
  | 'reopened'
  | 'closed'
  | 'stage_advanced'
  | 'contract_updated'
  | 'financial_corrected';

/**
 * D16: the pipeline stage a deal last held (latest forward move or reopen), for a stage revert after a
 * recorded fact is removed. Null when the deal never left `accepted_opportunity` through a recorded move.
 */
export async function latestPipelineStage(db: Queryable, dealId: string): Promise<string | null> {
  const { rows } = await db.query<{ stage: string | null }>(
    `SELECT after_value->>'stage' AS stage FROM deal_changes
      WHERE deal_id = $1 AND change_type IN ('stage_advanced','reopened')
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [dealId]
  );
  return rows[0]?.stage ?? null;
}

export async function insertChange(
  db: Queryable,
  v: { dealId: string; type: DealChangeType; before?: unknown; after?: unknown; reason?: string | null; actorId: string | null; now: Date }
): Promise<void> {
  await db.query(
    `INSERT INTO deal_changes (deal_id, change_type, before_value, after_value, reason, actor_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      v.dealId,
      v.type,
      v.before === undefined ? null : JSON.stringify(v.before),
      v.after === undefined ? null : JSON.stringify(v.after),
      v.reason ?? null,
      v.actorId,
      v.now,
    ]
  );
}

export async function listChanges(db: Queryable, dealId: string) {
  const { rows } = await db.query<{
    id: string;
    change_type: DealChangeType;
    before_value: unknown;
    after_value: unknown;
    reason: string | null;
    actor_id: string | null;
    created_at: Date;
  }>('SELECT id, change_type, before_value, after_value, reason, actor_id, created_at FROM deal_changes WHERE deal_id = $1 ORDER BY created_at, id', [dealId]);
  return rows;
}

// ----- lists -----
export interface DealListRow extends DealRow {
  open_review: boolean;
  total: string;
}

/** List with a caller-built WHERE (filters + access scopeFilter on alias `d`). */
export async function listDeals(
  db: Queryable,
  where: string[],
  params: SqlParams,
  orderBy: string,
  page: string
): Promise<{ rows: DealListRow[]; total: number }> {
  const { rows } = await db.query<DealListRow>(
    `SELECT ${DEAL_COLUMNS},
            EXISTS (SELECT 1 FROM closure_reviews cr WHERE cr.deal_id = d.id AND cr.status = 'requested') AS open_review,
            COUNT(*) OVER()::text AS total
       FROM deals d
      WHERE ${where.length ? where.join(' AND ') : 'TRUE'}
      ${orderBy} ${page}`,
    params.values
  );
  if (rows[0]) return { rows, total: Number(rows[0].total) };
  return { rows, total: await countWhere(db, where, params, page) };
}

/**
 * C-06: `COUNT(*) OVER()` yields nothing on an empty page, so a page past the end would report total 0.
 * Access filters can add parameters after the LIMIT/OFFSET ones, so the page placeholders stay referenced.
 */
async function countWhere(db: Queryable, where: string[], params: SqlParams, page: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM deals d WHERE ${where.length ? where.join(' AND ') : 'TRUE'}${keepPagePlaceholders(page)}`,
    params.values
  );
  return Number(rows[0]?.n ?? 0);
}

export async function latestNotProceeding(db: Queryable, businessId: string): Promise<DealRow | null> {
  const { rows } = await db.query<DealRow>(
    `SELECT ${DEAL_COLUMNS} FROM deals d
      WHERE d.business_id = $1 AND d.stage = 'not_proceeding'
        AND NOT EXISTS (SELECT 1 FROM deals o WHERE o.business_id = d.business_id AND o.stage NOT IN ('closed','not_proceeding'))
      ORDER BY d.not_proceeding_at DESC NULLS LAST LIMIT 1`,
    [businessId]
  );
  return rows[0] ?? null;
}
