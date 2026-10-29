/**
 * J-14: email unsent operator alerts (shared/opsAlert.ts) to ALERT_EMAIL_TO (comma-separated addresses).
 * Unset: nothing is emailed and alerts stay in `ops_alerts` (visible in the logs). Uses the normal email
 * transport, so local/dev runs only capture or log them; real sending needs the approved SMTP setup.
 */
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import type { EmailSendResult } from '../../shared/outbox.js';
import { getEmailTransport } from './transport.js';

const MAX_ATTEMPTS = 5;
const BATCH = 20;

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

export async function sendOpsAlerts(): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  const to = alertRecipients();
  if (to.length === 0) return out;
  const { rows } = await pool.query<AlertRow>(
    `SELECT id, kind, detail, occurrences, created_at FROM ops_alerts
      WHERE sent_at IS NULL AND attempts < $1 ORDER BY created_at LIMIT $2`,
    [MAX_ATTEMPTS, BATCH]
  );
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
      await pool.query(`UPDATE ops_alerts SET attempts = attempts + 1, last_error = $2 WHERE id = $1`, [a.id, failure.error.slice(0, 300)]);
    } else {
      out.sent++;
      await pool.query(`UPDATE ops_alerts SET sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1`, [a.id]);
    }
  }
  return out;
}
