/**
 * Operator failure alerts. `raiseOpsAlert` records a row in `ops_alerts`; the worker emails unsent rows to
 * ALERT_EMAIL_TO (notifications J-14). The same kind within one 15-minute window becomes one row (its
 * `occurrences` counter goes up), so a repeating fault sends one email per window.
 *
 * Best effort: it never throws, so an alert can't break the request or job that raised it. If the database
 * itself is down nothing can be stored; that case shows in the logs and the health checks.
 * Details are short labels (route, job kind, request id, error class), never request data or messages.
 */
import { pool, type Queryable } from '../db/pool.js';

export const OPS_ALERT_WINDOW_MINUTES = 15;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function raiseOpsAlert(kind: string, detail: string, db: Queryable = pool, now = new Date()): Promise<void> {
  try {
    const bucket = Math.floor(now.getTime() / (OPS_ALERT_WINDOW_MINUTES * 60_000));
    await db.query(
      `INSERT INTO ops_alerts (kind, detail, dedupe_key, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (dedupe_key) DO UPDATE SET occurrences = ops_alerts.occurrences + 1`,
      [clip(kind, 100), clip(detail || kind, 500), `${clip(kind, 100)}:${bucket}`, now]
    );
  } catch (err) {
    console.error(`[ops-alert] could not record ${kind}: ${(err as Error).message}`);
  }
}
