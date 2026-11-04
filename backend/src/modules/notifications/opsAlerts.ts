/**
 * J-14: email unsent operator alerts (shared/opsAlert.ts) to ALERT_EMAIL_TO (comma-separated addresses).
 * Unset: nothing is emailed and alerts stay in `ops_alerts` (visible in the logs). Uses the normal email
 * transport, so local/dev runs only capture or log them; real sending needs the approved SMTP setup.
 *
 * D-03: rows are claimed in one short statement (FOR UPDATE SKIP LOCKED + attempts + lease), so two
 * dispatchers never email the same alert; the result is written conditionally on the lease.
 * D-08: the claim and the result writes are single autocommit statements on the pool; nothing is held open
 * while SMTP runs (the job runs without a transaction, see notifications/module.ts).
 * H-06: delivery is tracked per recipient (`delivered_to`): a retry emails only the recipients that have not
 * accepted it yet. An alert still missing recipients after MAX_ATTEMPTS is marked `failed_at` (counted on the
 * Owner dashboard as `failedOpsAlerts` and logged), never silently dropped.
 */
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import type { EmailSendResult } from '../../shared/outbox.js';
import { getEmailTransport } from './transport.js';

export const OPS_ALERT_MAX_ATTEMPTS = 5;
const MAX_ATTEMPTS = OPS_ALERT_MAX_ATTEMPTS;
const BATCH = 20;
/** Longer than a send (SMTP timeouts) so a live dispatcher keeps its claim; a crashed one is retried after it. */
const LEASE_SECONDS = 120;

export function alertRecipients(raw = process.env.ALERT_EMAIL_TO ?? ''): string[] {
  const email = z.string().email().max(254);
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => email.safeParse(s).success);
}

interface AlertRow {
  id: string;
  kind: string;
  detail: string;
  occurrences: number;
  created_at: Date;
  attempts: number;
  delivered_to: string[];
}

async function claimAlerts(): Promise<AlertRow[]> {
  const { rows } = await pool.query<AlertRow>(
    `UPDATE ops_alerts a
        SET attempts = a.attempts + 1, lease_until = now() + make_interval(secs => $3::double precision)
      WHERE a.id IN (
        SELECT id FROM ops_alerts
         WHERE sent_at IS NULL AND failed_at IS NULL AND attempts < $1 AND (lease_until IS NULL OR lease_until < now())
         ORDER BY created_at LIMIT $2
         FOR UPDATE SKIP LOCKED)
      RETURNING a.id, a.kind, a.detail, a.occurrences, a.created_at, a.attempts, a.delivered_to`,
    [MAX_ATTEMPTS, BATCH, LEASE_SECONDS]
  );
  return rows.sort((x, y) => x.created_at.getTime() - y.created_at.getTime());
}

/** H-06: alerts that used every attempt before per-recipient tracking existed are marked failed too. */
async function markExhausted(): Promise<number> {
  const { rows } = await pool.query<{ id: string; kind: string }>(
    `UPDATE ops_alerts SET failed_at = now(), lease_until = NULL
      WHERE sent_at IS NULL AND failed_at IS NULL AND attempts >= $1 AND (lease_until IS NULL OR lease_until < now())
      RETURNING id, kind`,
    [MAX_ATTEMPTS]
  );
  for (const r of rows) console.error(`[ops-alert] ${r.kind} (${r.id}) could not be emailed after ${MAX_ATTEMPTS} attempts; marked failed`);
  return rows.length;
}

export async function sendOpsAlerts(): Promise<{ sent: number; failed: number; exhausted: number }> {
  const out = { sent: 0, failed: 0, exhausted: 0 };
  const to = alertRecipients();
  if (to.length === 0) return out;
  out.exhausted += await markExhausted();
  const rows = await claimAlerts();
  const transport = getEmailTransport();
  for (const a of rows) {
    const vars = { kind: a.kind, detail: a.detail, at: a.created_at.toISOString(), occurrences: String(a.occurrences) };
    const already = new Set((a.delivered_to ?? []).map((x) => x.toLowerCase()));
    const pending = to.filter((addr) => !already.has(addr.toLowerCase()));
    const results: { addr: string; r: EmailSendResult }[] = await Promise.all(
      pending.map((addr) =>
        transport
          .send({ to: addr, template: 'ops.alert', vars, idempotencyKey: `ops:${a.id}:${addr}` })
          .catch((e: Error): EmailSendResult => ({ ok: false, permanent: false, error: e.message }))
          .then((r) => ({ addr, r }))
      )
    );
    const delivered = results.filter((x) => x.r.ok).map((x) => x.addr.toLowerCase());
    const failure = results.map((x) => x.r).find((r): r is Extract<EmailSendResult, { ok: false }> => !r.ok);
    if (failure) {
      out.failed++;
      const exhausted = a.attempts >= MAX_ATTEMPTS;
      if (exhausted) out.exhausted++;
      await pool.query(
        `UPDATE ops_alerts
            SET lease_until = NULL, last_error = $2,
                delivered_to = ARRAY(SELECT DISTINCT x FROM unnest(delivered_to || $3::text[]) x ORDER BY x),
                failed_at = CASE WHEN $4::boolean THEN now() ELSE failed_at END
          WHERE id = $1 AND sent_at IS NULL`,
        [a.id, failure.error.slice(0, 300), delivered, exhausted]
      );
      if (exhausted) console.error(`[ops-alert] ${a.kind} (${a.id}) could not be emailed to every recipient after ${MAX_ATTEMPTS} attempts; marked failed`);
    } else {
      out.sent++;
      await pool.query(
        `UPDATE ops_alerts
            SET sent_at = now(), lease_until = NULL, last_error = NULL,
                delivered_to = ARRAY(SELECT DISTINCT x FROM unnest(delivered_to || $2::text[]) x ORDER BY x)
          WHERE id = $1 AND sent_at IS NULL`,
        [a.id, delivered]
      );
    }
  }
  return out;
}
