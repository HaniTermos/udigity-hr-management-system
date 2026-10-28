/**
 * MOD-attendance — repository (raw parameterised SQL). Owner: BE1.
 * Owned tables: attendance_sessions, attendance_corrections, attendance_settings_versions,
 * remote_exceptions, attendance_exceptions (migration 020). `employees` is joined read-only for display
 * names (BE1 owns both modules). Every function takes a Queryable (pool or ctx.tx) first.
 */
import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../middleware/auth.js';
import { SqlParams } from '../../shared/sql.js';
import { orderByClause, pageClause, type PageQuery } from '../../shared/pagination.js';
import type { BreakDto, RemoteStatus, SessionState } from './schemas.js';
import type { VerificationMode } from './time.js';

// ---------------------------------------------------------------------------
// Settings versions
// ---------------------------------------------------------------------------

export interface SettingsVersionRow {
  id: string;
  version_no: number;
  timezone: string;
  working_days: string[];
  shift_start: string;
  shift_end: string;
  grace_minutes: number;
  verification_mode: VerificationMode;
  office_ips: string[];
  holidays: string[];
  summary_required: boolean;
  summary_min_length: number;
  missing_checkout_flag_hours: number;
  reason: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: Date;
}

const SV_COLS = `v.id, v.version_no, v.timezone, v.working_days, v.shift_start, v.shift_end, v.grace_minutes,
  v.verification_mode, v.office_ips, to_json(v.holidays)::jsonb AS holidays, v.summary_required, v.summary_min_length,
  v.missing_checkout_flag_hours, v.reason, v.created_by, e.full_name AS created_by_name, v.created_at`;

function svRow(r: SettingsVersionRow): SettingsVersionRow {
  return { ...r, holidays: (r.holidays ?? []).map((d) => String(d).slice(0, 10)) };
}

export async function latestSettingsVersion(db: Queryable): Promise<SettingsVersionRow | null> {
  const { rows } = await db.query<SettingsVersionRow>(
    `SELECT ${SV_COLS} FROM attendance_settings_versions v LEFT JOIN employees e ON e.id = v.created_by
     ORDER BY v.version_no DESC LIMIT 1`
  );
  return rows[0] ? svRow(rows[0]) : null;
}

export async function settingsVersionById(db: Queryable, id: string): Promise<SettingsVersionRow | null> {
  const { rows } = await db.query<SettingsVersionRow>(
    `SELECT ${SV_COLS} FROM attendance_settings_versions v LEFT JOIN employees e ON e.id = v.created_by WHERE v.id = $1`,
    [id]
  );
  return rows[0] ? svRow(rows[0]) : null;
}

export async function listSettingsVersions(db: Queryable, limit = 20): Promise<SettingsVersionRow[]> {
  const { rows } = await db.query<SettingsVersionRow>(
    `SELECT ${SV_COLS} FROM attendance_settings_versions v LEFT JOIN employees e ON e.id = v.created_by
     ORDER BY v.version_no DESC LIMIT $1`,
    [limit]
  );
  return rows.map(svRow);
}

/** Serialises concurrent saves (the UNIQUE version_no is the backstop). */
export async function lockSettingsVersions(db: Queryable): Promise<void> {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('attendance_settings_versions'))`);
}

export async function insertSettingsVersion(
  db: Queryable,
  v: {
    versionNo: number;
    timezone: string;
    workingDays: string[];
    shiftStart: string;
    shiftEnd: string;
    graceMinutes: number;
    verificationMode: string;
    officeIps: string[];
    holidays: string[];
    summaryRequired: boolean;
    summaryMinLength: number;
    missingCheckoutFlagHours: number;
    reason: string | null;
    createdBy: string;
  }
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes,
       verification_mode, office_ips, holidays, summary_required, summary_min_length, missing_checkout_flag_hours, reason, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date[], $10, $11, $12, $13, $14) RETURNING id`,
    [
      v.versionNo, v.timezone, v.workingDays, v.shiftStart, v.shiftEnd, v.graceMinutes, v.verificationMode, v.officeIps,
      v.holidays, v.summaryRequired, v.summaryMinLength, v.missingCheckoutFlagHours, v.reason, v.createdBy,
    ]
  );
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_role: Role;
  state: SessionState;
  origin: 'check_in' | 'retroactive';
  work_date: string;
  check_in_at: Date;
  check_out_at: Date | null;
  checkout_attempted_at: Date | null;
  effective_check_in_at: Date;
  effective_check_out_at: Date | null;
  check_out_unknown: boolean;
  adjusted: boolean;
  remote: boolean;
  remote_exception_id: string | null;
  check_in_verification: Record<string, unknown>;
  check_out_verification: Record<string, unknown> | null;
  checkout_failure_reason: string | null;
  summary_work_completed: string | null;
  summary_outstanding: string | null;
  summary_blockers: string | null;
  summary_notes: string | null;
  settings_version_id: string | null;
  settings_version_no: number | null;
  missing_checkout_flagged_at: Date | null;
  review_resolved_at: Date | null;
  pending_correction_id: string | null;
  version: number;
}

const S_COLS = `s.id, s.employee_id, e.full_name AS employee_name, e.role AS employee_role, s.state, s.origin,
  to_char(s.work_date, 'YYYY-MM-DD') AS work_date, s.check_in_at, s.check_out_at, s.checkout_attempted_at,
  s.effective_check_in_at, s.effective_check_out_at, s.check_out_unknown, s.adjusted, s.remote, s.remote_exception_id,
  s.check_in_verification, s.check_out_verification, s.checkout_failure_reason, s.summary_work_completed,
  s.summary_outstanding, s.summary_blockers, s.summary_notes, s.settings_version_id, sv.version_no AS settings_version_no,
  s.missing_checkout_flagged_at, s.review_resolved_at,
  (SELECT c.id FROM attendance_corrections c WHERE c.session_id = s.id AND c.status = 'submitted' LIMIT 1) AS pending_correction_id,
  s.version`;
const S_FROM = `attendance_sessions s JOIN employees e ON e.id = s.employee_id
  LEFT JOIN attendance_settings_versions sv ON sv.id = s.settings_version_id`;

export async function sessionById(db: Queryable, id: string, forUpdate = false): Promise<SessionRow | null> {
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE s.id = $1 ${forUpdate ? 'FOR UPDATE OF s' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function sessionOwner(db: Queryable, id: string): Promise<string | null> {
  const { rows } = await db.query<{ employee_id: string }>('SELECT employee_id FROM attendance_sessions WHERE id = $1', [id]);
  return rows[0]?.employee_id ?? null;
}

export async function openSessionOf(db: Queryable, employeeId: string, forUpdate = false): Promise<SessionRow | null> {
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE s.employee_id = $1 AND s.state = 'open' ${forUpdate ? 'FOR UPDATE OF s' : ''}`,
    [employeeId]
  );
  return rows[0] ?? null;
}

/** Serialises one employee's attendance commands (check-in/out, corrections) without blocking others. */
export async function lockEmployeeAttendance(db: Queryable, employeeId: string): Promise<void> {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('attendance:' || $1::text))`, [employeeId]);
}

export async function sessionsOnDate(db: Queryable, employeeId: string, workDate: string): Promise<SessionRow[]> {
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE s.employee_id = $1 AND s.work_date = $2::date ORDER BY s.effective_check_in_at`,
    [employeeId, workDate]
  );
  return rows;
}

export interface InsertSession {
  employeeId: string;
  state: SessionState;
  origin: 'check_in' | 'retroactive';
  workDate: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  remote: boolean;
  remoteExceptionId: string | null;
  checkInVerification: Record<string, unknown>;
  checkOutVerification: Record<string, unknown> | null;
  settingsVersionId: string | null;
}

/** Returns null when the one-open-session index rejects the row (IC-04, a concurrent check-in won). */
export async function insertSession(db: Queryable, v: InsertSession): Promise<string | null> {
  try {
    await db.query('SAVEPOINT att_insert');
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO attendance_sessions (employee_id, state, origin, work_date, check_in_at, check_out_at, effective_check_in_at,
         effective_check_out_at, remote, remote_exception_id, check_in_verification, check_out_verification, settings_version_id)
       VALUES ($1, $2, $3, $4::date, $5, $6, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        v.employeeId, v.state, v.origin, v.workDate, v.checkInAt, v.checkOutAt, v.remote, v.remoteExceptionId,
        JSON.stringify(v.checkInVerification), v.checkOutVerification ? JSON.stringify(v.checkOutVerification) : null,
        v.settingsVersionId,
      ]
    );
    await db.query('RELEASE SAVEPOINT att_insert');
    return rows[0].id;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      await db.query('ROLLBACK TO SAVEPOINT att_insert');
      return null;
    }
    throw e;
  }
}

/** Partial conditional update (§4.5). Column names come from this whitelist only. */
const SESSION_SET: Record<string, string> = {
  state: 'state',
  checkOutAt: 'check_out_at',
  checkoutAttemptedAt: 'checkout_attempted_at',
  effectiveCheckInAt: 'effective_check_in_at',
  effectiveCheckOutAt: 'effective_check_out_at',
  checkOutUnknown: 'check_out_unknown',
  adjusted: 'adjusted',
  checkOutVerification: 'check_out_verification',
  checkoutFailureReason: 'checkout_failure_reason',
  summaryWorkCompleted: 'summary_work_completed',
  summaryOutstanding: 'summary_outstanding',
  summaryBlockers: 'summary_blockers',
  summaryNotes: 'summary_notes',
  missingCheckoutFlaggedAt: 'missing_checkout_flagged_at',
  reviewResolvedAt: 'review_resolved_at',
  reviewResolvedBy: 'review_resolved_by',
};
export type SessionPatch = Partial<Record<keyof typeof SESSION_SET, unknown>>;

export async function updateSession(db: Queryable, id: string, version: number, patch: SessionPatch): Promise<boolean> {
  const p = new SqlParams();
  const sets: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = SESSION_SET[k];
    if (!col) throw new Error(`updateSession: unknown field ${k}`);
    const value = col.endsWith('_verification') && v !== null && v !== undefined ? JSON.stringify(v) : v;
    sets.push(`${col} = ${p.add(value)}`);
  }
  const { rowCount } = await db.query(
    `UPDATE attendance_sessions SET ${sets.join(', ')}, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ${p.add(id)} AND version = ${p.add(version)}`,
    p.values
  );
  return (rowCount ?? 0) > 0;
}

/** Other sessions of the employee whose effective interval overlaps [from, to) (open/unknown = to +∞). */
export async function overlappingSessions(
  db: Queryable,
  employeeId: string,
  from: Date,
  to: Date | null,
  excludeId: string | null
): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM attendance_sessions
     WHERE employee_id = $1 AND ($4::uuid IS NULL OR id <> $4::uuid)
       AND effective_check_in_at < COALESCE($3::timestamptz, 'infinity'::timestamptz)
       AND COALESCE(effective_check_out_at, CASE WHEN state = 'pending_review' THEN checkout_attempted_at END, 'infinity'::timestamptz) > $2`,
    [employeeId, from, to, excludeId]
  );
  return rows.map((r) => r.id);
}

export interface SessionFilter {
  employeeId?: string;
  from?: string;
  to?: string;
  state?: SessionState;
  /** Access-engine predicate on alias `s` (scopeFilter). */
  scope: (p: SqlParams) => string;
}

const SESSION_SORT = { workDate: 's.work_date', checkInAt: 's.effective_check_in_at' };

export async function listSessions(db: Queryable, f: SessionFilter, page: PageQuery): Promise<{ rows: SessionRow[]; total: number }> {
  const p = new SqlParams();
  const where = [f.scope(p)];
  if (f.employeeId) where.push(`s.employee_id = ${p.add(f.employeeId)}`);
  if (f.from) where.push(`s.work_date >= ${p.add(f.from)}::date`);
  if (f.to) where.push(`s.work_date <= ${p.add(f.to)}::date`);
  if (f.state) where.push(`s.state = ${p.add(f.state)}`);
  const w = where.join(' AND ');
  const { rows: c } = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM attendance_sessions s WHERE ${w}`, p.values);
  const order = orderByClause(page, SESSION_SORT, 'checkInAt');
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE ${w} ${order}, s.id ${pageClause(page, p)}`,
    p.values
  );
  return { rows, total: Number(c[0]?.n ?? 0) };
}

/** Every session matching the filter (no paging) — for summaries over a bounded range. */
export async function allSessions(db: Queryable, f: SessionFilter, limit = 2000): Promise<SessionRow[]> {
  const p = new SqlParams();
  const where = [f.scope(p)];
  if (f.employeeId) where.push(`s.employee_id = ${p.add(f.employeeId)}`);
  if (f.from) where.push(`s.work_date >= ${p.add(f.from)}::date`);
  if (f.to) where.push(`s.work_date <= ${p.add(f.to)}::date`);
  if (f.state) where.push(`s.state = ${p.add(f.state)}`);
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE ${where.join(' AND ')} ORDER BY s.effective_check_in_at LIMIT ${p.add(limit)}`,
    p.values
  );
  return rows;
}

/** Owner monitoring: sessions on a date, every still-open session, every unresolved review item. */
export async function monitoringSessions(db: Queryable, workDate: string, employeeId?: string): Promise<SessionRow[]> {
  const p = new SqlParams();
  const emp = employeeId ? `AND s.employee_id = ${p.add(employeeId)}` : '';
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM}
     WHERE (s.work_date = ${p.add(workDate)}::date OR s.state = 'open'
            OR (s.state IN ('closed_provisional', 'pending_review') AND s.review_resolved_at IS NULL)) ${emp}
     ORDER BY s.effective_check_in_at`,
    p.values
  );
  return rows;
}

/** Sessions an Owner corrected (OWN-005 "Corrected sessions"). */
export async function adjustedSessions(db: Queryable, page: PageQuery): Promise<{ rows: SessionRow[]; total: number }> {
  const p = new SqlParams();
  const { rows: c } = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM attendance_sessions s WHERE s.adjusted = true`);
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE s.adjusted = true ORDER BY s.updated_at DESC, s.id ${pageClause(page, p)}`,
    p.values
  );
  return { rows, total: Number(c[0]?.n ?? 0) };
}

/** Open sessions whose D5 flag time has passed and that are not flagged yet (J-04). */
export async function openUnflaggedSessions(db: Queryable): Promise<SessionRow[]> {
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE s.state = 'open' AND s.missing_checkout_flagged_at IS NULL`
  );
  return rows;
}

export interface ActiveEmployee {
  id: string;
  full_name: string;
  role: Role;
}

export async function activeEmployees(db: Queryable, employeeId?: string): Promise<ActiveEmployee[]> {
  const { rows } = await db.query<ActiveEmployee>(
    `SELECT id, full_name, role FROM employees WHERE is_active = true AND ($1::uuid IS NULL OR id = $1::uuid) ORDER BY full_name, id`,
    [employeeId ?? null]
  );
  return rows;
}

export async function employeeExists(db: Queryable, id: string): Promise<{ id: string; is_active: boolean } | null> {
  const { rows } = await db.query<{ id: string; is_active: boolean }>('SELECT id, is_active FROM employees WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/** Open-work summary for the employee list (OWN-002): open sessions + missing-checkout flag inputs. */
export async function openSessionsFor(db: Queryable, employeeIds: string[]): Promise<SessionRow[]> {
  if (employeeIds.length === 0) return [];
  const { rows } = await db.query<SessionRow>(
    `SELECT ${S_COLS} FROM ${S_FROM} WHERE s.employee_id = ANY($1::uuid[]) AND s.state = 'open'`,
    [employeeIds]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

export interface CorrectionRow {
  id: string;
  session_id: string | null;
  employee_id: string;
  employee_name: string;
  employee_role: Role;
  kind: 'request' | 'direct' | 'retroactive';
  status: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | 'applied';
  proposed_check_in_at: Date | null;
  proposed_check_out_at: Date | null;
  proposed_check_out_unknown: boolean;
  previous_check_in_at: Date | null;
  previous_check_out_at: Date | null;
  reason: string;
  closed_session_provisionally: boolean;
  created_by: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  decision_reason: string | null;
  created_at: Date;
  version: number;
}

const C_COLS = `c.id, c.session_id, c.employee_id, e.full_name AS employee_name, e.role AS employee_role, c.kind, c.status,
  c.proposed_check_in_at, c.proposed_check_out_at, c.proposed_check_out_unknown, c.previous_check_in_at, c.previous_check_out_at,
  c.reason, c.closed_session_provisionally, c.created_by, c.decided_by, d.full_name AS decided_by_name, c.decided_at,
  c.decision_reason, c.created_at, c.version`;
const C_FROM = `attendance_corrections c JOIN employees e ON e.id = c.employee_id LEFT JOIN employees d ON d.id = c.decided_by`;

export async function correctionById(db: Queryable, id: string, forUpdate = false): Promise<CorrectionRow | null> {
  const { rows } = await db.query<CorrectionRow>(
    `SELECT ${C_COLS} FROM ${C_FROM} WHERE c.id = $1 ${forUpdate ? 'FOR UPDATE OF c' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function correctionOwner(db: Queryable, id: string): Promise<string | null> {
  const { rows } = await db.query<{ employee_id: string }>('SELECT employee_id FROM attendance_corrections WHERE id = $1', [id]);
  return rows[0]?.employee_id ?? null;
}

export async function correctionsForSession(db: Queryable, sessionId: string): Promise<CorrectionRow[]> {
  const { rows } = await db.query<CorrectionRow>(`SELECT ${C_COLS} FROM ${C_FROM} WHERE c.session_id = $1 ORDER BY c.created_at`, [sessionId]);
  return rows;
}

export async function insertCorrection(
  db: Queryable,
  v: {
    sessionId: string | null;
    employeeId: string;
    kind: 'request' | 'direct' | 'retroactive';
    status: 'submitted' | 'applied';
    proposedCheckInAt: Date | null;
    proposedCheckOutAt: Date | null;
    proposedCheckOutUnknown: boolean;
    previousCheckInAt: Date | null;
    previousCheckOutAt: Date | null;
    reason: string;
    closedSessionProvisionally: boolean;
    createdBy: string;
    decidedBy?: string | null;
    decidedAt?: Date | null;
  }
): Promise<string | null> {
  try {
    await db.query('SAVEPOINT att_corr');
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO attendance_corrections (session_id, employee_id, kind, status, proposed_check_in_at, proposed_check_out_at,
         proposed_check_out_unknown, previous_check_in_at, previous_check_out_at, reason, closed_session_provisionally,
         created_by, decided_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [
        v.sessionId, v.employeeId, v.kind, v.status, v.proposedCheckInAt, v.proposedCheckOutAt, v.proposedCheckOutUnknown,
        v.previousCheckInAt, v.previousCheckOutAt, v.reason, v.closedSessionProvisionally, v.createdBy,
        v.decidedBy ?? null, v.decidedAt ?? null,
      ]
    );
    await db.query('RELEASE SAVEPOINT att_corr');
    return rows[0].id;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      await db.query('ROLLBACK TO SAVEPOINT att_corr');
      return null; // one open request per session
    }
    throw e;
  }
}

export async function decideCorrection(
  db: Queryable,
  id: string,
  version: number,
  v: { status: 'approved' | 'rejected' | 'withdrawn'; decidedBy: string | null; decidedAt: Date; reason: string | null; sessionId?: string | null }
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE attendance_corrections SET status = $3, decided_by = $4, decided_at = $5, decision_reason = $6,
       session_id = COALESCE($7::uuid, session_id), version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND version = $2`,
    [id, version, v.status, v.decidedBy, v.decidedAt, v.reason, v.sessionId ?? null]
  );
  return (rowCount ?? 0) > 0;
}

const CORR_SORT = { createdAt: 'c.created_at', status: 'c.status' };

export async function listCorrections(
  db: Queryable,
  f: { status?: string; employeeId?: string; kind?: string; scope: (p: SqlParams) => string },
  page: PageQuery
): Promise<{ rows: CorrectionRow[]; total: number }> {
  const p = new SqlParams();
  const where = [f.scope(p)];
  if (f.status) where.push(`c.status = ${p.add(f.status)}`);
  if (f.employeeId) where.push(`c.employee_id = ${p.add(f.employeeId)}`);
  if (f.kind) where.push(`c.kind = ${p.add(f.kind)}`);
  const w = where.join(' AND ');
  const { rows: c } = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM attendance_corrections c WHERE ${w}`, p.values);
  const order = orderByClause(page, CORR_SORT, 'createdAt');
  const { rows } = await db.query<CorrectionRow>(`SELECT ${C_COLS} FROM ${C_FROM} WHERE ${w} ${order}, c.id ${pageClause(page, p)}`, p.values);
  return { rows, total: Number(c[0]?.n ?? 0) };
}

export async function countCorrections(db: Queryable, status: string, employeeId?: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM attendance_corrections WHERE status = $1 AND ($2::uuid IS NULL OR employee_id = $2::uuid)`,
    [status, employeeId ?? null]
  );
  return Number(rows[0]?.n ?? 0);
}

/** Latest applied/approved correction per session (OWN-005 corrected tab). */
export async function latestDecisions(db: Queryable, sessionIds: string[]): Promise<Map<string, CorrectionRow>> {
  if (sessionIds.length === 0) return new Map();
  const { rows } = await db.query<CorrectionRow>(
    `SELECT DISTINCT ON (c.session_id) ${C_COLS} FROM ${C_FROM}
     WHERE c.session_id = ANY($1::uuid[]) AND c.status IN ('approved', 'applied')
     ORDER BY c.session_id, COALESCE(c.decided_at, c.created_at) DESC`,
    [sessionIds]
  );
  return new Map(rows.map((r) => [r.session_id as string, r]));
}

// ---------------------------------------------------------------------------
// Remote exceptions
// ---------------------------------------------------------------------------

export interface RemoteRow {
  id: string;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  status: RemoteStatus;
  reason: string;
  requested_by: string;
  decided_by: string | null;
  decided_at: Date | null;
  decision_reason: string | null;
  created_at: Date;
  version: number;
}

const R_COLS = `r.id, r.employee_id, e.full_name AS employee_name, to_char(r.start_date, 'YYYY-MM-DD') AS start_date,
  to_char(r.end_date, 'YYYY-MM-DD') AS end_date, r.status, r.reason, r.requested_by, r.decided_by, r.decided_at,
  r.decision_reason, r.created_at, r.version`;
const R_FROM = 'remote_exceptions r JOIN employees e ON e.id = r.employee_id';

export async function grantedRemoteOn(db: Queryable, employeeId: string, date: string): Promise<RemoteRow | null> {
  const { rows } = await db.query<RemoteRow>(
    `SELECT ${R_COLS} FROM ${R_FROM} WHERE r.employee_id = $1 AND r.status = 'granted'
       AND r.start_date <= $2::date AND r.end_date >= $2::date ORDER BY r.created_at DESC LIMIT 1`,
    [employeeId, date]
  );
  return rows[0] ?? null;
}

export async function grantedRemoteEmployeesOn(db: Queryable, date: string): Promise<Set<string>> {
  const { rows } = await db.query<{ employee_id: string }>(
    `SELECT DISTINCT employee_id FROM remote_exceptions WHERE status = 'granted' AND start_date <= $1::date AND end_date >= $1::date`,
    [date]
  );
  return new Set(rows.map((r) => r.employee_id));
}

export async function remoteById(db: Queryable, id: string, forUpdate = false): Promise<RemoteRow | null> {
  const { rows } = await db.query<RemoteRow>(`SELECT ${R_COLS} FROM ${R_FROM} WHERE r.id = $1 ${forUpdate ? 'FOR UPDATE OF r' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function insertRemote(
  db: Queryable,
  v: { employeeId: string; startDate: string; endDate: string; status: 'requested' | 'granted'; reason: string; requestedBy: string; decidedBy: string | null; decidedAt: Date | null }
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO remote_exceptions (employee_id, start_date, end_date, status, reason, requested_by, decided_by, decided_at)
     VALUES ($1, $2::date, $3::date, $4, $5, $6, $7, $8) RETURNING id`,
    [v.employeeId, v.startDate, v.endDate, v.status, v.reason, v.requestedBy, v.decidedBy, v.decidedAt]
  );
  return rows[0].id;
}

export async function decideRemote(
  db: Queryable,
  id: string,
  version: number,
  v: { status: RemoteStatus; decidedBy: string; decidedAt: Date; reason: string | null }
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE remote_exceptions SET status = $3, decided_by = $4, decided_at = $5, decision_reason = $6,
       version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND version = $2`,
    [id, version, v.status, v.decidedBy, v.decidedAt, v.reason]
  );
  return (rowCount ?? 0) > 0;
}

export async function listRemote(
  db: Queryable,
  f: { employeeId?: string; status?: string; scope: (p: SqlParams) => string },
  page: PageQuery
): Promise<{ rows: RemoteRow[]; total: number }> {
  const p = new SqlParams();
  const where = [f.scope(p)];
  if (f.employeeId) where.push(`r.employee_id = ${p.add(f.employeeId)}`);
  if (f.status) where.push(`r.status = ${p.add(f.status)}`);
  const w = where.join(' AND ');
  const { rows: c } = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM remote_exceptions r WHERE ${w}`, p.values);
  const order = orderByClause(page, { createdAt: 'r.created_at', startDate: 'r.start_date' }, 'createdAt');
  const { rows } = await db.query<RemoteRow>(`SELECT ${R_COLS} FROM ${R_FROM} WHERE ${w} ${order}, r.id ${pageClause(page, p)}`, p.values);
  return { rows, total: Number(c[0]?.n ?? 0) };
}

// ---------------------------------------------------------------------------
// J-04 detections
// ---------------------------------------------------------------------------

/** Inserts one detection; false when it already exists (idempotent per kind/date/employee). */
export async function insertException(
  db: Queryable,
  v: { kind: 'missing_checkin' | 'missing_checkout' | 'not_configured'; workDate: string; employeeId: string | null; sessionId: string | null; at: Date }
): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO attendance_exceptions (kind, work_date, employee_id, session_id, detected_at)
     VALUES ($1, $2::date, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [v.kind, v.workDate, v.employeeId, v.sessionId, v.at]
  );
  return (rowCount ?? 0) > 0;
}

export async function exceptionsOn(
  db: Queryable,
  workDate: string
): Promise<{ id: string; kind: string; employee_id: string | null; session_id: string | null; detected_at: Date }[]> {
  const { rows } = await db.query<{ id: string; kind: string; employee_id: string | null; session_id: string | null; detected_at: Date }>(
    `SELECT id, kind, employee_id, session_id, detected_at FROM attendance_exceptions WHERE work_date = $1::date ORDER BY detected_at`,
    [workDate]
  );
  return rows;
}

/** Active employees with no session on the work date and no open session (J-04 missing check-in). */
export async function employeesWithoutAttendance(db: Queryable, workDate: string): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT e.id FROM employees e
     WHERE e.is_active = true
       AND NOT EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.employee_id = e.id AND (s.work_date = $1::date OR s.state = 'open'))
       AND NOT EXISTS (SELECT 1 FROM attendance_exceptions x WHERE x.kind = 'missing_checkin' AND x.work_date = $1::date AND x.employee_id = e.id)
     ORDER BY e.id`,
    [workDate]
  );
  return rows.map((r) => r.id);
}

/** Employees with any session on a work date (missing check-in detection). */
export async function employeesWithSessionOn(db: Queryable, workDate: string): Promise<Set<string>> {
  const { rows } = await db.query<{ employee_id: string }>(
    'SELECT DISTINCT employee_id FROM attendance_sessions WHERE work_date = $1::date',
    [workDate]
  );
  return new Set(rows.map((r) => r.employee_id));
}

// ---------------------------------------------------------------------------
// Breaks (Wave 2)
// ---------------------------------------------------------------------------

export interface BreakRow {
  id: string;
  session_id: string;
  employee_id: string;
  started_at: Date;
  ended_at: Date | null;
  duration_seconds: number | null;
  break_type: 'paid' | 'unpaid';
  notes: string | null;
  auto_closed: boolean;
  created_at: Date;
}

const BREAK_COLS = `id, session_id, employee_id, started_at, ended_at, duration_seconds, break_type, notes, auto_closed, created_at`;

export function breakToDto(r: BreakRow): BreakDto {
  return {
    id: r.id,
    sessionId: r.session_id,
    employeeId: r.employee_id,
    startedAt: r.started_at.toISOString(),
    endedAt: r.ended_at ? r.ended_at.toISOString() : null,
    durationSeconds: r.duration_seconds,
    breakType: r.break_type,
    notes: r.notes,
    autoClosed: r.auto_closed,
    createdAt: r.created_at.toISOString(),
  };
}

export async function activeBreakOfSession(db: Queryable, sessionId: string, forUpdate = false): Promise<BreakRow | null> {
  const { rows } = await db.query<BreakRow>(
    `SELECT ${BREAK_COLS} FROM attendance_breaks WHERE session_id = $1 AND ended_at IS NULL ${forUpdate ? 'FOR UPDATE' : ''}`,
    [sessionId]
  );
  return rows[0] ?? null;
}

export async function activeBreakOfEmployee(db: Queryable, employeeId: string, forUpdate = false): Promise<BreakRow | null> {
  const { rows } = await db.query<BreakRow>(
    `SELECT b.* FROM attendance_breaks b
     JOIN attendance_sessions s ON s.id = b.session_id
     WHERE b.employee_id = $1 AND b.ended_at IS NULL AND s.state = 'open' ${forUpdate ? 'FOR UPDATE OF b' : ''}`,
    [employeeId]
  );
  return rows[0] ?? null;
}

export async function insertBreak(
  db: Queryable,
  v: { sessionId: string; employeeId: string; breakType: 'paid' | 'unpaid'; notes?: string; startedAt?: Date }
): Promise<BreakRow | null> {
  try {
    await db.query('SAVEPOINT att_break_insert');
    const { rows } = await db.query<BreakRow>(
      `INSERT INTO attendance_breaks (session_id, employee_id, break_type, notes, started_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP))
       RETURNING ${BREAK_COLS}`,
      [v.sessionId, v.employeeId, v.breakType, v.notes ?? null, v.startedAt ?? null]
    );
    await db.query('RELEASE SAVEPOINT att_break_insert');
    return rows[0] ?? null;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      await db.query('ROLLBACK TO SAVEPOINT att_break_insert');
      return null;
    }
    throw e;
  }
}

export async function endBreak(
  db: Queryable,
  breakId: string,
  endedAt: Date,
  notes?: string,
  autoClosed = false
): Promise<BreakRow | null> {
  const { rows } = await db.query<BreakRow>(
    `UPDATE attendance_breaks
     SET ended_at = $2,
         duration_seconds = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($2::timestamptz - started_at))))::integer,
         auto_closed = $3,
         notes = COALESCE($4, notes),
         version = version + 1,
         updated_at = $2
     WHERE id = $1 AND ended_at IS NULL
     RETURNING ${BREAK_COLS}`,
    [breakId, endedAt, autoClosed, notes ?? null]
  );
  return rows[0] ?? null;
}

export async function listBreaksForSession(db: Queryable, sessionId: string): Promise<BreakRow[]> {
  const { rows } = await db.query<BreakRow>(
    `SELECT ${BREAK_COLS} FROM attendance_breaks WHERE session_id = $1 ORDER BY started_at ASC`,
    [sessionId]
  );
  return rows;
}

export async function listBreaksForEmployeeOnDate(db: Queryable, employeeId: string, workDate: string): Promise<BreakRow[]> {
  const { rows } = await db.query<BreakRow>(
    `SELECT b.* FROM attendance_breaks b
     JOIN attendance_sessions s ON s.id = b.session_id
     WHERE b.employee_id = $1 AND s.work_date = $2::date
     ORDER BY b.started_at ASC`,
    [employeeId, workDate]
  );
  return rows;
}

export async function autoCloseActiveBreaksForSession(db: Queryable, sessionId: string, endedAt: Date): Promise<BreakRow[]> {
  const { rows } = await db.query<BreakRow>(
    `UPDATE attendance_breaks
     SET ended_at = $2,
         duration_seconds = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($2::timestamptz - started_at))))::integer,
         auto_closed = true,
         version = version + 1,
         updated_at = $2
     WHERE session_id = $1 AND ended_at IS NULL
     RETURNING ${BREAK_COLS}`,
    [sessionId, endedAt]
  );
  return rows;
}

