/**
 * MOD-attendance — service (rules + public operations). Owner: BE1.
 * SM-ATTENDANCE-001, SM-CORRECTION-001, WF-ATT-001..003, WF-ADMIN-001.
 *
 * Approved policy (docs/policy-baseline-2026-10-29.md): D1 schedule gate (only an Owner-saved,
 * complete settings version activates enforcement; days off), D2 IP/CIDR office check only, D3 remote
 * exceptions (no self-grant), D4 corrections (no self-approval; effective values only after approval),
 * D5 provisional failed checkout and missing-checkout handling, D6 summary (10 non-whitespace
 * characters, pinned), D18 J-04 alerts, breaks back on by Owner decision 2026-10-29 (CFG
 * `attendance.breaksEnabled`, default false). Still Demonstration alternatives: DEC-010 self request
 * (flag `attendance.remoteSelfRequest`), DEC-011 Alt B requests (flag `attendance.employeeRequests`).
 * Owner decisions 2026-10-29: per-employee start time / working days (`employee_schedules`, effective
 * from a date) and office dynamic-DNS hostnames (officeDns.ts) beside the IP/CIDR list.
 * Confirmed: one open session, originals never overwritten, 9 h workday, server time only.
 *
 * Time: `clock.now()` (platform clock; tests pin it). Client IP: `ctx.clientIp` = Express `req.ip`
 * (proxy trust is the app-level `trust proxy` = TRUSTED_PROXY_CIDRS; forwarding headers are never read here).
 */
import type { Queryable } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { DEMO_LABEL, flags, type PolicyFlags } from '../../shared/flags.js';
import {
  HttpError,
  notFound,
  permissionDenied,
  ruleViolation,
  stateConflict,
  versionConflict,
} from '../../shared/errors.js';
import { outbox } from '../../shared/outbox.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { access, can, type Action, type Principal } from '../../shared/access.js';
import { toPage } from '../../shared/pagination.js';
import type { SqlParams } from '../../shared/sql.js';
import { clock } from '../platform/clock.js';
import { getSetting, setCompanyValue } from '../admin/service.js';
import { isValidTimeZone } from '../identity/env.js';
import * as repo from './repo.js';
import {
  A,
  type ActiveBreakDto,
  type AdjustInput,
  type BreakDto,
  type CheckOutInput,
  type CorrectionDto,
  type CreateDayOffInput,
  type DayOffDto,
  type DaysOffQuery,
  type CorrectionRequestInput,
  type CorrectionsQuery,
  type EndBreakInput,
  type MonitorVerification,
  type MySessionsQuery,
  type OverviewQuery,
  type OverviewRowDto,
  type StartBreakInput,
  type PutEmployeeScheduleInput,
  type PutSettingsInput,
  type RemoteExceptionDto,
  type RemoteQuery,
  type ResolveReviewInput,
  type RetroactiveInput,
  type ReviewItemDto,
  type SessionDto,
  type SessionsQuery,
  type SettingsVersionDto,
  type VerificationDto,
} from './schemas.js';
import {
  REQUIRED_MINUTES,
  SUMMARY_MIN_CHARS,
  matchingEntries,
  missingCheckoutDueAt,
  missingSettings,
  nonWorkingReason,
  normalizeIp,
  officeCheck,
  parseIpEntry,
  punctualityOf,
  shiftEndAt,
  shiftEndOf,
  summaryCharCount,
  withOverride,
  workDateOf,
  zonedToUtc,
  type EmployeeOverride,
  type Schedule,
  type VerificationMode,
} from './time.js';
import { isValidHostname, resolveOfficeHostnames } from './officeDns.js';

// ---------------------------------------------------------------------------
// Flags (FLAG kinds come from the env registry; tests may override both branches)
// ---------------------------------------------------------------------------

type AttendanceFlag = 'attendance.employeeRequests' | 'attendance.remoteSelfRequest' | 'attendance.breaksEnabled';
let flagOverrides: Partial<Pick<PolicyFlags, AttendanceFlag>> = {};

/** Test only (NODE_ENV=test): run both branches of a FLAG. Pass {} to reset. */
export function setAttendanceFlagOverridesForTests(o: Partial<Pick<PolicyFlags, AttendanceFlag>>): void {
  if (config.env !== 'test') throw new Error('Attendance flag overrides are available only when NODE_ENV=test');
  flagOverrides = { ...o };
}

function flag<K extends AttendanceFlag>(key: K): PolicyFlags[K] {
  return (flagOverrides[key] ?? flags[key]) as PolicyFlags[K];
}

export function attendanceFlags() {
  return {
    employeeRequests: flag('attendance.employeeRequests'),
    remoteSelfRequest: flag('attendance.remoteSelfRequest'),
    /** D5: pinned; the block/hold alternatives are not selectable. */
    failedCheckout: 'provisional' as const,
    breaksEnabled: flag('attendance.breaksEnabled'),
    label: DEMO_LABEL,
  };
}

/** Break tracking (Owner decision 2026-10-29: on by default): the break routes answer 404 while this is false. */
export function breaksEnabled(): boolean {
  return flag('attendance.breaksEnabled');
}

// ---------------------------------------------------------------------------
// Settings (versioned; apply to future sessions)
// ---------------------------------------------------------------------------

interface ScheduleInfo {
  schedule: Schedule;
  version: repo.SettingsVersionRow | null;
}

function scheduleFromRow(v: repo.SettingsVersionRow): Schedule {
  return {
    timezone: v.timezone,
    workingDays: v.working_days,
    shiftStart: v.shift_start.trim(), // shift_end is kept in the row but ignored: end = start + 9 h (D1)
    graceMinutes: v.grace_minutes,
    verificationMode: v.verification_mode,
    officeIps: v.office_ips,
    officeHostnames: v.office_hostnames ?? [],
    holidays: v.holidays,
    holidaysConfirmed: v.holidays_confirmed,
    saved: true,
    missingCheckoutFlagHours: v.missing_checkout_flag_hours,
  };
}

/**
 * Env values (and the DEV-R4 aliases) through `getSetting`, shown as pre-fill suggestions until the Owner
 * saves a version. Never "configured" (`saved: false`): no enforcement runs on assumed values (D1).
 */
async function envSchedule(db: Queryable): Promise<Schedule> {
  // One after another: `db` is often the command's transaction client, and a pg client must not run
  // concurrent queries (pg DeprecationWarning seen from the J-04 worker job).
  const timezone = await getSetting(db, 'company.timezone');
  const workingDays = await getSetting(db, 'attendance.workingDays');
  const shiftStart = await getSetting(db, 'attendance.shiftStart');
  const graceMinutes = await getSetting(db, 'attendance.graceMinutes');
  const verificationMode = await getSetting(db, 'attendance.verificationMode');
  const officeIps = await getSetting(db, 'attendance.officeIps');
  const holidays = await getSetting(db, 'attendance.holidays');
  const flagHours = await getSetting(db, 'attendance.missingCheckoutFlagHours');
  return {
    timezone: timezone && isValidTimeZone(timezone) ? timezone : '',
    workingDays: workingDays.map((d) => d.toUpperCase()),
    shiftStart,
    graceMinutes,
    verificationMode,
    officeIps,
    officeHostnames: [],
    holidays,
    holidaysConfirmed: false,
    saved: false,
    missingCheckoutFlagHours: flagHours,
  };
}

export async function currentSchedule(db: Queryable): Promise<ScheduleInfo> {
  const version = await repo.latestSettingsVersion(db);
  return { schedule: version ? scheduleFromRow(version) : await envSchedule(db), version };
}

/** Schedule a session was created under (settings apply to future sessions); memoised per call. */
function scheduleResolver(db: Queryable, current: ScheduleInfo) {
  const cache = new Map<string, Promise<Schedule>>();
  return (row: Pick<repo.SessionRow, 'settings_version_id'>): Promise<Schedule> => {
    const id = row.settings_version_id;
    if (!id || id === current.version?.id) return Promise.resolve(current.schedule);
    let p = cache.get(id);
    if (!p) {
      p = repo.settingsVersionById(db, id).then((v) => (v ? scheduleFromRow(v) : current.schedule));
      cache.set(id, p);
    }
    return p;
  };
}

/** Company IANA timezone (DEC-007); null = Not configured. Read by reminders, reports, access (OI-04). */
export async function getCompanyTimezone(db: Queryable): Promise<string | null> {
  const { schedule } = await currentSchedule(db);
  return schedule.timezone || null;
}

function versionDto(v: repo.SettingsVersionRow | null, s: Schedule, full: boolean): SettingsVersionDto {
  return {
    versionNo: v?.version_no ?? null,
    timezone: s.timezone,
    workingDays: s.workingDays,
    shiftStart: s.shiftStart,
    shiftEnd: shiftEndOf(s.shiftStart),
    graceMinutes: s.graceMinutes,
    verificationMode: s.verificationMode,
    ...(full
      ? { officeIps: s.officeIps, officeHostnames: s.officeHostnames, holidays: s.holidays, reason: v?.reason ?? null, createdByName: v?.created_by_name ?? null }
      : {}),
    holidaysConfirmed: s.holidaysConfirmed,
    summaryRequired: true,
    summaryMinLength: SUMMARY_MIN_CHARS,
    missingCheckoutFlagHours: s.missingCheckoutFlagHours,
    createdAt: v ? new Date(v.created_at).toISOString() : null,
    createdBy: v?.created_by ?? null,
    source: v ? 'version' : 'env',
  };
}

/** GET /attendance/settings. `full` = the caller holds `settings.read` (Owner + 2FA). */
export async function getSettingsView(db: Queryable, full: boolean) {
  const info = await currentSchedule(db);
  const missing = missingSettings(info.schedule);
  const policy = await breakPolicy(db);
  const base = {
    label: DEMO_LABEL,
    configured: missing.length === 0,
    missing,
    requiredMinutes: REQUIRED_MINUTES,
    current: versionDto(info.version, info.schedule, full),
    flags: attendanceFlags(),
    // Breaks do not reduce worked time (duration = checkout − check-in).
    breaks: { enabled: breaksEnabled(), allowanceMinutes: policy.allowanceSeconds / 60, maxPerSession: policy.maxBreaks },
  };
  if (!full) return base;
  const versions = await repo.listSettingsVersions(db, 20);
  return { ...base, versions: versions.map((v) => versionDto(v, scheduleFromRow(v), true)) };
}

function validationError(details: Record<string, string[]>): HttpError {
  return new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', details);
}

/** D3/D4: a decision about one's own record (403, the shared PERMISSION_DENIED code). */
function selfDecision(message: string): HttpError {
  return new HttpError(403, 'PERMISSION_DENIED', message, { reason: 'SELF_DECISION' });
}

/**
 * S-30 (Owner 2026-11-04, review H-01): the Owner may adjust, resolve the review of, or create a retroactive
 * session for THEIR OWN attendance, with a mandatory reason; the audit row then carries `selfAdjusted: true`.
 * Anyone else (custom roles included) still gets 403 SELF_DECISION on their own record. Approving one's own
 * correction request stays refused for everyone (the Owner adjusts directly instead).
 * Returns true when this is an allowed Owner self-decision, false when the record is someone else's.
 */
export function ownerSelfDecision(
  actor: { role: string; employeeId: string },
  subjectEmployeeId: string,
  reason: string | null | undefined,
  message: string
): boolean {
  if (subjectEmployeeId !== actor.employeeId) return false;
  if (actor.role !== 'owner') throw selfDecision(message);
  if (!reason || !reason.trim()) throw validationError({ reason: ['A reason is required when you change your own attendance'] });
  return true;
}

const selfActor = (ctx: CommandContext) => {
  if (ctx.actor.kind !== 'employee') throw new Error('attendance command needs an employee actor');
  return { role: String(ctx.actor.role), employeeId: ctx.actor.employeeId };
};

/**
 * PUT /attendance/settings: one new version (append-only) + company.timezone, audited, one tx.
 * D1: the first save states every company value explicitly (env values are suggestions only, never a
 * fallback); a later save keeps omitted fields from the current Owner-saved version (FX-BE-C2). Every
 * saved version must end up complete (office IPs, holiday confirmation): a save never "un-configures".
 */
export async function putSettings(ctx: CommandContext, patch: PutSettingsInput) {
  await repo.lockSettingsVersions(ctx.tx);
  const before = await currentSchedule(ctx.tx);
  const currentNo = before.version?.version_no ?? 0;
  if (patch.version !== currentNo) throw versionConflict(currentNo);
  const cur = before.version ? before.schedule : null; // never fall back to env suggestions
  const input = {
    timezone: patch.timezone ?? cur?.timezone,
    workingDays: patch.workingDays ?? cur?.workingDays,
    shiftStart: patch.shiftStart ?? cur?.shiftStart,
    // D1 grace (10 min) and the D5 flag hours (6) are approved values, not company inputs.
    graceMinutes: patch.graceMinutes ?? cur?.graceMinutes ?? (await getSetting(ctx.tx, 'attendance.graceMinutes')),
    verificationMode: patch.verificationMode ?? (cur?.verificationMode === 'ip' ? 'ip' : undefined),
    officeIps: patch.officeIps ?? cur?.officeIps ?? (patch.officeHostnames ? [] : undefined),
    officeHostnames: (patch.officeHostnames ?? cur?.officeHostnames ?? []).map((h) => h.trim().toLowerCase()),
    holidays: patch.holidays ?? cur?.holidays,
    holidaysConfirmed: patch.holidaysConfirmed ?? cur?.holidaysConfirmed ?? false,
    missingCheckoutFlagHours: patch.missingCheckoutFlagHours ?? cur?.missingCheckoutFlagHours ?? (await getSetting(ctx.tx, 'attendance.missingCheckoutFlagHours')),
    reason: patch.reason,
  };
  const errors: Record<string, string[]> = {};
  const required = 'Required: enter the company-confirmed value';
  if (!input.timezone) errors.timezone = [required];
  else if (!isValidTimeZone(input.timezone)) errors.timezone = ['Must be an IANA time zone, e.g. Asia/Beirut'];
  if (!input.workingDays || input.workingDays.length === 0) errors.workingDays = ['Choose at least one working day'];
  else if (new Set(input.workingDays).size !== input.workingDays.length) errors.workingDays = ['Each day only once'];
  if (!input.shiftStart) errors.shiftStart = [required];
  if (!input.verificationMode) errors.verificationMode = ['Office verification uses the office IP/CIDR list'];
  // The office is either an IP/CIDR list or dynamic-DNS hostnames (or both); never allow-all.
  if ((!input.officeIps || input.officeIps.length === 0) && input.officeHostnames.length === 0) {
    errors.officeIps = ['Add at least one office public IP / CIDR range or a dynamic DNS hostname'];
  }
  (input.officeIps ?? []).forEach((ip, i) => {
    if (!parseIpEntry(ip)) errors[`officeIps.${i}`] = ['Not an IP address or CIDR range'];
  });
  input.officeHostnames.forEach((h, i) => {
    if (!isValidHostname(h)) errors[`officeHostnames.${i}`] = ['Not a hostname, e.g. office.ddns.net'];
  });
  if (!input.holidays) errors.holidays = ['Enter the holiday list (it may be empty)'];
  if (!input.holidaysConfirmed) errors.holidaysConfirmed = ['Confirm the holiday calendar'];
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const timezone = input.timezone!;
  const shiftStart = input.shiftStart!;
  const holidays = [...new Set(input.holidays!)].sort();
  const workingDays = [...input.workingDays!];
  const officeIps = (input.officeIps ?? []).map((s) => s.trim());
  const officeHostnames = [...new Set(input.officeHostnames)];
  const id = await repo.insertSettingsVersion(ctx.tx, {
    versionNo: currentNo + 1,
    timezone,
    workingDays,
    shiftStart,
    shiftEnd: shiftEndOf(shiftStart), // column kept; informational only (D1: start + 9 h)
    graceMinutes: input.graceMinutes,
    verificationMode: 'ip',
    officeIps,
    officeHostnames,
    holidays,
    holidaysConfirmed: true,
    summaryRequired: true, // D6 pinned
    summaryMinLength: SUMMARY_MIN_CHARS,
    missingCheckoutFlagHours: input.missingCheckoutFlagHours,
    reason: input.reason ?? null,
    createdBy: actorIdOf(ctx),
  });
  // Keep company.timezone (read by other modules through getSetting) equal to the saved version.
  await setCompanyValue(ctx, 'company.timezone', timezone);
  // Break limits are plain Owner settings (not versioned): they apply from now on.
  const breaksBefore = await breakPolicy(ctx.tx);
  if (patch.breakAllowanceMinutes !== undefined) await setCompanyValue(ctx, 'attendance.breakAllowanceMinutes', patch.breakAllowanceMinutes);
  if (patch.maxBreaksPerSession !== undefined) await setCompanyValue(ctx, 'attendance.maxBreaksPerSession', patch.maxBreaksPerSession);

  const after: Schedule = {
    timezone,
    workingDays,
    shiftStart,
    graceMinutes: input.graceMinutes,
    verificationMode: 'ip',
    officeIps,
    officeHostnames,
    holidays,
    holidaysConfirmed: true,
    saved: true,
    missingCheckoutFlagHours: input.missingCheckoutFlagHours,
  };
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const breaksAfter = await breakPolicy(ctx.tx);
  if (breaksAfter.allowanceSeconds !== breaksBefore.allowanceSeconds) {
    changedBefore.breakAllowanceMinutes = breaksBefore.allowanceSeconds / 60;
    changedAfter.breakAllowanceMinutes = breaksAfter.allowanceSeconds / 60;
  }
  if (breaksAfter.maxBreaks !== breaksBefore.maxBreaks) {
    changedBefore.maxBreaksPerSession = breaksBefore.maxBreaks;
    changedAfter.maxBreaksPerSession = breaksAfter.maxBreaks;
  }
  for (const k of Object.keys(after) as (keyof Schedule)[]) {
    if (JSON.stringify(before.schedule[k]) !== JSON.stringify(after[k])) {
      changedBefore[k] = before.schedule[k];
      changedAfter[k] = after[k];
    }
  }
  await audit(ctx, {
    eventName: 'settings.updated',
    entityType: 'attendance_settings',
    entityId: id,
    before: { ...changedBefore, versionNo: currentNo },
    after: { ...changedAfter, versionNo: currentNo + 1 },
    reason: input.reason ?? null,
    payload: { keys: Object.keys(changedAfter), versionNo: currentNo + 1 },
    securityEvent: true,
    sourceWorkflow: 'WF-ADMIN-001',
  });
  return getSettingsView(ctx.tx, true);
}

/** POST /attendance/settings/test-office-check: inline result, nothing saved (AC-SET-003). */
export async function testOfficeCheck(db: Queryable, clientIp: string | null, officeIps?: string[]) {
  const { schedule } = await currentSchedule(db);
  const list = officeIps ?? schedule.officeIps;
  const invalid = list.filter((e) => !parseIpEntry(e));
  if (invalid.length > 0) throw validationError({ officeIps: ['Not an IP address or CIDR range'] });
  const mode: VerificationMode = 'ip';
  if (!officeIps && schedule.verificationMode !== 'ip') return { mode, result: 'not_configured' as const, matches: [] as string[], label: DEMO_LABEL };
  if (list.length === 0 && (officeIps || schedule.officeHostnames.length === 0)) return { mode, result: 'not_configured' as const, matches: [] as string[], label: DEMO_LABEL };
  const matches = matchingEntries(clientIp, list);
  if (matches.length === 0 && !officeIps && schedule.officeHostnames.length > 0) {
    const dns = await resolveOfficeHostnames(schedule.officeHostnames);
    if (matchingEntries(clientIp, dns.ips).length > 0) return { mode, result: 'passed' as const, matches: ['hostname'], label: DEMO_LABEL };
  }
  return { mode, result: matches.length > 0 ? ('passed' as const) : ('failed' as const), matches, label: DEMO_LABEL };
}

// ---------------------------------------------------------------------------
// DTO mapping (derived values; nothing derived is stored)
// ---------------------------------------------------------------------------

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

function verificationOf(v: Record<string, unknown> | null): VerificationDto | null {
  if (!v || typeof v !== 'object' || !('result' in v)) return null;
  return { result: v.result as VerificationDto['result'], mode: (v.mode as string | null) ?? null };
}

function isReviewPending(r: repo.SessionRow): boolean {
  return (r.state === 'closed_provisional' || r.state === 'pending_review') && !r.review_resolved_at;
}

function missingCheckoutOf(r: repo.SessionRow, s: Schedule, now: Date): boolean {
  if (r.state !== 'open') return false;
  if (r.missing_checkout_flagged_at) return true;
  const due = missingCheckoutDueAt(r.work_date, s);
  return due !== null && now.getTime() >= due.getTime();
}

export function toSessionDto(r: repo.SessionRow, s: Schedule, now: Date): SessionDto {
  const p = punctualityOf(new Date(r.effective_check_in_at), r.work_date, s);
  const out = r.effective_check_out_at ? new Date(r.effective_check_out_at) : null;
  const durationMinutes = out ? Math.floor((out.getTime() - new Date(r.effective_check_in_at).getTime()) / 60_000) : null;
  const durationStatus: SessionDto['durationStatus'] =
    durationMinutes !== null ? (durationMinutes >= REQUIRED_MINUTES ? 'met' : 'short') : r.state === 'open' ? 'open' : 'unknown';
  const hasSummary = r.summary_work_completed || r.summary_outstanding || r.summary_blockers || r.summary_notes;
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    workDate: r.work_date,
    state: r.state,
    origin: r.origin,
    checkInAt: iso(r.check_in_at)!,
    checkOutAt: iso(r.check_out_at),
    effectiveCheckInAt: iso(r.effective_check_in_at)!,
    effectiveCheckOutAt: iso(r.effective_check_out_at),
    checkOutUnknown: r.check_out_unknown,
    checkoutAttemptedAt: iso(r.checkout_attempted_at),
    adjusted: r.adjusted,
    remote: r.remote,
    punctuality: p.punctuality,
    lateMinutes: p.lateMinutes,
    durationMinutes,
    requiredMinutes: REQUIRED_MINUTES,
    durationStatus,
    verification: {
      checkIn: verificationOf(r.check_in_verification) ?? { result: 'not_configured', mode: null },
      checkOut: verificationOf(r.check_out_verification),
    },
    checkoutFailureReason: r.checkout_failure_reason,
    summary: hasSummary
      ? {
          workCompleted: r.summary_work_completed,
          outstandingTasks: r.summary_outstanding,
          blockers: r.summary_blockers,
          notes: r.summary_notes,
          writtenBy: r.summary_written_by,
        }
      : null,
    missingCheckout: missingCheckoutOf(r, s, now),
    reviewPending: isReviewPending(r),
    pendingCorrectionId: r.pending_correction_id,
    settingsVersion: r.settings_version_no,
    version: r.version,
  };
}

async function sessionDtos(db: Queryable, rows: repo.SessionRow[], info?: ScheduleInfo): Promise<SessionDto[]> {
  const current = info ?? (await currentSchedule(db));
  const resolve = scheduleResolver(db, current);
  const ov = await overridesFor(db, rows.map((r) => r.employee_id));
  const now = clock.now();
  const out: SessionDto[] = [];
  for (const r of rows) out.push(toSessionDto(r, withOverride(await resolve(r), ov.on(r.employee_id, r.work_date)), now));
  return out;
}

// ---------------------------------------------------------------------------
// Per-employee schedules (Owner decision 2026-10-29)
// ---------------------------------------------------------------------------

/** The overrides of a set of employees, answered per work date (latest row effective on or before it). */
export interface OverrideIndex {
  on(employeeId: string, date: string): EmployeeOverride | null;
}

function overrideOfRow(r: repo.EmployeeScheduleRow): EmployeeOverride | null {
  if (r.shift_start === null && r.working_days === null) return null; // "use company default"
  return { shiftStart: r.shift_start, workingDays: r.working_days };
}

export async function overridesFor(db: Queryable, employeeIds: string[]): Promise<OverrideIndex> {
  const rows = await repo.employeeScheduleRows(db, [...new Set(employeeIds)]);
  const byEmp = new Map<string, repo.EmployeeScheduleRow[]>();
  for (const r of rows) byEmp.set(r.employee_id, [...(byEmp.get(r.employee_id) ?? []), r]);
  return {
    on(employeeId, date) {
      const hit = (byEmp.get(employeeId) ?? []).find((r) => r.effective_from <= date); // newest first
      return hit ? overrideOfRow(hit) : null;
    },
  };
}

/** An employee's own start / working days on a date; null = the company schedule applies. */
export async function employeeOverrideOn(db: Queryable, employeeId: string, date: string): Promise<EmployeeOverride | null> {
  return (await overridesFor(db, [employeeId])).on(employeeId, date);
}

/**
 * The schedule that applies to one employee on a company date: the current company settings version
 * with the employee's start time / working days applied. Check `missingSettings` before enforcing.
 */
export async function employeeSchedule(db: Queryable, employeeId: string, date: string): Promise<Schedule> {
  const { schedule } = await currentSchedule(db);
  return withOverride(schedule, await employeeOverrideOn(db, employeeId, date));
}

function scheduleRowDto(r: repo.EmployeeScheduleRow) {
  return {
    id: r.id,
    effectiveFrom: r.effective_from,
    shiftStart: r.shift_start,
    workingDays: r.working_days,
    useCompanyDefault: r.shift_start === null && r.working_days === null,
    reason: r.reason,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: iso(r.created_at)!,
  };
}

/** GET /employees/:id/schedule (Owner): today's effective schedule, the company default and the history. */
export async function getEmployeeSchedule(db: Queryable, employeeId: string) {
  if (!(await repo.employeeExists(db, employeeId))) throw notFound();
  const { schedule } = await currentSchedule(db);
  const today = workDateOf(clock.now(), schedule.timezone);
  const rows = await repo.employeeScheduleRows(db, [employeeId]);
  const o = (await overridesFor(db, [employeeId])).on(employeeId, today);
  const eff = withOverride(schedule, o);
  return {
    employeeId,
    date: today,
    company: { shiftStart: schedule.shiftStart, shiftEnd: shiftEndOf(schedule.shiftStart), workingDays: schedule.workingDays },
    override: o,
    effective: { shiftStart: eff.shiftStart, shiftEnd: shiftEndOf(eff.shiftStart), workingDays: eff.workingDays },
    history: rows.map(scheduleRowDto),
    label: DEMO_LABEL,
  };
}

/**
 * PUT /employees/:id/schedule (Owner): a new row from `effectiveFrom` (default today); rows are never
 * edited, so sessions before that date keep the schedule that applied. Audited.
 */
export async function setEmployeeSchedule(ctx: CommandContext, employeeId: string, input: PutEmployeeScheduleInput) {
  if (!(await repo.employeeExists(ctx.tx, employeeId))) throw notFound();
  await repo.lockEmployeeAttendance(ctx.tx, employeeId);
  const { schedule } = await currentSchedule(ctx.tx);
  const effectiveFrom = input.effectiveFrom ?? workDateOf(clock.now(), schedule.timezone);
  const shiftStart = input.useCompanyDefault ? null : input.shiftStart ?? null;
  const workingDays = input.useCompanyDefault ? null : input.workingDays ? [...new Set(input.workingDays)] : null;
  const before = await employeeOverrideOn(ctx.tx, employeeId, effectiveFrom);
  const id = await repo.insertEmployeeSchedule(ctx.tx, {
    employeeId,
    effectiveFrom,
    shiftStart,
    workingDays,
    reason: input.reason ?? null,
    createdBy: actorIdOf(ctx),
  });
  await audit(ctx, {
    eventName: 'attendance.employee_schedule_set', // placeholder name (Owner decision 2026-10-29), needs approval (G2)
    entityType: 'employee',
    entityId: employeeId,
    before: { override: before },
    after: { scheduleId: id, effectiveFrom, shiftStart, workingDays },
    reason: input.reason ?? null,
    sourceWorkflow: 'WF-ADMIN-001',
  });
  return getEmployeeSchedule(ctx.tx, employeeId);
}

/** The D2 office check with the dynamic-DNS hostnames resolved (cached, fail closed after 60 min). */
/** C-09: office hostnames resolved BEFORE the command transaction (and its employee lock) opens. */
export interface OfficePreResolve {
  hostnames: string[];
  ips: string[];
  unresolved: string[];
}

/** Resolve the saved office hostnames (cached, 2 s cap per host) on the pool, outside any transaction. */
export async function preResolveOffice(db: Queryable): Promise<OfficePreResolve> {
  const { schedule } = await currentSchedule(db);
  const hostnames = [...schedule.officeHostnames];
  if (hostnames.length === 0) return { hostnames, ips: [], unresolved: [] };
  return { hostnames, ...(await resolveOfficeHostnames(hostnames)) };
}

async function officeCheckNow(clientIp: string | null | undefined, s: Schedule, pre?: OfficePreResolve) {
  let dns: { ips: string[]; unresolved: string[] } = { ips: [], unresolved: [] };
  if (s.officeHostnames.length > 0) {
    // Use the pre-resolved answer when the saved hostnames are still the same; otherwise (settings changed
    // in between, or no pre-resolution) resolve now.
    const same = pre && pre.hostnames.length === s.officeHostnames.length && pre.hostnames.every((h, i) => h === s.officeHostnames[i]);
    dns = same ? pre : await resolveOfficeHostnames(s.officeHostnames);
  }
  return { ...officeCheck(clientIp, s, dns.ips), hostnamesUnresolved: dns.unresolved.length > 0 };
}

function correctionDto(c: repo.CorrectionRow): CorrectionDto {
  return {
    id: c.id,
    sessionId: c.session_id,
    employeeId: c.employee_id,
    employeeName: c.employee_name,
    kind: c.kind,
    status: c.status,
    proposedCheckInAt: iso(c.proposed_check_in_at),
    proposedCheckOutAt: iso(c.proposed_check_out_at),
    proposedCheckOutUnknown: c.proposed_check_out_unknown,
    previousCheckInAt: iso(c.previous_check_in_at),
    previousCheckOutAt: iso(c.previous_check_out_at),
    reason: c.reason,
    closedSessionProvisionally: c.closed_session_provisionally,
    createdBy: c.created_by,
    decidedBy: c.decided_by,
    decidedByName: c.decided_by_name,
    decidedAt: iso(c.decided_at),
    decisionReason: c.decision_reason,
    createdAt: iso(c.created_at)!,
    version: c.version,
  };
}

function remoteDto(r: repo.RemoteRow): RemoteExceptionDto {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    reason: r.reason,
    requestedBy: r.requested_by,
    decidedBy: r.decided_by,
    decidedAt: iso(r.decided_at),
    decisionReason: r.decision_reason,
    createdAt: iso(r.created_at)!,
    version: r.version,
  };
}

const actorIdOf = (ctx: CommandContext): string => {
  if (ctx.actor.kind !== 'employee') throw new Error('attendance command needs an employee actor');
  return ctx.actor.employeeId;
};

async function reloadSession(ctx: CommandContext, id: string): Promise<SessionDto> {
  const row = await repo.sessionById(ctx.tx, id);
  if (!row) throw notFound();
  return (await sessionDtos(ctx.tx, [row]))[0];
}

function sessionAuditState(r: { state: string; effective_check_in_at: Date; effective_check_out_at: Date | null; check_out_unknown?: boolean; version: number }) {
  return {
    state: r.state,
    effectiveCheckInAt: iso(r.effective_check_in_at),
    effectiveCheckOutAt: iso(r.effective_check_out_at),
    checkOutUnknown: r.check_out_unknown ?? false,
    version: r.version,
  };
}

// ---------------------------------------------------------------------------
// Check-in / check-out (WF-ATT-001/002)
// ---------------------------------------------------------------------------

export type CheckInOutcome =
  | { kind: 'ok'; session: SessionDto }
  | { kind: 'office_failed'; mode: VerificationMode; hostnamesUnresolved: boolean };

/** POST /check-in. The failed attempt is audited and committed; the route then answers 422. */
export async function checkIn(ctx: CommandContext, pre?: OfficePreResolve): Promise<CheckInOutcome> {
  const employeeId = actorIdOf(ctx);
  await repo.lockEmployeeAttendance(ctx.tx, employeeId);
  const open = await repo.openSessionOf(ctx.tx, employeeId);
  if (open) {
    throw stateConflict('You already have an open attendance session', { reason: 'OPEN_SESSION', sessionId: open.id, workDate: open.work_date });
  }
  const now = clock.now();
  const info = await currentSchedule(ctx.tx);
  const check = await officeCheckNow(ctx.clientIp, info.schedule, pre);
  // D1: no check-in (not even under a remote exception) until an Owner-saved, complete version exists.
  if (check.result === 'not_configured') throw notConfigured(info.schedule);
  const workDate = workDateOf(now, info.schedule.timezone);
  let result: VerificationDto['result'] = check.result;
  let remoteExceptionId: string | null = null;
  if (check.result === 'failed') {
    const ex = await repo.grantedRemoteOn(ctx.tx, employeeId, workDate);
    if (!ex) {
      await audit(ctx, {
        eventName: 'attendance.checkin_failed', // proposed name (WF-ATT-001 "failed attempt audited"); placeholder
        entityType: 'employee',
        entityId: employeeId,
        payload: { mode: check.mode, workDate, reason: 'office_check_failed', hostnamesUnresolved: check.hostnamesUnresolved },
        securityEvent: true,
        sourceWorkflow: 'WF-ATT-001',
      });
      return { kind: 'office_failed', mode: check.mode, hostnamesUnresolved: check.hostnamesUnresolved };
    }
    result = 'remote';
    remoteExceptionId = ex.id;
  }
  const id = await repo.insertSession(ctx.tx, {
    employeeId,
    state: 'open',
    origin: 'check_in',
    workDate,
    checkInAt: now,
    checkOutAt: null,
    remote: result === 'remote',
    remoteExceptionId,
    checkInVerification: { result, mode: check.mode, ip: normalizeIp(ctx.clientIp) },
    checkOutVerification: null,
    settingsVersionId: info.version?.id ?? null,
  });
  // IC-04 / AC-ATT-008: a concurrent check-in from another device won.
  if (!id) throw stateConflict('You already have an open attendance session', { reason: 'OPEN_SESSION' });
  await audit(ctx, {
    eventName: 'attendance.checked_in',
    entityType: 'attendance_session',
    entityId: id,
    after: { state: 'open', checkInAt: now.toISOString(), workDate, verification: result, mode: check.mode, remote: result === 'remote' },
    securityEvent: true,
    sourceWorkflow: 'WF-ATT-001',
  });
  return { kind: 'ok', session: await reloadSession(ctx, id) };
}

export type CheckOutOutcome = { kind: 'ok'; session: SessionDto; outcome: 'closed' | 'closed_provisional' };

/** 409 POLICY_NOT_CONFIGURED (D1): what is still missing is listed for the Owner screens. */
function notConfigured(s: Schedule): HttpError {
  return stateConflict('Attendance is not configured yet', { reason: 'POLICY_NOT_CONFIGURED', missing: missingSettings(s) });
}

/** D6: "Work completed" with at least 10 non-whitespace characters, or a 400 on `field`. */
function assertWorkSummary(text: string, field: string): void {
  if (summaryCharCount(text) < SUMMARY_MIN_CHARS) {
    throw validationError({ [field]: [`Describe the work completed (at least ${SUMMARY_MIN_CHARS} characters, not counting spaces)`] });
  }
}

/**
 * POST /check-out. F-02: the summary is validated and stored before the office check decides.
 * D5: a session flagged "missing checkout" or from an earlier work date is never self-closed; the
 * employee sends a correction request instead (409 CORRECTION_REQUIRED).
 */
export async function checkOut(ctx: CommandContext, input: CheckOutInput, pre?: OfficePreResolve): Promise<CheckOutOutcome> {
  const employeeId = actorIdOf(ctx);
  await repo.lockEmployeeAttendance(ctx.tx, employeeId);
  const open = await repo.openSessionOf(ctx.tx, employeeId, true);
  if (!open) throw stateConflict('There is no open attendance session to check out', { reason: 'NO_OPEN_SESSION' });
  if (input.version !== undefined && input.version !== open.version) throw versionConflict(open.version, await reloadSession(ctx, open.id)); // BL-09

  const now = clock.now();
  const info = await currentSchedule(ctx.tx);
  const check = await officeCheckNow(ctx.clientIp, info.schedule, pre);
  if (check.result === 'not_configured') throw notConfigured(info.schedule);
  const sessionSchedule = withOverride(await scheduleResolver(ctx.tx, info)(open), await employeeOverrideOn(ctx.tx, employeeId, open.work_date));
  if (open.work_date < workDateOf(now, info.schedule.timezone) || missingCheckoutOf(open, sessionSchedule, now)) {
    throw stateConflict('This session can no longer be checked out. Send a correction request with your checkout time.', {
      reason: 'CORRECTION_REQUIRED',
      sessionId: open.id,
      workDate: open.work_date,
    });
  }
  const summary = input.summary;
  const work = summary.workCompleted.trim();
  assertWorkSummary(work, 'summary.workCompleted');
  let result: VerificationDto['result'] = check.result;
  if (check.result === 'failed' && (open.remote || (await repo.grantedRemoteOn(ctx.tx, employeeId, open.work_date)))) {
    result = 'remote';
  }
  const summaryPatch = {
    summaryWorkCompleted: work || null,
    summaryOutstanding: summary.outstandingTasks || null,
    summaryBlockers: summary.blockers || null,
    summaryNotes: summary.notes || null,
  };
  const verification = { result, mode: check.mode, ip: normalizeIp(ctx.clientIp) };
  const before = sessionAuditState(open);

  if (result !== 'failed') {
    const closedBreaks = await repo.autoCloseActiveBreaksForSession(ctx.tx, open.id, now);
    const ok = await repo.updateSession(ctx.tx, open.id, open.version, {
      state: 'closed',
      checkOutAt: now,
      effectiveCheckOutAt: now,
      checkOutVerification: verification,
      ...summaryPatch,
    });
    if (!ok) throw versionConflict();
    if (closedBreaks.length > 0) {
      await audit(ctx, {
        eventName: 'attendance.break.auto_closed',
        entityType: 'attendance_session',
        entityId: open.id,
        payload: { breakIds: closedBreaks.map((b) => b.id), checkOutAt: now.toISOString() },
        securityEvent: false,
        sourceWorkflow: 'WF-ATT-002',
      });
    }
    await audit(ctx, {
      eventName: 'attendance.checked_out',
      entityType: 'attendance_session',
      entityId: open.id,
      before,
      after: { state: 'closed', checkOutAt: now.toISOString(), verification: result, mode: check.mode },
      securityEvent: true,
      sourceWorkflow: 'WF-ATT-002',
    });
    return { kind: 'ok', session: await reloadSession(ctx, open.id), outcome: 'closed' };
  }

  // D5 (pinned `provisional`): a failed office check closes provisionally at the server-received
  // attempt time, pending Owner review with the failure reason. Next check-in allowed.
  const failure = { checkoutFailureReason: 'office_check_failed', checkOutVerification: verification, checkoutAttemptedAt: now };
  await repo.autoCloseActiveBreaksForSession(ctx.tx, open.id, now);
  const ok = await repo.updateSession(ctx.tx, open.id, open.version, {
    state: 'closed_provisional',
    checkOutAt: now,
    effectiveCheckOutAt: now,
    ...failure,
    ...summaryPatch,
  });
  if (!ok) throw versionConflict();
  await audit(ctx, {
    eventName: 'attendance.checkout_provisional',
    entityType: 'attendance_session',
    entityId: open.id,
    before,
    after: { state: 'closed_provisional', checkOutAt: now.toISOString(), mode: check.mode },
    securityEvent: true,
    sourceWorkflow: 'WF-ATT-002',
  });
  await outbox.emit(ctx.tx, {
    name: 'attendance.checkout_provisional',
    aggregateType: 'attendance_session',
    aggregateId: open.id,
    payload: { sessionId: open.id, employeeId },
  });
  return { kind: 'ok', session: await reloadSession(ctx, open.id), outcome: 'closed_provisional' };
}

// ---------------------------------------------------------------------------
// Reads: My Day / My Attendance (SHR-002..004)
// ---------------------------------------------------------------------------

export async function getToday(db: Queryable, principal: Principal) {
  const info = await currentSchedule(db);
  const now = clock.now();
  const date = workDateOf(now, info.schedule.timezone);
  // The employee's own start / working days apply (company schedule otherwise).
  const s = withOverride(info.schedule, await employeeOverrideOn(db, principal.employeeId, date));
  const missing = missingSettings(s);
  const configured = missing.length === 0;
  const dayOff = configured && (await repo.employeesOffOn(db, date)).has(principal.employeeId);
  const reason = configured ? nonWorkingReason(date, s) ?? (dayOff ? 'day_off' : null) : null;
  const todays = await repo.sessionsOnDate(db, principal.employeeId, date);
  const open = await repo.openSessionOf(db, principal.employeeId);
  const remote = await repo.grantedRemoteOn(db, principal.employeeId, date);
  const resolve = scheduleResolver(db, info);
  const latest = todays.length > 0 ? todays[todays.length - 1] : null;
  const session = open && open.work_date === date ? open : latest;
  const earlier = open && open.work_date !== date ? open : null;
  const pendingCorrections = await repo.countCorrections(db, 'submitted', principal.employeeId);
  const sessionDto = session ? toSessionDto(session, await resolve(session), now) : null;
  return {
    label: DEMO_LABEL,
    now: now.toISOString(),
    date,
    configured,
    missing,
    workingDay: configured ? reason === null : null,
    nonWorkingReason: reason,
    dayOff,
    schedule: {
      timezone: s.timezone || null,
      workingDays: s.workingDays,
      shiftStart: s.shiftStart,
      shiftEnd: shiftEndOf(s.shiftStart),
      graceMinutes: s.graceMinutes,
    },
    requiredMinutes: REQUIRED_MINUTES,
    officeCheck: { mode: 'ip', active: configured },
    remoteExceptionToday: remote ? remoteDto(remote) : null,
    session: sessionDto,
    openSessionFromEarlierDay: earlier ? toSessionDto(earlier, await resolve(earlier), now) : null,
    canCheckIn: configured && !open,
    // D5: an earlier-day or missing-checkout session needs a correction request, not a checkout.
    canCheckOut: configured && Boolean(open) && !earlier && !(sessionDto?.state === 'open' && sessionDto.missingCheckout),
    summaryRule: { required: true, minLength: SUMMARY_MIN_CHARS },
    employeeRequestsEnabled: flag('attendance.employeeRequests'),
    remoteSelfRequestEnabled: flag('attendance.remoteSelfRequest'),
    failedCheckout: 'provisional' as const,
    breaksEnabled: flag('attendance.breaksEnabled'),
    pendingCorrections,
  };
}

function summarize(dtos: SessionDto[]) {
  const closed = dtos.filter((d) => d.durationMinutes !== null);
  const totalMinutes = closed.reduce((a, d) => a + (d.durationMinutes ?? 0), 0);
  return {
    sessions: dtos.length,
    onTime: dtos.filter((d) => d.punctuality === 'on_time').length,
    late: dtos.filter((d) => d.punctuality === 'late').length,
    unclassified: dtos.filter((d) => d.punctuality === 'unclassified').length,
    nonWorkingDay: dtos.filter((d) => d.punctuality === 'non_working_day').length,
    totalMinutes,
    closedSessions: closed.length,
    averageMinutes: closed.length > 0 ? Math.round(totalMinutes / closed.length) : null,
    adjusted: dtos.filter((d) => d.adjusted).length,
    missingCheckout: dtos.filter((d) => d.missingCheckout).length,
    reviewPending: dtos.filter((d) => d.reviewPending).length,
  };
}

/** GET /me/sessions: own sessions only, whatever the role (the Owner's own too). */
export async function mySessions(db: Queryable, principal: Principal, q: MySessionsQuery) {
  const own = (p: SqlParams) => `s.employee_id = ${p.add(principal.employeeId)}`;
  const info = await currentSchedule(db);
  const { rows, total } = await repo.listSessions(db, { from: q.from, to: q.to, scope: own }, q);
  const all = await repo.allSessions(db, { from: q.from, to: q.to, scope: own });
  return {
    ...toPage(await sessionDtos(db, rows, info), total, q),
    summary: summarize(await sessionDtos(db, all, info)),
    label: DEMO_LABEL,
  };
}

const scopeOf = (principal: Principal, action: Action, alias: string) => (p: SqlParams) =>
  access.scopeFilter(principal, action, 'attendance_session', { alias, params: p, idColumn: 'employee_id' });

/** GET /sessions: Owner all, others own (matrix `attendance.read`), via the access engine. */
export async function listSessions(db: Queryable, principal: Principal, q: SessionsQuery) {
  const { rows, total } = await repo.listSessions(
    db,
    { employeeId: q.employeeId, from: q.from, to: q.to, state: q.state, scope: scopeOf(principal, A.read, 's') },
    q
  );
  return { ...toPage(await sessionDtos(db, rows), total, q), label: DEMO_LABEL };
}

export async function getSession(db: Queryable, principal: Principal, id: string) {
  const decision = await access.check(db, principal, A.read, { type: 'attendance_session', id });
  if (!decision.allowed) throw notFound(); // IDOR: another employee's session is "not found", no existence leak
  const row = await repo.sessionById(db, id);
  if (!row) throw notFound();
  const corrections = await repo.correctionsForSession(db, id);
  return { session: (await sessionDtos(db, [row]))[0], corrections: corrections.map(correctionDto), label: DEMO_LABEL };
}

// ---------------------------------------------------------------------------
// Corrections (DEC-011; SM-CORRECTION-001; F-01; N-2)
// ---------------------------------------------------------------------------

function validateInterval(checkIn: Date, checkOut: Date | null, now: Date): void {
  if (checkIn.getTime() > now.getTime() || (checkOut && checkOut.getTime() > now.getTime())) {
    throw ruleViolation('Times cannot be in the future', { reason: 'IN_FUTURE' });
  }
  if (checkOut && checkOut.getTime() <= checkIn.getTime()) {
    throw ruleViolation('Checkout must be after check-in', { reason: 'CHECKOUT_BEFORE_CHECKIN' });
  }
}

async function assertNoOverlap(db: Queryable, employeeId: string, from: Date, to: Date | null, excludeId: string | null) {
  const clash = await repo.overlappingSessions(db, employeeId, from, to, excludeId);
  if (clash.length > 0) throw ruleViolation('The times overlap another attendance session', { reason: 'OVERLAP', sessionIds: clash });
}

/** POST /corrections (employee request, DEC-011 Alt B). */
export async function requestCorrection(ctx: CommandContext, input: CorrectionRequestInput): Promise<CorrectionDto> {
  if (!flag('attendance.employeeRequests')) throw permissionDenied(); // Alt A: Owner-only corrections
  const employeeId = actorIdOf(ctx);
  await repo.lockEmployeeAttendance(ctx.tx, employeeId);
  const now = clock.now();
  const pIn = input.proposedCheckInAt ? new Date(input.proposedCheckInAt) : null;
  const pOut = input.proposedCheckOutAt ? new Date(input.proposedCheckOutAt) : null;

  let id: string | null;
  let session: repo.SessionRow | null = null;
  let closeProvisionally = false;
  if (input.sessionId) {
    session = await repo.sessionById(ctx.tx, input.sessionId, true);
    if (!session || session.employee_id !== employeeId) throw notFound(); // own sessions only; no existence leak
    const newIn = pIn ?? new Date(session.effective_check_in_at);
    const newOut = pOut ?? (session.effective_check_out_at ? new Date(session.effective_check_out_at) : null);
    validateInterval(newIn, newOut, now);
    await assertNoOverlap(ctx.tx, employeeId, newIn, newOut, session.id);
    // D4/D5: a proposed checkout for a still-open session moves it to Owner review WITHOUT an effective
    // checkout (that is set only on approval); the review state no longer blocks the next check-in.
    closeProvisionally = session.state === 'open' && pOut !== null;
    id = await repo.insertCorrection(ctx.tx, {
      sessionId: session.id,
      employeeId,
      kind: 'request',
      status: 'submitted',
      proposedCheckInAt: pIn,
      proposedCheckOutAt: pOut,
      proposedCheckOutUnknown: false,
      previousCheckInAt: new Date(session.effective_check_in_at),
      previousCheckOutAt: session.effective_check_out_at ? new Date(session.effective_check_out_at) : null,
      reason: input.reason,
      closedSessionProvisionally: closeProvisionally,
      createdBy: employeeId,
    });
    if (!id) throw stateConflict('A correction request is already open for this session', { reason: 'REQUEST_OPEN' });
    if (closeProvisionally) {
      await repo.autoCloseActiveBreaksForSession(ctx.tx, session.id, now);
      const ok = await repo.updateSession(ctx.tx, session.id, session.version, { state: 'pending_review' });
      if (!ok) throw versionConflict();
      await audit(ctx, {
        eventName: 'attendance.closed_provisionally', // placeholder name (F-01), needs approval (G2)
        entityType: 'attendance_session',
        entityId: session.id,
        before: sessionAuditState(session),
        after: { state: 'pending_review', effectiveCheckOutAt: null, proposedCheckOutAt: pOut!.toISOString(), correctionId: id },
        sourceWorkflow: 'WF-ATT-003',
      });
    }
  } else {
    // N-2: request a session that does not exist (missing check-in).
    validateInterval(pIn!, pOut, now);
    await assertNoOverlap(ctx.tx, employeeId, pIn!, pOut, null);
    id = await repo.insertCorrection(ctx.tx, {
      sessionId: null,
      employeeId,
      kind: 'request',
      status: 'submitted',
      proposedCheckInAt: pIn,
      proposedCheckOutAt: pOut,
      proposedCheckOutUnknown: false,
      previousCheckInAt: null,
      previousCheckOutAt: null,
      reason: input.reason,
      closedSessionProvisionally: false,
      createdBy: employeeId,
    });
    if (!id) throw stateConflict();
  }
  await audit(ctx, {
    eventName: 'attendance_correction.submitted',
    entityType: 'attendance_correction',
    entityId: id,
    after: {
      status: 'submitted',
      sessionId: session?.id ?? null,
      proposedCheckInAt: iso(pIn),
      proposedCheckOutAt: iso(pOut),
      closedSessionProvisionally: closeProvisionally,
    },
    reason: input.reason,
    sourceWorkflow: 'WF-ATT-003',
  });
  // E-10: Owner notified immediately (AC-ACOR-001).
  await outbox.emit(ctx.tx, {
    name: 'attendance_correction.submitted',
    aggregateType: 'attendance_correction',
    aggregateId: id,
    payload: { correctionId: id, employeeId },
  });
  return correctionDto((await repo.correctionById(ctx.tx, id))!);
}

async function lockedCorrection(ctx: CommandContext, id: string) {
  const c = await repo.correctionById(ctx.tx, id, true);
  if (!c) throw notFound();
  await repo.lockEmployeeAttendance(ctx.tx, c.employee_id);
  return c;
}

/** POST /corrections/:id/approve (Owner). Original kept; effective values set; "adjusted" marker. */
export async function approveCorrection(ctx: CommandContext, id: string, input: { version: number; reason?: string }) {
  const c = await lockedCorrection(ctx, id);
  const decidedBy = actorIdOf(ctx);
  // D4: nobody approves their own correction (the Owner corrects their own record by a direct adjustment).
  if (c.employee_id === decidedBy) throw selfDecision('You cannot approve your own correction request');
  if (c.status === 'approved') return correctionDto(c); // repeat = no-op (§4.5)
  if (c.status !== 'submitted') throw stateConflict('Only a submitted request can be approved', { status: c.status });
  if (c.version !== input.version) throw versionConflict(c.version, correctionDto(c)); // BL-09
  const now = clock.now();
  let sessionId = c.session_id;

  if (c.session_id) {
    const s = await repo.sessionById(ctx.tx, c.session_id, true);
    if (!s) throw notFound();
    const newIn = c.proposed_check_in_at ? new Date(c.proposed_check_in_at) : new Date(s.effective_check_in_at);
    const newOut = c.proposed_check_out_at ? new Date(c.proposed_check_out_at) : s.effective_check_out_at ? new Date(s.effective_check_out_at) : null;
    validateInterval(newIn, newOut, now);
    await assertNoOverlap(ctx.tx, s.employee_id, newIn, newOut, s.id);
    const closes = newOut !== null && s.state !== 'closed';
    const ok = await repo.updateSession(ctx.tx, s.id, s.version, {
      effectiveCheckInAt: newIn,
      effectiveCheckOutAt: newOut,
      ...(newOut ? { checkOutUnknown: false } : {}),
      adjusted: true,
      ...(closes ? { state: 'closed', reviewResolvedAt: now, reviewResolvedBy: decidedBy } : {}),
    });
    if (!ok) throw versionConflict();
    await audit(ctx, {
      eventName: 'attendance.corrected',
      entityType: 'attendance_session',
      entityId: s.id,
      before: sessionAuditState(s),
      after: { state: closes ? 'closed' : s.state, effectiveCheckInAt: newIn.toISOString(), effectiveCheckOutAt: iso(newOut), correctionId: c.id },
      reason: input.reason ?? c.reason,
      sourceWorkflow: 'WF-ATT-003',
    });
  } else {
    // N-2 request approved: create the retroactive session beside the request.
    const inAt = new Date(c.proposed_check_in_at!);
    const outAt = new Date(c.proposed_check_out_at!);
    validateInterval(inAt, outAt, now);
    await assertNoOverlap(ctx.tx, c.employee_id, inAt, outAt, null);
    const info = await currentSchedule(ctx.tx);
    sessionId = await repo.insertSession(ctx.tx, {
      employeeId: c.employee_id,
      state: 'closed',
      origin: 'retroactive',
      workDate: workDateOf(inAt, info.schedule.timezone),
      checkInAt: inAt,
      checkOutAt: outAt,
      remote: false,
      remoteExceptionId: null,
      checkInVerification: { result: 'retroactive', mode: null },
      checkOutVerification: { result: 'retroactive', mode: null },
      settingsVersionId: info.version?.id ?? null,
    });
    if (!sessionId) throw stateConflict();
    await audit(ctx, {
      eventName: 'attendance.corrected',
      entityType: 'attendance_session',
      entityId: sessionId,
      after: { state: 'closed', origin: 'retroactive', effectiveCheckInAt: inAt.toISOString(), effectiveCheckOutAt: outAt.toISOString(), correctionId: c.id },
      reason: input.reason ?? c.reason,
      sourceWorkflow: 'WF-ATT-003',
    });
  }
  const ok = await repo.decideCorrection(ctx.tx, c.id, c.version, {
    status: 'approved',
    decidedBy,
    decidedAt: now,
    reason: input.reason ?? null,
    sessionId,
  });
  if (!ok) throw versionConflict();
  await audit(ctx, {
    eventName: 'attendance_correction.approved',
    entityType: 'attendance_correction',
    entityId: c.id,
    before: { status: 'submitted', version: c.version },
    after: { status: 'approved', sessionId, version: c.version + 1 },
    reason: input.reason ?? null,
    sourceWorkflow: 'WF-ATT-003',
  });
  return correctionDto((await repo.correctionById(ctx.tx, c.id))!);
}

/** POST /corrections/:id/reject (Owner, reason required). F-01: an auto-closed session gets its effective checkout. */
export async function rejectCorrection(
  ctx: CommandContext,
  id: string,
  input: { version: number; reason: string; effectiveCheckOutAt?: string | null }
) {
  const c = await lockedCorrection(ctx, id);
  if (c.status === 'rejected') return correctionDto(c);
  if (c.status !== 'submitted') throw stateConflict('Only a submitted request can be rejected', { status: c.status });
  if (c.version !== input.version) throw versionConflict(c.version, correctionDto(c)); // BL-09
  const now = clock.now();
  const decidedBy = actorIdOf(ctx);

  if (c.session_id && c.closed_session_provisionally) {
    const s = await repo.sessionById(ctx.tx, c.session_id, true);
    if (s && (s.state === 'closed_provisional' || s.state === 'pending_review')) {
      const out = input.effectiveCheckOutAt ? new Date(input.effectiveCheckOutAt) : null;
      if (out) {
        validateInterval(new Date(s.effective_check_in_at), out, now);
        await assertNoOverlap(ctx.tx, s.employee_id, new Date(s.effective_check_in_at), out, s.id);
      }
      const ok = await repo.updateSession(ctx.tx, s.id, s.version, {
        state: 'closed',
        effectiveCheckOutAt: out,
        checkOutUnknown: out === null,
        adjusted: true,
        reviewResolvedAt: now,
        reviewResolvedBy: decidedBy,
      });
      if (!ok) throw versionConflict();
      await repo.insertCorrection(ctx.tx, {
        sessionId: s.id,
        employeeId: s.employee_id,
        kind: 'direct',
        status: 'applied',
        proposedCheckInAt: null,
        proposedCheckOutAt: out,
        proposedCheckOutUnknown: out === null,
        previousCheckInAt: new Date(s.effective_check_in_at),
        previousCheckOutAt: s.effective_check_out_at ? new Date(s.effective_check_out_at) : null,
        reason: input.reason,
        closedSessionProvisionally: false,
        createdBy: decidedBy,
        decidedBy,
        decidedAt: now,
      });
      await audit(ctx, {
        eventName: 'attendance.corrected',
        entityType: 'attendance_session',
        entityId: s.id,
        before: sessionAuditState(s),
        after: { state: 'closed', effectiveCheckOutAt: iso(out), checkOutUnknown: out === null, correctionId: c.id },
        reason: input.reason,
        sourceWorkflow: 'WF-ATT-003',
      });
    }
  }
  const ok = await repo.decideCorrection(ctx.tx, c.id, c.version, { status: 'rejected', decidedBy, decidedAt: now, reason: input.reason });
  if (!ok) throw versionConflict();
  await audit(ctx, {
    eventName: 'attendance_correction.rejected',
    entityType: 'attendance_correction',
    entityId: c.id,
    before: { status: 'submitted', version: c.version },
    after: { status: 'rejected', version: c.version + 1 },
    reason: input.reason,
    sourceWorkflow: 'WF-ATT-003',
  });
  return correctionDto((await repo.correctionById(ctx.tx, c.id))!);
}

/** POST /corrections/:id/withdraw (own, Submitted only). An F-01 auto-closed session stays for Owner review. */
export async function withdrawCorrection(ctx: CommandContext, id: string, input: { version: number }) {
  const c = await lockedCorrection(ctx, id);
  if (c.employee_id !== actorIdOf(ctx)) throw notFound();
  if (c.status === 'withdrawn') return correctionDto(c);
  if (c.status !== 'submitted') throw stateConflict('Only a submitted request can be withdrawn', { status: c.status });
  if (c.version !== input.version) throw versionConflict(c.version, correctionDto(c)); // BL-09
  const ok = await repo.decideCorrection(ctx.tx, c.id, c.version, { status: 'withdrawn', decidedBy: null, decidedAt: clock.now(), reason: null });
  if (!ok) throw versionConflict();
  await audit(ctx, {
    eventName: 'attendance_correction.withdrawn', // placeholder name (undesigned state), needs approval (G2)
    entityType: 'attendance_correction',
    entityId: c.id,
    before: { status: 'submitted', version: c.version },
    after: { status: 'withdrawn', version: c.version + 1 },
    sourceWorkflow: 'WF-ATT-003',
  });
  return correctionDto((await repo.correctionById(ctx.tx, c.id))!);
}

export async function getCorrection(db: Queryable, principal: Principal, id: string) {
  const decision = await access.check(db, principal, A.read, { type: 'attendance_correction', id });
  if (!decision.allowed) throw notFound();
  const c = await repo.correctionById(db, id);
  if (!c) throw notFound();
  return correctionDto(c);
}

/** GET /corrections: Owner all, others own. With `kind` (Owner): the OWN-005 review queue. */
export async function listCorrections(db: Queryable, principal: Principal, q: CorrectionsQuery) {
  if (q.kind) {
    if (!can(principal, A.correctionReview)) throw permissionDenied();
    return reviewQueue(db, { ...q, kind: q.kind });
  }
  const { rows, total } = await repo.listCorrections(
    db,
    {
      status: q.status,
      employeeId: q.employeeId,
      scope: (p) => access.scopeFilter(principal, A.read, 'attendance_correction', { alias: 'c', params: p, idColumn: 'employee_id' }),
    },
    q
  );
  return { ...toPage(rows.map(correctionDto), total, q), label: DEMO_LABEL };
}

function monitorVerification(d: SessionDto | null): MonitorVerification {
  if (!d) return 'none';
  switch (d.verification.checkIn.result) {
    case 'passed':
      return 'recorded'; // AC-ATT-015: "Recorded · mode …", never "Passed"
    case 'remote':
      return 'remote';
    case 'failed':
      return 'blocked';
    default:
      return 'none';
  }
}

function reviewItemFromSession(d: SessionDto, role: ReviewItemDto['role'], kind: ReviewItemDto['kind']): ReviewItemDto {
  return {
    id: d.id,
    kind,
    sessionId: d.id,
    version: d.version,
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    role,
    sessionDate: d.workDate,
    checkInAt: d.effectiveCheckInAt,
    checkOutAt: d.effectiveCheckOutAt ?? d.checkoutAttemptedAt,
    verification: monitorVerification(d),
    blocksCheckIn: d.state === 'open',
    sessionState: d.state,
  };
}

/** DEC-026 alternative previews: none since D5 pinned `provisional` (field kept for FE2). */
function dec026Previews(): { id: string; title: string; detail: string; flagLabel: string }[] {
  return [];
}

async function reviewQueue(db: Queryable, q: CorrectionsQuery & { kind: NonNullable<CorrectionsQuery['kind']> }) {
  const info = await currentSchedule(db);
  const now = clock.now();
  const today = workDateOf(now, info.schedule.timezone);
  const rows = await repo.monitoringSessions(db, today);
  const dtos = await sessionDtos(db, rows, info);
  const roleOf = new Map(rows.map((r) => [r.id, r.employee_role]));
  const needsReview = dtos.filter((d) => !d.pendingCorrectionId && (d.missingCheckout || d.reviewPending));
  const requests = await repo.countCorrections(db, 'submitted');
  const corrected = await repo.adjustedSessions(db, { page: 1, pageSize: 1, order: 'desc' });
  const counts = { review: needsReview.length, requests, corrected: corrected.total };
  const base = { counts, previews: dec026Previews(), label: DEMO_LABEL };

  if (q.kind === 'missing_checkout') {
    const start = (q.page - 1) * q.pageSize;
    const items = needsReview.slice(start, start + q.pageSize).map((d) => reviewItemFromSession(d, roleOf.get(d.id)!, 'missing_checkout'));
    return { ...toPage(items, needsReview.length, q), ...base };
  }
  if (q.kind === 'employee_request') {
    const { rows: cs, total } = await repo.listCorrections(db, { status: 'submitted', kind: 'request', scope: () => 'TRUE' }, q);
    const sessions = await Promise.all(cs.map((c) => (c.session_id ? repo.sessionById(db, c.session_id) : Promise.resolve(null))));
    const sDtos = await sessionDtos(db, sessions.filter((s): s is repo.SessionRow => s !== null), info);
    const byId = new Map(sDtos.map((d) => [d.id, d]));
    const items: ReviewItemDto[] = cs.map((c) => {
      const d = c.session_id ? byId.get(c.session_id) ?? null : null;
      return {
        id: c.id,
        kind: 'employee_request',
        sessionId: c.session_id ?? '',
        version: c.version,
        employeeId: c.employee_id,
        employeeName: c.employee_name,
        role: c.employee_role,
        sessionDate: d?.workDate ?? workDateOf(new Date(c.proposed_check_in_at ?? c.created_at), info.schedule.timezone),
        checkInAt: d?.effectiveCheckInAt ?? iso(c.proposed_check_in_at)!,
        checkOutAt: d ? d.effectiveCheckOutAt : null,
        verification: monitorVerification(d),
        blocksCheckIn: d?.state === 'open',
        sessionState: d?.state ?? 'closed',
        proposedCheckInAt: iso(c.proposed_check_in_at),
        proposedCheckOutAt: iso(c.proposed_check_out_at),
        employeeReason: c.reason,
        requestedAt: iso(c.created_at),
      };
    });
    return { ...toPage(items, total, q), ...base };
  }
  const { rows: adj, total } = await repo.adjustedSessions(db, q);
  const adjDtos = await sessionDtos(db, adj, info);
  const decisions = await repo.latestDecisions(db, adj.map((r) => r.id));
  const items = adjDtos.map((d, i) => {
    const dec = decisions.get(d.id);
    return {
      ...reviewItemFromSession(d, adj[i].employee_role, 'corrected'),
      correctedAt: iso(dec?.decided_at ?? dec?.created_at ?? null),
      correctedBy: dec?.decided_by_name ?? null,
      correctionReason: dec?.decision_reason ?? dec?.reason ?? null,
    };
  });
  return { ...toPage(items, total, q), ...base };
}

// ---------------------------------------------------------------------------
// Owner direct actions (N-2, DEC-026 review)
// ---------------------------------------------------------------------------

/**
 * D6: the Owner completes a missing "Work completed" (reason mandatory). Additive: an employee-written
 * summary is never replaced; the writer and the reason are stored beside it and audited.
 */
async function ownerSummaryPatch(ctx: CommandContext, s: repo.SessionRow, workCompleted: string | undefined, reason: string | undefined) {
  if (workCompleted === undefined) return {};
  if (s.summary_work_completed && s.summary_work_completed.trim()) {
    throw ruleViolation('The employee already wrote a work summary; it is never replaced', { reason: 'SUMMARY_EXISTS' });
  }
  if (!reason) throw validationError({ reason: ['A reason is required to complete the summary'] });
  assertWorkSummary(workCompleted, 'workCompleted');
  await audit(ctx, {
    eventName: 'attendance.summary_completed', // placeholder name (D6), needs approval (G2)
    entityType: 'attendance_session',
    entityId: s.id,
    after: { summaryWrittenBy: actorIdOf(ctx) },
    reason,
    sourceWorkflow: 'WF-ATT-003',
  });
  return { summaryWorkCompleted: workCompleted.trim(), summaryWrittenBy: actorIdOf(ctx), summaryCompletionReason: reason };
}

/** POST /sessions/:id/adjust (Owner direct correction; original kept). */
export async function adjustSession(ctx: CommandContext, id: string, input: AdjustInput) {
  const s0 = await repo.sessionById(ctx.tx, id);
  if (!s0) throw notFound();
  // E-03 (D4) / S-30: only the Owner adjusts their own record, with a reason (audited selfAdjusted).
  const selfAdjusted = ownerSelfDecision(selfActor(ctx), s0.employee_id, input.reason, 'You cannot adjust your own attendance session');
  await repo.lockEmployeeAttendance(ctx.tx, s0.employee_id);
  const s = (await repo.sessionById(ctx.tx, id, true))!;
  if (s.version !== input.version) throw versionConflict(s.version, await reloadSession(ctx, s.id)); // BL-09
  const now = clock.now();
  const actor = actorIdOf(ctx);
  const summaryPatch = await ownerSummaryPatch(ctx, s, input.workCompleted, input.reason);
  if (input.checkInAt === undefined && input.checkOutAt === undefined && input.checkOutUnknown !== true) {
    // Summary only: the times, the "adjusted" marker and any review item are untouched.
    const ok = await repo.updateSession(ctx.tx, s.id, s.version, summaryPatch);
    if (!ok) throw versionConflict();
    return { session: await reloadSession(ctx, s.id), label: DEMO_LABEL };
  }
  const newIn = input.checkInAt ? new Date(input.checkInAt) : new Date(s.effective_check_in_at);
  const unknown = input.checkOutUnknown === true ? true : input.checkOutAt ? false : s.check_out_unknown;
  const newOut = input.checkOutUnknown ? null : input.checkOutAt ? new Date(input.checkOutAt) : s.effective_check_out_at ? new Date(s.effective_check_out_at) : null;
  validateInterval(newIn, newOut, now);
  await assertNoOverlap(ctx.tx, s.employee_id, newIn, newOut, s.id);
  const closes = (newOut !== null || unknown) && s.state !== 'closed';
  const ok = await repo.updateSession(ctx.tx, s.id, s.version, {
    effectiveCheckInAt: newIn,
    effectiveCheckOutAt: newOut,
    checkOutUnknown: unknown,
    adjusted: true,
    ...summaryPatch,
    ...(closes ? { state: 'closed', reviewResolvedAt: now, reviewResolvedBy: actor } : {}),
  });
  if (!ok) throw versionConflict();
  const correctionId = await repo.insertCorrection(ctx.tx, {
    sessionId: s.id,
    employeeId: s.employee_id,
    kind: 'direct',
    status: 'applied',
    proposedCheckInAt: input.checkInAt ? newIn : null,
    proposedCheckOutAt: input.checkOutAt ? newOut : null,
    proposedCheckOutUnknown: input.checkOutUnknown === true,
    previousCheckInAt: new Date(s.effective_check_in_at),
    previousCheckOutAt: s.effective_check_out_at ? new Date(s.effective_check_out_at) : null,
    reason: input.reason,
    closedSessionProvisionally: false,
    createdBy: actor,
    decidedBy: actor,
    decidedAt: now,
  });
  await audit(ctx, {
    eventName: 'attendance.corrected',
    entityType: 'attendance_session',
    entityId: s.id,
    before: sessionAuditState(s),
    after: {
      state: closes ? 'closed' : s.state,
      effectiveCheckInAt: newIn.toISOString(),
      effectiveCheckOutAt: iso(newOut),
      checkOutUnknown: unknown,
      correctionId,
      ...(selfAdjusted ? { selfAdjusted: true } : {}),
    },
    reason: input.reason,
    sourceWorkflow: 'WF-ATT-003',
  });
  return { session: await reloadSession(ctx, s.id), label: DEMO_LABEL };
}

/** POST /sessions/:id/resolve-review (Owner): DEC-026 provisional / pending-review items. */
export async function resolveReview(ctx: CommandContext, id: string, input: ResolveReviewInput) {
  const s0 = await repo.sessionById(ctx.tx, id);
  if (!s0) throw notFound();
  // E-03 (D4) / S-30: only the Owner resolves their own review item, with a reason (audited selfAdjusted).
  const selfAdjusted = ownerSelfDecision(selfActor(ctx), s0.employee_id, input.reason, 'You cannot resolve the review of your own attendance session');
  await repo.lockEmployeeAttendance(ctx.tx, s0.employee_id);
  const s = (await repo.sessionById(ctx.tx, id, true))!;
  if (s.state === 'closed' && s.review_resolved_at) return { session: await reloadSession(ctx, s.id), label: DEMO_LABEL };
  if (s.state !== 'closed_provisional' && s.state !== 'pending_review') {
    throw stateConflict('This session has no review item', { state: s.state });
  }
  if (s.version !== input.version) throw versionConflict(s.version, await reloadSession(ctx, s.id)); // BL-09
  const now = clock.now();
  const actor = actorIdOf(ctx);
  // D4: a resolution that changes the recorded times needs a reason.
  if ((input.checkOutAt !== undefined || input.checkOutUnknown === true) && !input.reason) {
    throw validationError({ reason: ['A reason is required when the checkout is changed'] });
  }
  const summaryPatch = await ownerSummaryPatch(ctx, s, input.workCompleted, input.reason);
  const attempted = s.effective_check_out_at ?? s.checkout_attempted_at;
  const out = input.checkOutUnknown ? null : input.checkOutAt ? new Date(input.checkOutAt) : attempted ? new Date(attempted) : null;
  const unknown = input.checkOutUnknown === true || out === null;
  validateInterval(new Date(s.effective_check_in_at), out, now);
  await assertNoOverlap(ctx.tx, s.employee_id, new Date(s.effective_check_in_at), out, s.id);
  const changed = Boolean(input.checkOutAt || input.checkOutUnknown);
  const ok = await repo.updateSession(ctx.tx, s.id, s.version, {
    state: 'closed',
    effectiveCheckOutAt: out,
    checkOutUnknown: unknown,
    ...(changed ? { adjusted: true } : {}),
    ...summaryPatch,
    reviewResolvedAt: now,
    reviewResolvedBy: actor,
  });
  if (!ok) throw versionConflict();
  if (changed) {
    await repo.insertCorrection(ctx.tx, {
      sessionId: s.id,
      employeeId: s.employee_id,
      kind: 'direct',
      status: 'applied',
      proposedCheckInAt: null,
      proposedCheckOutAt: out,
      proposedCheckOutUnknown: unknown,
      previousCheckInAt: new Date(s.effective_check_in_at),
      previousCheckOutAt: s.effective_check_out_at ? new Date(s.effective_check_out_at) : null,
      reason: input.reason!,
      closedSessionProvisionally: false,
      createdBy: actor,
      decidedBy: actor,
      decidedAt: now,
    });
  }
  await audit(ctx, {
    eventName: 'attendance.review_resolved', // placeholder name (DEC-026 review), needs approval (G2)
    entityType: 'attendance_session',
    entityId: s.id,
    before: sessionAuditState(s),
    after: { state: 'closed', effectiveCheckOutAt: iso(out), checkOutUnknown: unknown, adjusted: changed || s.adjusted, ...(selfAdjusted ? { selfAdjusted: true } : {}) },
    reason: input.reason ?? null,
    sourceWorkflow: 'WF-ATT-003',
  });
  return { session: await reloadSession(ctx, s.id), label: DEMO_LABEL };
}

/** POST /sessions (Owner retroactive session, N-2). */
export async function createRetroactive(ctx: CommandContext, input: RetroactiveInput) {
  // E-03 (D4) / S-30: only the Owner creates their own retroactive session, with a reason (audited selfAdjusted).
  const selfAdjusted = ownerSelfDecision(selfActor(ctx), input.employeeId, input.reason, 'You cannot create a retroactive session for yourself');
  const emp = await repo.employeeExists(ctx.tx, input.employeeId);
  if (!emp) throw notFound();
  await repo.lockEmployeeAttendance(ctx.tx, input.employeeId);
  const now = clock.now();
  const inAt = new Date(input.checkInAt);
  const outAt = new Date(input.checkOutAt);
  validateInterval(inAt, outAt, now);
  await assertNoOverlap(ctx.tx, input.employeeId, inAt, outAt, null);
  const info = await currentSchedule(ctx.tx);
  const actor = actorIdOf(ctx);
  const id = await repo.insertSession(ctx.tx, {
    employeeId: input.employeeId,
    state: 'closed',
    origin: 'retroactive',
    workDate: workDateOf(inAt, info.schedule.timezone),
    checkInAt: inAt,
    checkOutAt: outAt,
    remote: false,
    remoteExceptionId: null,
    checkInVerification: { result: 'retroactive', mode: null },
    checkOutVerification: { result: 'retroactive', mode: null },
    settingsVersionId: info.version?.id ?? null,
  });
  if (!id) throw stateConflict();
  await repo.insertCorrection(ctx.tx, {
    sessionId: id,
    employeeId: input.employeeId,
    kind: 'retroactive',
    status: 'applied',
    proposedCheckInAt: inAt,
    proposedCheckOutAt: outAt,
    proposedCheckOutUnknown: false,
    previousCheckInAt: null,
    previousCheckOutAt: null,
    reason: input.reason,
    closedSessionProvisionally: false,
    createdBy: actor,
    decidedBy: actor,
    decidedAt: now,
  });
  await audit(ctx, {
    eventName: 'attendance.retroactive_created', // placeholder name (N-2), needs approval (G2)
    entityType: 'attendance_session',
    entityId: id,
    after: {
      state: 'closed',
      origin: 'retroactive',
      employeeId: input.employeeId,
      checkInAt: inAt.toISOString(),
      checkOutAt: outAt.toISOString(),
      ...(selfAdjusted ? { selfAdjusted: true } : {}),
    },
    reason: input.reason,
    sourceWorkflow: 'WF-ATT-003',
  });
  return { session: await reloadSession(ctx, id), label: DEMO_LABEL };
}

// ---------------------------------------------------------------------------
// Remote exceptions (DEC-010)
// ---------------------------------------------------------------------------

export async function grantRemote(ctx: CommandContext, input: { employeeId: string; startDate: string; endDate?: string; reason: string }) {
  const emp = await repo.employeeExists(ctx.tx, input.employeeId);
  if (!emp) throw notFound();
  const actor = actorIdOf(ctx);
  // D3: nobody grants their own remote exception.
  if (input.employeeId === actor) throw selfDecision('You cannot grant yourself a remote exception');
  const now = clock.now();
  const endDate = input.endDate ?? input.startDate;
  const id = await repo.insertRemote(ctx.tx, {
    employeeId: input.employeeId,
    startDate: input.startDate,
    endDate,
    status: 'granted',
    reason: input.reason,
    requestedBy: actor,
    decidedBy: actor,
    decidedAt: now,
  });
  await audit(ctx, {
    eventName: 'attendance.remote_exception_granted', // placeholder name (DEC-010), needs approval (G2)
    entityType: 'remote_exception',
    entityId: id,
    after: { status: 'granted', employeeId: input.employeeId, startDate: input.startDate, endDate },
    reason: input.reason,
    sourceWorkflow: 'WF-ATT-001',
  });
  return remoteDto((await repo.remoteById(ctx.tx, id))!);
}

export async function requestRemote(ctx: CommandContext, input: { startDate: string; endDate?: string; reason: string }) {
  // DEC-010 default: no self-service button in v1 (flag false → denied).
  if (!flag('attendance.remoteSelfRequest')) throw permissionDenied();
  const actor = actorIdOf(ctx);
  const endDate = input.endDate ?? input.startDate;
  const id = await repo.insertRemote(ctx.tx, {
    employeeId: actor,
    startDate: input.startDate,
    endDate,
    status: 'requested',
    reason: input.reason,
    requestedBy: actor,
    decidedBy: null,
    decidedAt: null,
  });
  await audit(ctx, {
    eventName: 'attendance.remote_exception_requested', // placeholder name, needs approval (G2)
    entityType: 'remote_exception',
    entityId: id,
    after: { status: 'requested', startDate: input.startDate, endDate },
    reason: input.reason,
    sourceWorkflow: 'WF-ATT-001',
  });
  return remoteDto((await repo.remoteById(ctx.tx, id))!);
}

const REMOTE_TRANSITIONS: Record<'approve' | 'reject' | 'revoke', { from: string; to: 'granted' | 'rejected' | 'revoked'; event: string }> = {
  approve: { from: 'requested', to: 'granted', event: 'attendance.remote_exception_granted' },
  reject: { from: 'requested', to: 'rejected', event: 'attendance.remote_exception_rejected' },
  revoke: { from: 'granted', to: 'revoked', event: 'attendance.remote_exception_revoked' },
};

export async function decideRemote(
  ctx: CommandContext,
  id: string,
  verb: 'approve' | 'reject' | 'revoke',
  input: { version: number; reason?: string }
) {
  const t = REMOTE_TRANSITIONS[verb];
  const r = await repo.remoteById(ctx.tx, id, true);
  if (!r) throw notFound();
  if (verb === 'approve' && r.employee_id === actorIdOf(ctx)) throw selfDecision('You cannot approve your own remote exception');
  if (r.status === t.to) return remoteDto(r);
  if (r.status !== t.from) throw stateConflict(`Only a ${t.from} exception can be changed this way`, { status: r.status });
  if (r.version !== input.version) throw versionConflict(r.version, remoteDto(r)); // BL-09
  if (verb === 'reject' && !input.reason) throw validationError({ reason: ['Reason is required to reject'] });
  const ok = await repo.decideRemote(ctx.tx, id, input.version, { status: t.to, decidedBy: actorIdOf(ctx), decidedAt: clock.now(), reason: input.reason ?? null });
  if (!ok) throw versionConflict();
  await audit(ctx, {
    eventName: t.event, // placeholder names (DEC-010), need approval (G2)
    entityType: 'remote_exception',
    entityId: id,
    before: { status: r.status, version: r.version },
    after: { status: t.to, version: r.version + 1 },
    reason: input.reason ?? null,
    sourceWorkflow: 'WF-ATT-001',
  });
  return remoteDto((await repo.remoteById(ctx.tx, id))!);
}

export async function listRemote(db: Queryable, principal: Principal, q: RemoteQuery) {
  const { rows, total } = await repo.listRemote(
    db,
    { employeeId: q.employeeId, status: q.status, scope: scopeOf(principal, A.read, 'r') },
    q
  );
  return { ...toPage(rows.map(remoteDto), total, q), label: DEMO_LABEL };
}

// ---------------------------------------------------------------------------
// Owner monitoring (OWN-004)
// ---------------------------------------------------------------------------

export async function overview(db: Queryable, q: OverviewQuery) {
  const info = await currentSchedule(db);
  const s = info.schedule;
  const now = clock.now();
  const today = workDateOf(now, s.timezone);
  const date = q.date ?? today;
  const missing = missingSettings(s);
  // D1: schedule figures (expected, late, missing check-in) only from a complete Owner-saved version.
  const scheduleConfigured = missing.length === 0;
  const reason = scheduleConfigured ? nonWorkingReason(date, s) : null;
  const workingDay = scheduleConfigured ? reason === null : null;

  const employees = await repo.activeEmployees(db, q.employeeId);
  const rows = await repo.monitoringSessions(db, date, q.employeeId);
  const dtos = await sessionDtos(db, rows, info);
  const remoteToday = await repo.grantedRemoteEmployeesOn(db, date);
  const offToday = await repo.employeesOffOn(db, date);
  const ov = await overridesFor(db, employees.map((e) => e.id));
  const { rows: pending } = await repo.listCorrections(db, { status: 'submitted', scope: () => 'TRUE' }, { page: 1, pageSize: 100, order: 'desc' });
  const pendingBy = new Map<string, number>();
  for (const c of pending) pendingBy.set(c.employee_id, (pendingBy.get(c.employee_id) ?? 0) + 1);

  // Missing check-in (AC-ATT-014): the employee's working day, past their start + grace + alert minutes, no session.
  const alertMinutes = await getSetting(db, 'notifications.missingCheckinAfterGraceMinutes');

  const out: OverviewRowDto[] = employees.map((e) => {
    const es = withOverride(s, ov.on(e.id, date));
    const empWorking = scheduleConfigured ? nonWorkingReason(date, es) === null : null;
    const checkinDue = empWorking ? zonedToUtc(date, es.shiftStart, es.timezone).getTime() + (es.graceMinutes + alertMinutes) * 60_000 : null;
    const checkinWindowPassed = checkinDue !== null && (date < today || now.getTime() >= checkinDue);
    const mine = dtos.filter((d) => d.employeeId === e.id);
    const onDate = mine.filter((d) => d.workDate === date);
    const first = onDate[0] ?? null;
    const latest = onDate.length > 0 ? onDate[onDate.length - 1] : null;
    const openEarlier = mine.find((d) => d.state === 'open' && d.workDate < date) ?? null;
    const status: OverviewRowDto['status'] = latest
      ? latest.state === 'open'
        ? 'checked_in'
        : 'checked_out'
      : openEarlier
        ? 'open_previous'
        : 'not_checked_in';
    const shown = latest ?? openEarlier;
    return {
      employeeId: e.id,
      employeeName: e.full_name,
      role: e.role,
      status,
      openSince: openEarlier ? openEarlier.effectiveCheckInAt : null,
      checkInAt: first?.effectiveCheckInAt ?? null,
      checkOutAt: latest?.effectiveCheckOutAt ?? null,
      verification: monitorVerification(first),
      punctuality: first ? first.punctuality : null,
      missingCheckout: mine.some((d) => d.missingCheckout),
      missingCheckin: !first && !openEarlier && checkinWindowPassed && !offToday.has(e.id),
      reviewPending: mine.some((d) => d.reviewPending),
      pendingCorrections: pendingBy.get(e.id) ?? 0,
      remoteExceptionToday: remoteToday.has(e.id),
      dayOff: offToday.has(e.id),
      workingDay: empWorking,
      shiftStart: scheduleConfigured ? es.shiftStart : null,
      employee: { id: e.id, fullName: e.full_name, role: e.role },
      session: shown,
    };
  });

  const firsts = out.map((r) => r.checkInAt).filter((v): v is string => v !== null).sort();
  const reviewItems = dtos.filter((d) => d.reviewPending);
  const openFromEarlierDays = dtos.filter((d) => d.state === 'open' && d.workDate < date);
  const counts = {
    employees: out.length,
    checkedIn: out.filter((r) => r.status === 'checked_in').length,
    checkedOut: out.filter((r) => r.status === 'checked_out').length,
    notCheckedIn: out.filter((r) => r.status === 'not_checked_in' && !r.dayOff && r.workingDay !== false).length,
    late: out.filter((r) => r.punctuality === 'late').length,
    remote: dtos.filter((d) => d.workDate === date && d.remote).length,
    missingCheckout: out.filter((r) => r.missingCheckout).length,
    missingCheckin: out.filter((r) => r.missingCheckin).length,
    daysOff: out.filter((r) => r.dayOff).length,
    reviewItems: reviewItems.length,
    pendingCorrections: pending.length,
  };
  const exceptions = [
    ...out
      .filter((r) => r.missingCheckout)
      .map((r) => ({
        id: `missing_checkout:${r.employeeId}`,
        kind: 'missing_checkout' as const,
        title: `${r.employeeName}: missing checkout`,
        detail: 'Session still open past shift end. It is never closed automatically.',
        employeeId: r.employeeId,
        occurredAt: r.openSince ?? r.checkInAt,
      })),
    ...(scheduleConfigured
      ? []
      : [
          {
            id: 'checkin_alerts_off',
            kind: 'checkin_alerts_off' as const,
            title: 'Missing check-in alerts are off',
            detail: 'Attendance settings are not configured (working days, start time, timezone, office IPs, holidays).',
            employeeId: null,
            occurredAt: null,
          },
        ]),
  ];
  return {
    label: DEMO_LABEL,
    date,
    asOf: now.toISOString(),
    configured: missing.length === 0,
    missing,
    scheduleConfigured,
    workingDay,
    nonWorkingReason: reason,
    counts,
    // FE2 OWN-004 summary cards; `null` = not configured (never 0, never "absent").
    summary: {
      expected: scheduleConfigured ? out.filter((r) => r.workingDay && !r.dayOff).length : null,
      checkedIn: counts.checkedIn,
      checkedOut: counts.checkedOut,
      notCheckedIn: scheduleConfigured ? counts.notCheckedIn : null,
      missingCheckout: counts.missingCheckout,
      lateArrivals: scheduleConfigured ? counts.late : null,
      firstCheckIn: firsts[0] ?? null,
      lastCheckIn: firsts.length > 0 ? firsts[firsts.length - 1] : null,
    },
    rows: out,
    reviewItems,
    openFromEarlierDays,
    exceptions,
  };
}

// ---------------------------------------------------------------------------
// Employee list support (OWN-002) and open items
// ---------------------------------------------------------------------------

export interface AttendanceOpenWork {
  openSessions: number;
  openSince: string | null;
  missingCheckout: boolean;
}

/** Open-session count + missing-checkout flag per employee (one query). */
export async function openWorkFor(db: Queryable, employeeIds: string[]): Promise<Map<string, AttendanceOpenWork>> {
  const out = new Map<string, AttendanceOpenWork>(employeeIds.map((id) => [id, { openSessions: 0, openSince: null, missingCheckout: false }]));
  const rows = await repo.openSessionsFor(db, employeeIds);
  if (rows.length === 0) return out;
  const info = await currentSchedule(db);
  const dtos = await sessionDtos(db, rows, info);
  for (const d of dtos) {
    const w = out.get(d.employeeId)!;
    w.openSessions += 1;
    w.openSince = w.openSince && w.openSince < d.effectiveCheckInAt ? w.openSince : d.effectiveCheckInAt;
    w.missingCheckout = w.missingCheckout || d.missingCheckout;
  }
  return out;
}

// ---------------------------------------------------------------------------
// J-04 attendance exception check (every 5 min; never closes a session)
// ---------------------------------------------------------------------------

export async function runExceptionCheck(
  ctx: CommandContext
): Promise<{ notConfigured: boolean; missingCheckin: number; missingCheckout: number; checkoutReminders: number }> {
  const info = await currentSchedule(ctx.tx);
  const s = info.schedule;
  const now = clock.now();
  const result = { notConfigured: false, missingCheckin: 0, missingCheckout: 0, checkoutReminders: 0 };

  if (missingSettings(s).length > 0) {
    // D1 "Not configured" marker (plan §8): no J-04 alert runs on assumed values.
    result.notConfigured = true;
    await repo.insertException(ctx.tx, { kind: 'not_configured', workDate: now.toISOString().slice(0, 10), employeeId: null, sessionId: null, at: now });
    return result;
  }
  const versionOf = scheduleResolver(ctx.tx, info);
  const ov = await overridesFor(ctx.tx, (await repo.activeEmployees(ctx.tx)).map((e) => e.id));
  // Session schedule = its settings version + the employee's override on its work date.
  const resolve = async (r: repo.SessionRow) => withOverride(await versionOf(r), ov.on(r.employee_id, r.work_date));

  // D18 checkout reminder: the employee, at shift end + 1 h, once per open session's work date.
  const reminderMinutes = await getSetting(ctx.tx, 'notifications.missingCheckoutAfterShiftMinutes');
  for (const r of await repo.openSessionsWithoutReminder(ctx.tx)) {
    const end = shiftEndAt(r.work_date, await resolve(r));
    if (!end || now.getTime() < end.getTime() + reminderMinutes * 60_000) continue;
    const inserted = await repo.insertException(ctx.tx, { kind: 'missing_checkout_reminder', workDate: r.work_date, employeeId: r.employee_id, sessionId: r.id, at: now });
    if (!inserted) continue;
    await outbox.emit(ctx.tx, {
      name: 'attendance.missing_checkout_reminder',
      aggregateType: 'attendance_session',
      aggregateId: r.id,
      payload: { sessionId: r.id, employeeId: r.employee_id, workDate: r.work_date },
    });
    result.checkoutReminders += 1;
  }

  // Missing checkout (D5): every open session past its work date's shift end + flag hours. The Owner
  // sees it in the review list and the next morning digest (attendance_exceptions rows).
  for (const r of await repo.openUnflaggedSessions(ctx.tx)) {
    const sched = await resolve(r);
    const due = missingCheckoutDueAt(r.work_date, sched);
    if (!due || now.getTime() < due.getTime()) continue;
    const ok = await repo.updateSession(ctx.tx, r.id, r.version, { missingCheckoutFlaggedAt: now });
    if (!ok) continue;
    await repo.insertException(ctx.tx, { kind: 'missing_checkout', workDate: r.work_date, employeeId: r.employee_id, sessionId: r.id, at: now });
    await audit(ctx, {
      eventName: 'attendance.missing_checkout_flagged', // placeholder name (D5), needs approval (G2)
      entityType: 'attendance_session',
      entityId: r.id,
      after: { missingCheckoutFlaggedAt: now.toISOString(), state: 'open' },
      sourceWorkflow: 'J-04',
    });
    await outbox.emit(ctx.tx, {
      name: 'attendance.missing_checkout_detected',
      aggregateType: 'attendance_session',
      aggregateId: r.id,
      payload: { sessionId: r.id, employeeId: r.employee_id, workDate: r.work_date },
    });
    result.missingCheckout += 1;
  }

  // Missing check-in (AC-ATT-014, D18): Owner at start + grace + 30 min, scheduled working days only;
  // never on weekends/holidays, and not for an employee on an approved day off (repo filter).
  // Per employee: their own start time / working days (company holidays and grace apply to all).
  const date = workDateOf(now, s.timezone);
  if (s.holidays.includes(date)) return result;
  const alertMinutes = await getSetting(ctx.tx, 'notifications.missingCheckinAfterGraceMinutes');
  // An earlier still-open session is a missing checkout, not a missing check-in.
  const candidates = await repo.employeesWithoutAttendance(ctx.tx, date);
  const cov = await overridesFor(ctx.tx, candidates);
  for (const employeeId of candidates) {
    const es = withOverride(s, cov.on(employeeId, date));
    if (nonWorkingReason(date, es)) continue;
    if (now.getTime() < zonedToUtc(date, es.shiftStart, es.timezone).getTime() + (es.graceMinutes + alertMinutes) * 60_000) continue;
    const e = { id: employeeId };
    const inserted = await repo.insertException(ctx.tx, { kind: 'missing_checkin', workDate: date, employeeId: e.id, sessionId: null, at: now });
    if (!inserted) continue;
    await outbox.emit(ctx.tx, {
      name: 'attendance.missing_checkin_detected',
      aggregateType: 'employee',
      aggregateId: e.id,
      payload: { employeeId: e.id, workDate: date },
    });
    result.missingCheckin += 1;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Breaks Engine (user decision 2026-10-28: kept; FX-BE hardening)
// ---------------------------------------------------------------------------
// Rules (Demonstration alternative — not approved, docs/policy-defaults.md):
// - A break needs the caller's own open session (any other state → 409 NO_OPEN_SESSION).
// - One active break at a time (partial unique index + row lock), at most
//   `attendance.maxBreaksPerSession` breaks per session (409 BREAK_LIMIT_REACHED).
// - Times are server time only; a break never starts before the session check-in and is closed
//   automatically at check-out (audited `attendance.break.auto_closed`).
// - Allowance `attendance.breakAllowanceMinutes` per session (C-19): no new break starts once it is used up
//   (409 BREAK_ALLOWANCE_USED); a running break may overrun, which is audited
//   (`attendance.excessive_break_detected`) and shown as `isExcessive`; check-out closes it.
// - Reads are own-record only through access.check('attendance_session') (the Owner reads all).

async function breakPolicy(db: Queryable): Promise<{ allowanceSeconds: number; maxBreaks: number }> {
  // Sequential: `db` may be a transaction client (no concurrent queries on one pg client).
  const allowance = await getSetting(db, 'attendance.breakAllowanceMinutes');
  const maxBreaks = await getSetting(db, 'attendance.maxBreaksPerSession');
  return { allowanceSeconds: allowance * 60, maxBreaks };
}

function breakTotals(breaks: repo.BreakRow[], now: Date): number {
  let total = 0;
  for (const b of breaks) {
    if (b.ended_at && b.duration_seconds !== null) total += b.duration_seconds;
    else if (!b.ended_at) total += Math.max(0, Math.floor((now.getTime() - b.started_at.getTime()) / 1000));
  }
  return total;
}

export async function startBreak(ctx: CommandContext, input: StartBreakInput): Promise<BreakDto> {
  const employeeId = actorIdOf(ctx);
  await repo.lockEmployeeAttendance(ctx.tx, employeeId);
  const open = await repo.openSessionOf(ctx.tx, employeeId, true);
  if (!open) {
    throw stateConflict('There is no open attendance session to start a break', { reason: 'NO_OPEN_SESSION' });
  }

  const existingActive = await repo.activeBreakOfSession(ctx.tx, open.id, true);
  if (existingActive) {
    throw stateConflict('A break is already active for this session', { reason: 'BREAK_ALREADY_ACTIVE' });
  }
  const policy = await breakPolicy(ctx.tx);
  const sessionBreaks = await repo.listBreaksForSession(ctx.tx, open.id);
  if (sessionBreaks.length >= policy.maxBreaks) {
    throw stateConflict(`At most ${policy.maxBreaks} breaks per session`, { reason: 'BREAK_LIMIT_REACHED', limit: policy.maxBreaks });
  }
  // C-19 / S-25: the total break allowance is enforced too. Once the minutes are used up no new break starts
  // (a running break may still overrun and is flagged when it ends; check-out closes it, auto_closed).
  if (policy.allowanceSeconds > 0 && breakTotals(sessionBreaks, clock.now()) >= policy.allowanceSeconds) {
    throw stateConflict(`The break allowance of ${Math.round(policy.allowanceSeconds / 60)} minutes for this session is used up`, {
      reason: 'BREAK_ALLOWANCE_USED',
      allowanceMinutes: Math.round(policy.allowanceSeconds / 60),
    });
  }

  const now = clock.now();
  const created = await repo.insertBreak(ctx.tx, {
    sessionId: open.id,
    employeeId,
    breakType: input.breakType,
    notes: input.notes,
    startedAt: now,
  });

  if (!created) {
    throw stateConflict('A break is already active for this session', { reason: 'BREAK_ALREADY_ACTIVE' });
  }

  await audit(ctx, {
    eventName: 'attendance.break.started',
    entityType: 'attendance_session',
    entityId: open.id,
    after: { breakId: created.id, breakType: input.breakType },
    payload: { breakId: created.id, breakType: input.breakType, startedAt: now.toISOString() },
    securityEvent: false,
    sourceWorkflow: 'WF-ATT-001',
  });

  return repo.breakToDto(created);
}

export async function endBreak(ctx: CommandContext, input: EndBreakInput): Promise<BreakDto> {
  const employeeId = actorIdOf(ctx);
  await repo.lockEmployeeAttendance(ctx.tx, employeeId);
  const active = await repo.activeBreakOfEmployee(ctx.tx, employeeId, true);
  if (!active) {
    throw stateConflict('There is no active break to end', { reason: 'NO_ACTIVE_BREAK' });
  }

  const now = clock.now();
  const ended = await repo.endBreak(ctx.tx, active.id, now, input.notes, false);
  if (!ended) {
    throw stateConflict('There is no active break to end', { reason: 'NO_ACTIVE_BREAK' });
  }

  const policy = await breakPolicy(ctx.tx);
  const sessionBreaks = await repo.listBreaksForSession(ctx.tx, active.session_id);
  const totalBreakSeconds = breakTotals(sessionBreaks, now);
  const isExcessive = totalBreakSeconds > policy.allowanceSeconds;

  await audit(ctx, {
    eventName: 'attendance.break.ended',
    entityType: 'attendance_session',
    entityId: active.session_id,
    before: { breakId: active.id, state: 'active' },
    after: { breakId: active.id, state: 'ended', durationSeconds: ended.duration_seconds },
    payload: {
      breakId: active.id,
      durationSeconds: ended.duration_seconds,
      totalBreakSeconds,
      isExcessive,
      endedAt: now.toISOString(),
    },
    securityEvent: false,
    sourceWorkflow: 'WF-ATT-002',
  });

  if (isExcessive) {
    await audit(ctx, {
      eventName: 'attendance.excessive_break_detected',
      entityType: 'attendance_session',
      entityId: active.session_id,
      payload: { employeeId, totalBreakSeconds, allowanceSeconds: policy.allowanceSeconds },
      securityEvent: false,
      sourceWorkflow: 'WF-ATT-002',
    });
  }

  return repo.breakToDto(ended);
}

/** GET /api/attendance/breaks/active — the caller's own open session (read-only, no transaction). */
export async function getActiveBreak(db: Queryable, principal: Principal): Promise<ActiveBreakDto> {
  const policy = await breakPolicy(db);
  const open = await repo.openSessionOf(db, principal.employeeId);
  if (!open) {
    return {
      activeBreak: null,
      totalBreakSecondsToday: 0,
      remainingBreakAllowanceSeconds: policy.allowanceSeconds,
      isExcessive: false,
      breaks: [],
    };
  }

  const active = await repo.activeBreakOfSession(db, open.id);
  const breaks = await repo.listBreaksForSession(db, open.id);
  const totalBreakSecondsToday = breakTotals(breaks, clock.now());
  return {
    activeBreak: active ? repo.breakToDto(active) : null,
    totalBreakSecondsToday,
    remainingBreakAllowanceSeconds: Math.max(0, policy.allowanceSeconds - totalBreakSecondsToday),
    isExcessive: totalBreakSecondsToday > policy.allowanceSeconds,
    breaks: breaks.map(repo.breakToDto),
  };
}

/** GET /api/attendance/sessions/:id/breaks — own session or Owner, via the access engine (A-16). */
export async function listSessionBreaks(db: Queryable, principal: Principal, sessionId: string): Promise<BreakDto[]> {
  const decision = await access.check(db, principal, A.read, { type: 'attendance_session', id: sessionId });
  if (!decision.allowed) throw notFound(); // IDOR: another employee's session is "not found"
  const session = await repo.sessionById(db, sessionId);
  if (!session) throw notFound();
  const breaks = await repo.listBreaksForSession(db, sessionId);
  return breaks.map(repo.breakToDto);
}

// ---------------------------------------------------------------------------
// Approved employee days off (D1): Owner create / list / cancel, audited. They suppress the J-04
// missing check-in alert and show as non-working for that employee in My Day and the overview.
// ---------------------------------------------------------------------------

function dayOffDto(r: repo.DayOffRow): DayOffDto {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    startDate: r.start_date,
    endDate: r.end_date,
    reason: r.reason,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: iso(r.created_at)!,
    cancelledAt: iso(r.cancelled_at),
    cancelledBy: r.cancelled_by,
    cancelReason: r.cancel_reason,
    version: r.version,
  };
}

/** POST /days-off (Owner). Overlapping active days off of the same employee are refused (422). */
export async function createDayOff(ctx: CommandContext, input: CreateDayOffInput): Promise<DayOffDto> {
  const emp = await repo.employeeExists(ctx.tx, input.employeeId);
  if (!emp) throw notFound();
  await repo.lockEmployeeAttendance(ctx.tx, input.employeeId);
  const endDate = input.endDate ?? input.startDate;
  const clash = await repo.overlappingDaysOff(ctx.tx, input.employeeId, input.startDate, endDate);
  if (clash.length > 0) throw ruleViolation('These dates overlap another approved day off', { reason: 'OVERLAP', dayOffIds: clash });
  const id = await repo.insertDayOff(ctx.tx, {
    employeeId: input.employeeId,
    startDate: input.startDate,
    endDate,
    reason: input.reason,
    createdBy: actorIdOf(ctx),
  });
  await audit(ctx, {
    eventName: 'attendance.day_off_created', // placeholder name (D1), needs approval (G2)
    entityType: 'attendance_day_off',
    entityId: id,
    after: { employeeId: input.employeeId, startDate: input.startDate, endDate },
    reason: input.reason,
    sourceWorkflow: 'WF-ADMIN-001',
  });
  return dayOffDto((await repo.dayOffById(ctx.tx, id))!);
}

/** POST /days-off/:id/cancel (Owner, reason required). Additive: the row stays with cancelled_* set. */
export async function cancelDayOff(ctx: CommandContext, id: string, input: { version: number; reason: string }): Promise<DayOffDto> {
  const d = await repo.dayOffById(ctx.tx, id, true);
  if (!d) throw notFound();
  if (d.cancelled_at) return dayOffDto(d); // repeat = no-op (§4.5)
  if (d.version !== input.version) throw versionConflict(d.version, dayOffDto(d)); // BL-09
  const ok = await repo.cancelDayOff(ctx.tx, id, input.version, { cancelledBy: actorIdOf(ctx), cancelledAt: clock.now(), reason: input.reason });
  if (!ok) throw versionConflict();
  await audit(ctx, {
    eventName: 'attendance.day_off_cancelled', // placeholder name (D1), needs approval (G2)
    entityType: 'attendance_day_off',
    entityId: id,
    before: { cancelled: false, version: d.version },
    after: { cancelled: true, version: d.version + 1 },
    reason: input.reason,
    sourceWorkflow: 'WF-ADMIN-001',
  });
  return dayOffDto((await repo.dayOffById(ctx.tx, id))!);
}

/** GET /days-off (Owner). Active only unless `includeCancelled=true`. */
export async function listDaysOff(db: Queryable, q: DaysOffQuery) {
  const { rows, total } = await repo.listDaysOff(
    db,
    { employeeId: q.employeeId, from: q.from, to: q.to, includeCancelled: q.includeCancelled },
    q
  );
  return { ...toPage(rows.map(dayOffDto), total, q), label: DEMO_LABEL };
}
