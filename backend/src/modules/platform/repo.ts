/**
 * MOD-platform — repository (raw parameterised SQL on this module's own tables only). Owner: BE5.
 * Owned tables: outbox_events, outbox_consumer_runs, background_jobs, idempotency_records, worker_heartbeats.
 * Every function takes a Queryable (pool or ctx.tx) first. Time is always passed in (`now`) so the
 * test clock applies; SQL `now()` is used only for created_at/updated_at bookkeeping.
 */
import type { Queryable } from '../../db/pool.js';

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export interface OutboxRow {
  id: string;
  name: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, string | number | boolean | null>;
  state: 'pending' | 'done' | 'dead';
  attempts: number;
  created_at: Date;
  /** Lease this claim holds; completion only applies while it is still the row's lease (D-07). */
  lease_until: Date;
}

export async function insertOutboxEvent(
  db: Queryable,
  e: { name: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown> },
  now: Date
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO outbox_events (name, aggregate_type, aggregate_id, payload, next_attempt_at)
     VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
    [e.name, e.aggregateType, e.aggregateId, JSON.stringify(e.payload), now]
  );
  return rows[0].id;
}

/**
 * Claim up to `limit` due events (committed rows only; SKIP LOCKED; lease). Increments attempts.
 * Rows that already used `maxAttempts` claims are never claimed again (C-08: a poison event that
 * crashes the worker is dead-ended by `deadenOverCapOutbox`, not looped).
 */
export async function claimOutboxEvents(
  db: Queryable,
  now: Date,
  leaseSeconds: number,
  limit: number,
  maxAttempts: number
): Promise<OutboxRow[]> {
  const { rows } = await db.query<OutboxRow>(
    `UPDATE outbox_events o
        SET attempts = o.attempts + 1,
            lease_until = $1::timestamptz + make_interval(secs => $2::double precision),
            updated_at = now()
      WHERE o.id IN (
        SELECT id FROM outbox_events
         WHERE state = 'pending' AND next_attempt_at <= $1 AND attempts < $4
           AND (lease_until IS NULL OR lease_until < $1)
         ORDER BY created_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED)
      RETURNING o.id, o.name, o.aggregate_type, o.aggregate_id, o.payload, o.state, o.attempts, o.created_at, o.lease_until`,
    [now, leaseSeconds, limit, maxAttempts]
  );
  return rows.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
}

/** Record a consumer as completed for an event. Returns false when it already ran (idempotency). */
export async function markConsumerRun(db: Queryable, eventId: string, consumer: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO outbox_consumer_runs (event_id, consumer) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [eventId, consumer]
  );
  return (rowCount ?? 0) > 0;
}

export async function completedConsumers(db: Queryable, eventId: string): Promise<Set<string>> {
  const { rows } = await db.query<{ consumer: string }>(
    'SELECT consumer FROM outbox_consumer_runs WHERE event_id = $1',
    [eventId]
  );
  return new Set(rows.map((r) => r.consumer));
}

/** Mark done only while `lease` is still this run's claim (D-07). Returns false when the claim was lost. */
export async function markOutboxDone(db: Queryable, id: string, now: Date, lease: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE outbox_events SET state = 'done', relayed_at = $2, lease_until = NULL, last_error = NULL, updated_at = now()
     WHERE id = $1 AND state = 'pending' AND lease_until = $3`,
    [id, now, lease]
  );
  return (rowCount ?? 0) > 0;
}

export async function markOutboxRetry(
  db: Queryable,
  id: string,
  nextAttemptAt: Date,
  error: string,
  dead: boolean,
  lease: Date
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE outbox_events SET state = $2, next_attempt_at = $3, lease_until = NULL, last_error = $4, updated_at = now()
     WHERE id = $1 AND state = 'pending' AND lease_until = $5`,
    [id, dead ? 'dead' : 'pending', nextAttemptAt, error.slice(0, 500), lease]
  );
  return (rowCount ?? 0) > 0;
}

/** C-08: pending events whose lease expired after their last allowed attempt go dead. Returns them for alerting. */
export async function deadenOverCapOutbox(
  db: Queryable,
  now: Date,
  maxAttempts: number
): Promise<{ id: string; name: string; attempts: number }[]> {
  const { rows } = await db.query<{ id: string; name: string; attempts: number }>(
    `UPDATE outbox_events SET state = 'dead', lease_until = NULL, updated_at = now(),
            last_error = COALESCE(last_error, 'attempt cap reached (worker crashed or timed out)')
      WHERE state = 'pending' AND attempts >= $2 AND (lease_until IS NULL OR lease_until < $1)
      RETURNING id, name, attempts`,
    [now, maxAttempts]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Background jobs
// ---------------------------------------------------------------------------

export interface JobRow {
  id: string;
  kind: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  /** Lease this claim holds; completion only applies while it is still the row's lease (D-07). */
  lease_until: Date;
}

/** Insert a job; duplicate (kind, dedupe_key) is a no-op. Returns true when a row was inserted. */
export async function insertJob(
  db: Queryable,
  j: { kind: string; dedupeKey: string; runAt: Date; payload: Record<string, unknown>; maxAttempts: number }
): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO background_jobs (kind, dedupe_key, payload, run_at, max_attempts)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT ON CONSTRAINT uq_background_jobs_kind_dedupe DO NOTHING`,
    [j.kind, j.dedupeKey, JSON.stringify(j.payload), j.runAt, j.maxAttempts]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Claim due jobs of the given kinds (SKIP LOCKED + lease). Expired leases are reclaimable. Each kind has its
 * own lease (`leases[i]` for `kinds[i]`, D-07). Rows that used all `max_attempts` claims are not claimed (C-08).
 */
export async function claimJobs(db: Queryable, kinds: string[], leases: number[], now: Date, limit: number): Promise<JobRow[]> {
  if (kinds.length === 0) return [];
  const { rows } = await db.query<JobRow>(
    `UPDATE background_jobs j
        SET attempts = j.attempts + 1,
            lease_until = $1::timestamptz + make_interval(secs => (
              SELECT t.l FROM unnest($2::text[], $4::double precision[]) AS t(k, l) WHERE t.k = j.kind LIMIT 1)),
            updated_at = now()
      WHERE j.id IN (
        SELECT id FROM background_jobs
         WHERE state = 'queued' AND run_at <= $1 AND kind = ANY($2::text[]) AND attempts < max_attempts
           AND (lease_until IS NULL OR lease_until < $1)
         ORDER BY run_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED)
      RETURNING j.id, j.kind, j.dedupe_key, j.payload, j.attempts, j.max_attempts, j.lease_until`,
    [now, kinds, limit, leases]
  );
  return rows;
}

/** C-08: queued jobs that used every attempt and whose lease expired (crashed runs) go dead. Returns them for alerting. */
export async function deadenOverCapJobs(db: Queryable, kinds: string[], now: Date): Promise<{ id: string; kind: string; attempts: number }[]> {
  const { rows } = await db.query<{ id: string; kind: string; attempts: number }>(
    `UPDATE background_jobs SET state = 'dead', lease_until = NULL, updated_at = now(),
            last_error = COALESCE(last_error, 'attempt cap reached (worker crashed or timed out)')
      WHERE state = 'queued' AND kind = ANY($2::text[]) AND attempts >= max_attempts AND (lease_until IS NULL OR lease_until < $1)
      RETURNING id, kind, attempts`,
    [now, kinds]
  );
  return rows;
}

/** Mark done only while `lease` is still this run's claim (D-07). Returns false when the claim was lost. */
export async function markJobDone(db: Queryable, id: string, now: Date, lease: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE background_jobs SET state = 'done', completed_at = $2, lease_until = NULL, last_error = NULL, updated_at = now()
     WHERE id = $1 AND state = 'queued' AND lease_until = $3`,
    [id, now, lease]
  );
  return (rowCount ?? 0) > 0;
}

export async function markJobRetry(db: Queryable, id: string, runAt: Date, error: string, dead: boolean, lease: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE background_jobs SET state = $2, run_at = $3, lease_until = NULL, last_error = $4, updated_at = now()
     WHERE id = $1 AND state = 'queued' AND lease_until = $5`,
    [id, dead ? 'dead' : 'queued', runAt, error.slice(0, 500), lease]
  );
  return (rowCount ?? 0) > 0;
}


// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

export interface IdemKey {
  actorId: string;
  operation: string;
  key: string;
}

export interface IdemRow {
  request_hash: string;
  status: number;
  body: unknown;
}

export async function findIdempotency(db: Queryable, k: IdemKey, now: Date): Promise<IdemRow | null> {
  const { rows } = await db.query<IdemRow>(
    `SELECT request_hash, status, body FROM idempotency_records
     WHERE actor_id = $1 AND operation = $2 AND idem_key = $3 AND expires_at > $4`,
    [k.actorId, k.operation, k.key, now]
  );
  return rows[0] ?? null;
}

/**
 * Claim a key (status 0 = in progress). An expired record is taken over. Returns true when this
 * request owns the key.
 */
export async function claimIdempotency(db: Queryable, k: IdemKey, requestHash: string, now: Date, expiresAt: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO idempotency_records (actor_id, operation, idem_key, request_hash, status, body, expires_at)
     VALUES ($1, $2, $3, $4, 0, NULL, $6)
     ON CONFLICT (actor_id, operation, idem_key) DO UPDATE
        SET request_hash = EXCLUDED.request_hash, status = 0, body = NULL,
            created_at = now(), expires_at = EXCLUDED.expires_at
      WHERE idempotency_records.expires_at <= $5`,
    [k.actorId, k.operation, k.key, requestHash, now, expiresAt]
  );
  return (rowCount ?? 0) > 0;
}

export async function saveIdempotency(db: Queryable, k: IdemKey, r: IdemRow, expiresAt: Date): Promise<void> {
  await db.query(
    `INSERT INTO idempotency_records (actor_id, operation, idem_key, request_hash, status, body, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (actor_id, operation, idem_key) DO UPDATE
        SET status = EXCLUDED.status, body = EXCLUDED.body
      WHERE idempotency_records.request_hash = EXCLUDED.request_hash`,
    [k.actorId, k.operation, k.key, r.request_hash, r.status, JSON.stringify(r.body ?? null), expiresAt]
  );
}

/** Release an in-progress claim (the request failed with 5xx, so a retry must run again). */
export async function releaseIdempotency(db: Queryable, k: IdemKey): Promise<void> {
  await db.query(
    `DELETE FROM idempotency_records WHERE actor_id = $1 AND operation = $2 AND idem_key = $3 AND status = 0`,
    [k.actorId, k.operation, k.key]
  );
}

// ---------------------------------------------------------------------------
// Worker heartbeats
// ---------------------------------------------------------------------------

export async function upsertHeartbeat(db: Queryable, workerId: string, pid: number, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO worker_heartbeats (worker_id, pid, started_at, last_beat_at) VALUES ($1, $2, $3, $3)
     ON CONFLICT (worker_id) DO UPDATE SET pid = EXCLUDED.pid, last_beat_at = EXCLUDED.last_beat_at`,
    [workerId, pid, now]
  );
}

export async function latestHeartbeat(db: Queryable): Promise<Date | null> {
  const { rows } = await db.query<{ last: Date | null }>('SELECT max(last_beat_at) AS last FROM worker_heartbeats');
  return rows[0]?.last ?? null;
}

export async function countOutboxByState(db: Queryable): Promise<Record<string, number>> {
  const { rows } = await db.query<{ state: string; n: string }>(
    `SELECT state, count(*)::text AS n FROM outbox_events WHERE state IN ('pending', 'dead') GROUP BY state`
  );
  return Object.fromEntries(rows.map((r) => [r.state, Number(r.n)]));
}

/** F-12: give back claims that were not started (time budget spent): the attempt is not counted. */
export async function releaseOutboxClaims(db: Queryable, claims: { id: string; lease: Date }[]): Promise<void> {
  for (const c of claims) {
    await db.query(
      `UPDATE outbox_events SET lease_until = NULL, attempts = GREATEST(attempts - 1, 0), updated_at = now()
       WHERE id = $1 AND state = 'pending' AND lease_until = $2`,
      [c.id, c.lease]
    );
  }
}
