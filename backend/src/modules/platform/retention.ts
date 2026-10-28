/**
 * J-06 `identity.session_cleanup` and J-12 `platform.retention_purge` (F-14, FX-BE).
 *
 * Both jobs are idempotent and bounded: each statement deletes at most BATCH rows per pass and a run
 * makes at most MAX_PASSES passes per table, so a run never holds long locks. Retention windows come
 * from the C3 `retention.*` CFG flags (Demonstration alternative — not approved, docs/policy-defaults.md).
 *
 * Never purged here: audit_events (append-only), business data, call attempts, attendance, deals.
 * Rows still referenced by a RESTRICT foreign key are kept (outbox events with deliveries, reservations
 * with call attempts, enrollment tokens pointed at by a pending factor).
 */
import type { Queryable } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { flags } from '../../shared/flags.js';

const BATCH = 2000;
const MAX_PASSES = 10;
const DAY_MS = 86_400_000;

async function purge(db: Queryable, sql: string, params: unknown[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_PASSES; i++) {
    const res = await db.query(sql, [...params, BATCH]);
    const n = res.rowCount ?? 0;
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

export interface SessionCleanupResult {
  ended: { absolute: number; pending: number; idle: number };
  deleted: number;
}

/**
 * J-06: end sessions whose absolute, pending-2FA or idle window has passed (the same rules as
 * `evaluateSession`, so a stale row cannot be revived), then delete ended sessions older than
 * `retention.sessionsDays`.
 */
export async function cleanupSessions(db: Queryable, now: Date): Promise<SessionCleanupResult> {
  const endSql = (reason: string, predicate: string) => `
    UPDATE sessions SET state = 'ended', end_reason = '${reason}', ended_at = $1,
           revoked_at = COALESCE(revoked_at, $1), is_pending_2fa = false
     WHERE id IN (SELECT id FROM sessions WHERE state <> 'ended' AND ${predicate} LIMIT $3)`;
  const absolute = await purge(db, endSql('absolute_expired', 'expires_at <= $1 AND $2::int >= 0'), [now, 0]);
  const pending = await purge(
    db,
    endSql('pending_expired', `state <> 'active' AND created_at + make_interval(mins => $2::int) <= $1`),
    [now, config.session.pending2faMinutes]
  );
  const idle = await purge(db, endSql('idle_expired', 'idle_expires_at IS NOT NULL AND idle_expires_at <= $1 AND $2::int >= 0'), [now, 0]);
  const cutoff = new Date(now.getTime() - flags['retention.sessionsDays'] * DAY_MS);
  const deleted = await purge(
    db,
    `DELETE FROM sessions WHERE id IN (
       SELECT id FROM sessions WHERE state = 'ended' AND COALESCE(ended_at, expires_at) < $1 LIMIT $2)`,
    [cutoff]
  );
  return { ended: { absolute, pending, idle }, deleted };
}

export interface RetentionResult {
  idempotencyRecords: number;
  outboxConsumerRuns: number;
  outboxEvents: number;
  backgroundJobs: number;
  notificationDeliveries: number;
  reminders: number;
  notificationSecrets: number;
  securityTokens: number;
  contactReservations: number;
  workerHeartbeats: number;
}

/** J-12: delete expired operational rows by the `retention.*` windows. */
export async function retentionPurge(db: Queryable, now: Date): Promise<RetentionResult> {
  const days = (key: 'retention.jobsDays' | 'retention.notificationsDays' | 'retention.tokensDays' | 'retention.reservationsDays') =>
    new Date(now.getTime() - flags[key] * DAY_MS);
  const jobsCutoff = days('retention.jobsDays');
  const notifCutoff = days('retention.notificationsDays');
  const tokensCutoff = days('retention.tokensDays');
  const resCutoff = days('retention.reservationsDays');

  const idempotencyRecords = await purge(
    db,
    `DELETE FROM idempotency_records WHERE ctid IN (SELECT ctid FROM idempotency_records WHERE expires_at < $1 LIMIT $2)`,
    [now]
  );
  // Notification rows first: deliveries reference outbox events (RESTRICT).
  const notificationDeliveries = await purge(
    db,
    `DELETE FROM notification_deliveries WHERE id IN (
       SELECT id FROM notification_deliveries
        WHERE state IN ('sent', 'accepted', 'captured', 'failed', 'suppressed', 'skipped') AND created_at < $1 LIMIT $2)`,
    [notifCutoff]
  );
  const reminders = await purge(
    db,
    `DELETE FROM reminders WHERE id IN (
       SELECT id FROM reminders WHERE state <> 'pending' AND updated_at < $1 LIMIT $2)`,
    [notifCutoff]
  );
  // Done outbox events no delivery points at: consumer runs first (FK RESTRICT, 100_platform_core.sql).
  const doneEvents = `SELECT o.id FROM outbox_events o
     WHERE o.state = 'done' AND o.created_at < $1
       AND NOT EXISTS (SELECT 1 FROM notification_deliveries d WHERE d.event_id = o.id)`;
  const outboxConsumerRuns = await purge(
    db,
    `DELETE FROM outbox_consumer_runs WHERE ctid IN (
       SELECT r.ctid FROM outbox_consumer_runs r WHERE r.event_id IN (${doneEvents}) LIMIT $2)`,
    [jobsCutoff]
  );
  const outboxEvents = await purge(
    db,
    `DELETE FROM outbox_events WHERE id IN (${doneEvents}
        AND NOT EXISTS (SELECT 1 FROM outbox_consumer_runs r WHERE r.event_id = o.id) LIMIT $2)`,
    [jobsCutoff]
  );
  const backgroundJobs = await purge(
    db,
    `DELETE FROM background_jobs WHERE id IN (
       SELECT id FROM background_jobs WHERE state IN ('done', 'dead') AND updated_at < $1 LIMIT $2)`,
    [jobsCutoff]
  );
  // Secrets: the ciphertext is cleared as soon as it is expired; the row goes after the window.
  await db.query(`UPDATE notification_secrets SET ciphertext = NULL WHERE ciphertext IS NOT NULL AND expires_at < $1`, [now]);
  const notificationSecrets = await purge(
    db,
    `DELETE FROM notification_secrets WHERE ref_id IN (
       SELECT ref_id FROM notification_secrets WHERE expires_at < $1 LIMIT $2)`,
    [tokensCutoff]
  );
  const securityTokens = await purge(
    db,
    `DELETE FROM security_tokens WHERE id IN (
       SELECT t.id FROM security_tokens t
        WHERE t.expires_at < $1
          AND NOT EXISTS (SELECT 1 FROM two_factor_factors f WHERE f.pending_enrollment_token_id = t.id)
        LIMIT $2)`,
    [tokensCutoff]
  );
  const contactReservations = await purge(
    db,
    `DELETE FROM contact_reservations WHERE id IN (
       SELECT cr.id FROM contact_reservations cr
        WHERE cr.state <> 'active' AND COALESCE(cr.ended_at, cr.created_at) < $1
          AND NOT EXISTS (SELECT 1 FROM call_attempts a WHERE a.reservation_id = cr.id)
        LIMIT $2)`,
    [resCutoff]
  );
  const workerHeartbeats = await purge(
    db,
    `DELETE FROM worker_heartbeats WHERE worker_id IN (SELECT worker_id FROM worker_heartbeats WHERE last_beat_at < $1 LIMIT $2)`,
    [new Date(now.getTime() - 7 * DAY_MS)]
  );
  return {
    idempotencyRecords,
    outboxConsumerRuns,
    outboxEvents,
    backgroundJobs,
    notificationDeliveries,
    reminders,
    notificationSecrets,
    securityTokens,
    contactReservations,
    workerHeartbeats,
  };
}
