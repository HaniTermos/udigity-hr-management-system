/**
 * MOD-reservation — repository (raw parameterised SQL on this module's own table only). Owner: BE3.
 * Owned table: contact_reservations (migration 320). Every function takes a Queryable (pool or ctx.tx).
 *
 * Holder names: `holderName` reads employees.full_name. This is a temporary read of a BE1 column
 * (precedent BE5-R2) until BE1 ships a batch name op (REQUEST BE3-R3 on the board).
 */
import type { Queryable } from '../../db/pool.js';

export type ReservationState = 'active' | 'released' | 'expired' | 'overridden';
export type ReservationEndReason =
  | 'released'
  | 'call_saved'
  | 'lease_elapsed'
  | 'idle'
  | 'max_total'
  | 'access_denied'
  | 'overridden';

export interface ReservationRow {
  id: string;
  business_id: string;
  holder_id: string;
  lease_token: string;
  state: ReservationState;
  acquired_at: Date;
  last_renewed_at: Date;
  lease_expires_at: Date;
  last_activity_at: Date;
  max_window_started_at: Date;
  ended_at: Date | null;
  end_reason: ReservationEndReason | null;
  ended_by: string | null;
  override_reason: string | null;
  version: number;
}

const COLS = `id, business_id, holder_id, lease_token::text AS lease_token, state, acquired_at, last_renewed_at,
  lease_expires_at, last_activity_at, max_window_started_at, ended_at, end_reason, ended_by, override_reason, version`;

export async function findById(db: Queryable, id: string, forUpdate = false): Promise<ReservationRow | null> {
  const { rows } = await db.query<ReservationRow>(
    `SELECT ${COLS} FROM contact_reservations WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

/** The Active row of a business (lapsed or not; callers decide lazily). */
export async function findActiveByBusiness(db: Queryable, businessId: string, forUpdate = false): Promise<ReservationRow | null> {
  const { rows } = await db.query<ReservationRow>(
    `SELECT ${COLS} FROM contact_reservations WHERE business_id = $1 AND state = 'active' ${forUpdate ? 'FOR UPDATE' : ''}`,
    [businessId]
  );
  return rows[0] ?? null;
}

/**
 * Insert a new Active row. The partial unique index is the arbiter of a race (IC-15): a concurrent
 * winner makes this a no-op and `null` is returned (the caller answers 409 RESERVATION_CONFLICT).
 */
export async function insertActive(
  db: Queryable,
  input: { businessId: string; holderId: string; now: Date; leaseExpiresAt: Date }
): Promise<ReservationRow | null> {
  const { rows } = await db.query<ReservationRow>(
    `INSERT INTO contact_reservations
       (business_id, holder_id, state, acquired_at, last_renewed_at, lease_expires_at, last_activity_at,
        max_window_started_at, created_at, updated_at)
     VALUES ($1, $2, 'active', $3, $3, $4, $3, $3, $3, $3)
     ON CONFLICT (business_id) WHERE state = 'active' DO NOTHING
     RETURNING ${COLS}`,
    [input.businessId, input.holderId, input.now, input.leaseExpiresAt]
  );
  return rows[0] ?? null;
}

export async function renew(
  db: Queryable,
  id: string,
  input: { now: Date; lastActivityAt: Date; maxWindowStartedAt: Date; leaseExpiresAt: Date }
): Promise<ReservationRow> {
  const { rows } = await db.query<ReservationRow>(
    `UPDATE contact_reservations
        SET last_renewed_at = $2, last_activity_at = $3, max_window_started_at = $4, lease_expires_at = $5,
            version = version + 1, updated_at = $2
      WHERE id = $1 AND state = 'active'
      RETURNING ${COLS}`,
    [id, input.now, input.lastActivityAt, input.maxWindowStartedAt, input.leaseExpiresAt]
  );
  return rows[0];
}

/**
 * Conditional end (single writer): only an Active row changes, so the sweep and a lazy expiry on
 * acquire can never both record `contact_reservation.expired`.
 */
export async function endIfActive(
  db: Queryable,
  id: string,
  input: { state: Exclude<ReservationState, 'active'>; reason: ReservationEndReason; endedBy: string | null; overrideReason?: string | null; now: Date }
): Promise<ReservationRow | null> {
  const { rows } = await db.query<ReservationRow>(
    `UPDATE contact_reservations
        SET state = $2, end_reason = $3, ended_by = $4, override_reason = $5, ended_at = $6,
            version = version + 1, updated_at = $6
      WHERE id = $1 AND state = 'active'
      RETURNING ${COLS}`,
    [id, input.state, input.reason, input.endedBy, input.overrideReason ?? null, input.now]
  );
  return rows[0] ?? null;
}

/** J-05: Active rows whose lease has passed. SKIP LOCKED so a request holding the row is not blocked. */
export async function lockLapsed(db: Queryable, now: Date, limit: number): Promise<ReservationRow[]> {
  const { rows } = await db.query<ReservationRow>(
    `SELECT ${COLS} FROM contact_reservations
      WHERE state = 'active' AND lease_expires_at <= $1
      ORDER BY lease_expires_at
      LIMIT $2
      FOR UPDATE SKIP LOCKED`,
    [now, limit]
  );
  return rows;
}

/** Temporary read of employees.full_name (see header). */
export async function holderName(db: Queryable, employeeId: string): Promise<string> {
  const { rows } = await db.query<{ full_name: string }>('SELECT full_name FROM employees WHERE id = $1', [employeeId]);
  return rows[0]?.full_name ?? '';
}

/** Resource resolver read (R-06 `reservation` → its business). */
export async function businessOf(db: Queryable, id: string): Promise<string | null> {
  const { rows } = await db.query<{ business_id: string }>('SELECT business_id FROM contact_reservations WHERE id = $1', [id]);
  return rows[0]?.business_id ?? null;
}

/** Live Active holders for a set of businesses (lease not passed). */
export async function liveHolders(db: Queryable, businessIds: readonly string[], now: Date): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (businessIds.length === 0) return out;
  const { rows } = await db.query<{ business_id: string; holder_id: string }>(
    `SELECT business_id, holder_id FROM contact_reservations
      WHERE business_id = ANY($1::uuid[]) AND state = 'active' AND lease_expires_at > $2`,
    [[...new Set(businessIds)], now]
  );
  for (const r of rows) out.set(r.business_id, r.holder_id);
  return out;
}
