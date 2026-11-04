/**
 * Shared-state hygiene for the DB suite (review H-07: the suite must be re-runnable on a used test DB).
 *
 * Root causes found on a used DB (second full run, H §1.1): every run creates ~250 employees (30+ Owners) that
 * stay active, and the attendance exception check, the Owner fan-out notices and the relay/dispatch drains
 * scale with them (one run's 530 `attendance.missing_checkin_detected` events became ~5,700 Owner inbox rows);
 * the next run drains twice that inside 5-60 s test limits. Tests also left global attendance settings versions
 * and pending ops alerts behind.
 *
 *  - `quiesceLeftoversFromEarlierRuns` (globalSetup, before any test): on a database whose name contains
 *    "test" only, deactivates every employee except the seed accounts and ends their sessions, closes pending
 *    outbox events of earlier runs, and marks earlier runs' unsent ops alerts sent. A fresh DB has nothing to do.
 *  - `snapshotAttendanceSettings` / `restoreAttendanceSettings`: a file that writes global attendance settings
 *    versions puts the version that was current before it back as the newest version in its afterAll.
 */
import type { Queryable } from '../../db/pool.js';

/** The accounts db/seed.ts creates (kept active; everything else is a test fixture of some run). */
export const SEED_EMAILS = [
  'udigity@gmail.com',
  'karim.saleh@udigity.demo',
  'maya.khoury@udigity.demo',
  'omar.nassar@udigity.demo',
  'lina.aoun@udigity.demo',
  'sami.fares@udigity.demo',
];

export async function quiesceLeftoversFromEarlierRuns(db: Queryable): Promise<Record<string, number>> {
  const { rows } = await db.query<{ name: string }>('SELECT current_database() AS name');
  if (!/test/i.test(rows[0]?.name ?? '')) {
    console.warn('[tests] not a test database name: leftover clean-up skipped');
    return {};
  }
  const out: Record<string, number> = {};
  const r1 = await db.query(
    `UPDATE employees SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE is_active AND lower(email) <> ALL($1::text[])`,
    [SEED_EMAILS]
  );
  out.employeesDeactivated = r1.rowCount ?? 0;
  const r2 = await db.query(
    `UPDATE sessions SET state = 'ended', end_reason = 'account_deactivated', ended_at = CURRENT_TIMESTAMP,
            revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), is_pending_2fa = false
      WHERE state <> 'ended' AND employee_id IN (SELECT id FROM employees WHERE NOT is_active)`
  );
  out.sessionsEnded = r2.rowCount ?? 0;
  const r3 = await db.query(
    `UPDATE outbox_events SET state = 'done', lease_until = NULL, relayed_at = CURRENT_TIMESTAMP,
            last_error = 'closed by test setup (earlier run)', updated_at = CURRENT_TIMESTAMP
      WHERE state = 'pending'`
  );
  out.outboxClosed = r3.rowCount ?? 0;
  const r4 = await db.query(`UPDATE ops_alerts SET sent_at = now(), lease_until = NULL WHERE sent_at IS NULL AND failed_at IS NULL`);
  out.opsAlertsClosed = r4.rowCount ?? 0;
  return out;
}

export interface SettingsSnapshot {
  id: string | null;
}

export async function snapshotAttendanceSettings(db: Queryable): Promise<SettingsSnapshot> {
  const { rows } = await db.query<{ id: string }>('SELECT id FROM attendance_settings_versions ORDER BY version_no DESC LIMIT 1');
  return { id: rows[0]?.id ?? null };
}

/**
 * Makes the version that was current at `snap` current again (a new, identical version on top; versions are
 * referenced by sessions and are never deleted). Nothing to do when nothing was current or nothing changed.
 */
export async function restoreAttendanceSettings(db: Queryable, snap: SettingsSnapshot): Promise<void> {
  if (!snap.id) return;
  const now = await snapshotAttendanceSettings(db);
  if (now.id === snap.id) return;
  await db.query(
    `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes,
       verification_mode, office_ips, holidays, holidays_confirmed, summary_required, summary_min_length,
       missing_checkout_flag_hours, reason, created_by, office_hostnames)
     SELECT (SELECT MAX(version_no) + 1 FROM attendance_settings_versions), timezone, working_days, shift_start, shift_end,
            grace_minutes, verification_mode, office_ips, holidays, holidays_confirmed, summary_required, summary_min_length,
            missing_checkout_flag_hours, 'test suite: restore the settings that were current before this file', created_by,
            office_hostnames
       FROM attendance_settings_versions WHERE id = $1`,
    [snap.id]
  );
}
