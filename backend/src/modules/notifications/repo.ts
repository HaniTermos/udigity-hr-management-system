/**
 * MOD-notifications — repository (raw parameterised SQL). Owner: BE5.
 * Owned tables: notification_deliveries, notification_secrets, reminders.
 * Every function takes a Queryable first; time is passed in (`now`) so the test clock applies.
 */
import type { Queryable } from '../../db/pool.js';

/**
 * `sent`: in-app row (delivered by being written). E-mail outcomes (migration 972): `accepted` = SMTP
 * provider accepted it (not proof of delivery), `captured` = log / test memory transport, never delivered.
 */
export type DeliveryState = 'pending' | 'retry_pending' | 'sent' | 'accepted' | 'captured' | 'failed' | 'suppressed' | 'skipped';

export interface DeliveryRow {
  id: string;
  dedupe_key: string;
  event_id: string | null;
  family: 'security' | 'business';
  template: string;
  channel: 'email' | 'in_app';
  recipient_id: string;
  source_type: string | null;
  source_id: string | null;
  state: DeliveryState;
  attempt_count: number;
  last_error?: string | null;
  read_at?: Date | null;
  created_at: Date;
}

export interface ReminderRow {
  id: string;
  dedupe_key: string;
  source_type: 'follow_up' | 'meeting';
  source_id: string;
  recipient_id: string;
  channel: 'email' | 'in_app';
  scheduled_for: Date;
  lead_minutes: number;
  state: 'pending' | 'sent' | 'cancelled' | 'failed' | 'suppressed' | 'skipped';
  attempt_count: number;
  last_error: string | null;
  sent_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export async function insertDelivery(
  db: Queryable,
  d: {
    dedupeKey: string;
    eventId: string | null;
    family: 'security' | 'business';
    template: string;
    channel: 'email' | 'in_app';
    recipientId: string;
    sourceType: string | null;
    sourceId: string | null;
    state?: DeliveryState;
    lastError?: string | null;
  },
  now: Date
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO notification_deliveries
       (dedupe_key, event_id, family, template, channel, recipient_id, source_type, source_id, state, last_error, next_attempt_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [
      d.dedupeKey,
      d.eventId,
      d.family,
      d.template,
      d.channel,
      d.recipientId,
      d.sourceType,
      d.sourceId,
      d.state ?? 'pending',
      d.lastError ?? null,
      now,
    ]
  );
  return rows[0]?.id ?? null;
}

/** Claim due email deliveries (SKIP LOCKED + lease). Increments attempt_count. */
export async function claimDueEmailDeliveries(db: Queryable, now: Date, leaseSeconds: number, limit: number): Promise<DeliveryRow[]> {
  const { rows } = await db.query<DeliveryRow>(
    `UPDATE notification_deliveries d
        SET attempt_count = d.attempt_count + 1,
            lease_until = $1::timestamptz + make_interval(secs => $2::double precision),
            updated_at = now()
      WHERE d.id IN (
        SELECT id FROM notification_deliveries
         WHERE channel = 'email' AND state IN ('pending', 'retry_pending') AND next_attempt_at <= $1
           AND (lease_until IS NULL OR lease_until < $1)
         ORDER BY next_attempt_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED)
      RETURNING d.id, d.dedupe_key, d.event_id, d.family, d.template, d.channel, d.recipient_id,
                d.source_type, d.source_id, d.state, d.attempt_count, d.created_at`,
    [now, leaseSeconds, limit]
  );
  return rows;
}

export async function recordDeliveryResult(
  db: Queryable,
  id: string,
  r: { state: DeliveryState; nextAttemptAt?: Date; error?: string | null; providerMessageId?: string | null; sentAt?: Date | null }
): Promise<void> {
  await db.query(
    `UPDATE notification_deliveries
        SET state = $2,
            next_attempt_at = COALESCE($3, next_attempt_at),
            last_error = $4,
            provider_message_id = COALESCE($5, provider_message_id),
            sent_at = COALESCE($6, sent_at),
            lease_until = NULL,
            version = version + 1,
            updated_at = now()
      WHERE id = $1`,
    [id, r.state, r.nextAttemptAt ?? null, r.error ? r.error.slice(0, 500) : null, r.providerMessageId ?? null, r.sentAt ?? null]
  );
}

export async function getDelivery(db: Queryable, id: string): Promise<(DeliveryRow & { last_error: string | null; next_attempt_at: Date }) | null> {
  const { rows } = await db.query<DeliveryRow & { last_error: string | null; next_attempt_at: Date }>(
    'SELECT * FROM notification_deliveries WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

/** EM-7: security emails of one template queued/sent to a recipient since `since` (excl. suppressed). */
export async function countRecentSecurityEmails(db: Queryable, recipientId: string, template: string, since: Date): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notification_deliveries
      WHERE recipient_id = $1 AND template = $2 AND family = 'security'
        AND state NOT IN ('suppressed', 'skipped') AND created_at >= $3`,
    [recipientId, template, since]
  );
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// In-App Notifications (AR-14)
// ---------------------------------------------------------------------------

export async function listInAppDeliveries(
  db: Queryable,
  recipientId: string,
  options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
): Promise<{ items: DeliveryRow[]; total: number }> {
  const params: unknown[] = [recipientId];
  const conditions = [`recipient_id = $1`, `channel = 'in_app'`];

  if (options.unreadOnly) {
    conditions.push(`read_at IS NULL`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const countRes = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM notification_deliveries ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  params.push(limit, offset);

  const { rows } = await db.query<DeliveryRow>(
    `SELECT id, dedupe_key, event_id, family, template, channel, recipient_id,
            source_type, source_id, state, attempt_count, last_error, read_at, created_at
       FROM notification_deliveries
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { items: rows, total };
}

export async function countUnreadInApp(db: Queryable, recipientId: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM notification_deliveries
      WHERE recipient_id = $1 AND channel = 'in_app' AND read_at IS NULL`,
    [recipientId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function markDeliveryRead(db: Queryable, id: string, recipientId: string, now: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE notification_deliveries
        SET read_at = $3, updated_at = now()
      WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL`,
    [id, recipientId, now]
  );
  return (rowCount ?? 0) > 0;
}

export async function markAllDeliveriesRead(db: Queryable, recipientId: string, now: Date): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE notification_deliveries
        SET read_at = $2, updated_at = now()
      WHERE recipient_id = $1 AND channel = 'in_app' AND read_at IS NULL`,
    [recipientId, now]
  );
  return rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Reminders (J-01, plan §7.1)
// ---------------------------------------------------------------------------

export async function upsertReminder(
  db: Queryable,
  r: {
    dedupeKey: string;
    sourceType: 'follow_up' | 'meeting';
    sourceId: string;
    recipientId: string;
    channel?: 'email' | 'in_app';
    scheduledFor: Date;
    leadMinutes?: number;
  }
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO reminders
       (dedupe_key, source_type, source_id, recipient_id, channel, scheduled_for, lead_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (dedupe_key) DO UPDATE
       SET scheduled_for = EXCLUDED.scheduled_for,
           recipient_id = EXCLUDED.recipient_id,
           state = 'pending',
           attempt_count = 0,
           updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      r.dedupeKey,
      r.sourceType,
      r.sourceId,
      r.recipientId,
      r.channel ?? 'email',
      r.scheduledFor,
      r.leadMinutes ?? 0,
    ]
  );
  return rows[0].id;
}

export async function cancelRemindersForSource(
  db: Queryable,
  sourceType: 'follow_up' | 'meeting',
  sourceId: string
): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE reminders
        SET state = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE source_type = $1 AND source_id = $2 AND state = 'pending'`,
    [sourceType, sourceId]
  );
  return rowCount ?? 0;
}

export async function claimDueReminders(
  db: Queryable,
  now: Date,
  limit: number
): Promise<ReminderRow[]> {
  const { rows } = await db.query<ReminderRow>(
    `UPDATE reminders r
        SET attempt_count = r.attempt_count + 1,
            updated_at = now()
      WHERE r.id IN (
        SELECT id FROM reminders
         WHERE state = 'pending' AND scheduled_for <= $1
         ORDER BY scheduled_for
         LIMIT $2
         FOR UPDATE SKIP LOCKED)
      RETURNING *`,
    [now, limit]
  );
  return rows;
}

export async function recordReminderResult(
  db: Queryable,
  id: string,
  r: { state: 'sent' | 'failed' | 'suppressed' | 'skipped'; error?: string | null; sentAt?: Date | null }
): Promise<void> {
  await db.query(
    `UPDATE reminders
        SET state = $2,
            last_error = $3,
            sent_at = COALESCE($4, sent_at),
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [id, r.state, r.error ? r.error.slice(0, 500) : null, r.sentAt ?? null]
  );
}

export async function getReminderById(db: Queryable, id: string): Promise<ReminderRow | null> {
  const { rows } = await db.query<ReminderRow>('SELECT * FROM reminders WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Delivery Monitor (SCR-OWN-012, AR-13)
// ---------------------------------------------------------------------------

export interface MonitorItemRow {
  id: string;
  kind: 'reminder' | 'notification' | 'provisioning';
  family: string;
  template_or_source: string;
  recipient_name: string;
  recipient_email: string;
  channel: string;
  state: string;
  attempt_count: number;
  last_error: string | null;
  next_attempt_at: Date | null;
  sent_at: Date | null;
  created_at: Date;
}

export async function listDeliveryMonitorRows(
  db: Queryable,
  options: { kind?: 'reminder' | 'notification' | 'provisioning'; state?: string; limit?: number; offset?: number } = {}
): Promise<{ items: MonitorItemRow[]; total: number }> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let filter = '';
  const filterParams: unknown[] = [];
  if (options.kind) {
    filter = 'WHERE kind = $1';
    filterParams.push(options.kind);
  }

  const countQuery = `
    WITH combined AS (
      SELECT d.id, 'notification'::text AS kind FROM notification_deliveries d
      UNION ALL
      SELECT r.id, 'reminder'::text AS kind FROM reminders r
    )
    SELECT count(*)::text AS count FROM combined
    ${filter}
  `;

  const countRes = await db.query<{ count: string }>(countQuery, filterParams);
  const total = Number(countRes.rows[0]?.count ?? 0);

  const queryParams = [...filterParams, limit, offset];
  const limitIdx = filterParams.length + 1;
  const offsetIdx = filterParams.length + 2;

  const query = `
    WITH combined AS (
      SELECT d.id,
             'notification'::text AS kind,
             d.family::text AS family,
             d.template::text AS template_or_source,
             COALESCE(e.full_name, 'Unknown') AS recipient_name,
             COALESCE(e.email, 'unknown@udigity.com') AS recipient_email,
             d.channel::text AS channel,
             d.state::text AS state,
             d.attempt_count,
             d.last_error,
             d.next_attempt_at,
             d.sent_at,
             d.created_at
        FROM notification_deliveries d
        LEFT JOIN employees e ON e.id = d.recipient_id
       UNION ALL
      SELECT r.id,
             'reminder'::text AS kind,
             'business'::text AS family,
             (r.source_type || ' reminder')::text AS template_or_source,
             COALESCE(e.full_name, 'Unknown') AS recipient_name,
             COALESCE(e.email, 'unknown@udigity.com') AS recipient_email,
             r.channel::text AS channel,
             r.state::text AS state,
             r.attempt_count,
             r.last_error,
             r.scheduled_for AS next_attempt_at,
             r.sent_at,
             r.created_at
        FROM reminders r
        LEFT JOIN employees e ON e.id = r.recipient_id
    )
    SELECT * FROM combined
    ${filter}
    ORDER BY created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await db.query<MonitorItemRow>(query, queryParams);
  return { items: rows, total };
}

export async function retryDelivery(db: Queryable, id: string, now: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE notification_deliveries
        SET state = 'pending',
            next_attempt_at = $2,
            attempt_count = 0,
            last_error = NULL,
            lease_until = NULL,
            updated_at = now()
      WHERE id = $1 AND channel = 'email' AND state IN ('failed', 'suppressed', 'skipped')`,
    [id, now]
  );
  return (rowCount ?? 0) > 0;
}

export async function retryReminder(db: Queryable, id: string, now: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE reminders
        SET state = 'pending',
            scheduled_for = $2,
            attempt_count = 0,
            last_error = NULL,
            updated_at = now()
      WHERE id = $1 AND state IN ('failed', 'suppressed')`,
    [id, now]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// One-time secrets
// ---------------------------------------------------------------------------

export async function insertSecret(db: Queryable, refId: string, ciphertext: string, expiresAt: Date): Promise<void> {
  await db.query(
    `INSERT INTO notification_secrets (ref_id, ciphertext, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (ref_id) DO NOTHING`,
    [refId, ciphertext, expiresAt]
  );
}

export async function getSecret(db: Queryable, refId: string, now: Date): Promise<string | null> {
  const { rows } = await db.query<{ ciphertext: string | null }>(
    `SELECT ciphertext FROM notification_secrets WHERE ref_id = $1 AND consumed_at IS NULL AND expires_at > $2`,
    [refId, now]
  );
  return rows[0]?.ciphertext ?? null;
}

/** Clear the ciphertext once it is no longer needed (sent, failed, suppressed). */
export async function consumeSecret(db: Queryable, refId: string, now: Date): Promise<void> {
  await db.query(`UPDATE notification_secrets SET ciphertext = NULL, consumed_at = $2 WHERE ref_id = $1`, [refId, now]);
}

// ---------------------------------------------------------------------------
// Recipient contact (read-only; id/email/name/active only)
// ---------------------------------------------------------------------------

export async function recipientContact(
  db: Queryable,
  employeeId: string
): Promise<{ id: string; email: string; fullName: string; isActive: boolean } | null> {
  const { rows } = await db.query<{ id: string; email: string; full_name: string; is_active: boolean }>(
    'SELECT id, email, full_name, is_active FROM employees WHERE id = $1',
    [employeeId]
  );
  const r = rows[0];
  return r ? { id: r.id, email: r.email, fullName: r.full_name, isActive: r.is_active } : null;
}
