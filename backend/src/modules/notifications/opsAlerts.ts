/**
 * J-14: email unsent operator alerts (shared/opsAlert.ts) to ALERT_EMAIL_TO (comma-separated addresses).
 * Unset: nothing is emailed and alerts stay in `ops_alerts` (visible in the logs). Uses the normal email
 * transport, so local/dev runs only capture or log them; real sending needs the approved SMTP setup.
 *
 * D-03: rows are claimed in one short statement (FOR UPDATE SKIP LOCKED + attempts + lease), so two
 * dispatchers never email the same alert; the result is written conditionally on the lease.
 * D-08: the claim and the result writes are single autocommit statements on the pool; nothing is held open
 * while SMTP runs (the job runs without a transaction, see notifications/module.ts).
 */
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import type { EmailSendResult } from '../../shared/outbox.js';
import { getEmailTransport } from './transport.js';

const MAX_ATTEMPTS = 5;
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
}

async function claimAlerts(): Promise<AlertRow[]> {
  const { rows } = await pool.query<AlertRow>(
    `UPDATE ops_alerts a
        SET attempts = a.attempts + 1, lease_until = now() + make_interval(secs => $3::double precision)
      WHERE a.id IN (
        SELECT id FROM ops_alerts
         WHERE sent_at IS NULL AND attempts < $1 AND (lease_until IS NULL OR lease_until < now())
         ORDER BY created_at LIMIT $2
         FOR UPDATE SKIP LOCKED)
      RETURNING a.id, a.kind, a.detail, a.occurrences, a.created_at`,
    [MAX_ATTEMPTS, BATCH, LEASE_SECONDS]
  );
  return rows.sort((x, y) => x.created_at.getTime() - y.created_at.getTime());
}

export async function sendOpsAlerts(): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  const to = alertRecipients();
  if (to.length === 0) return out;
  const rows = await claimAlerts();
  const transport = getEmailTransport();
  for (const a of rows) {
    const vars = { kind: a.kind, detail: a.detail, at: a.created_at.toISOString(), occurrences: String(a.occurrences) };
    const results: EmailSendResult[] = await Promise.all(
      to.map((addr) =>
        transport
          .send({ to: addr, template: 'ops.alert', vars, idempotencyKey: `ops:${a.id}:${addr}` })
          .catch((e: Error): EmailSendResult => ({ ok: false, permanent: false, error: e.message }))
      )
    );
    const failure = results.find((r): r is Extract<EmailSendResult, { ok: false }> => !r.ok);
    if (failure) {
      out.failed++;
      await pool.query(`UPDATE ops_alerts SET lease_until = NULL, last_error = $2 WHERE id = $1 AND sent_at IS NULL`, [
        a.id,
        failure.error.slice(0, 300),
      ]);
    } else {
      out.sent++;
      await pool.query(`UPDATE ops_alerts SET sent_at = now(), lease_until = NULL, last_error = NULL WHERE id = $1 AND sent_at IS NULL`, [a.id]);
    }
  }
  return out;
}
