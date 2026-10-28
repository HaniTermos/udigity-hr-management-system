/**
 * attendance API — backend MOD-attendance (BE1), contract BE1-C2 (backend `modules/attendance/schemas.ts` is the
 * source of truth). Owner: FE1. Screens: SCR-SHR-001..005. The Owner screens (OWN-004/005) use
 * `attendanceOwner.ts` (FE2) against the same module.
 *
 * Times are ISO UTC; dates are company-local `YYYY-MM-DD`. The server clock is the only clock: the client never
 * sends "now". Every policy value is a "Demonstration alternative — not approved" (docs/policy-defaults.md) and
 * the screens label it so.
 */
import { api, newIdempotencyKey } from './client';
import type { Id, IsoDate, IsoDateTime, Page } from './types';

export const attendancePaths = {
  today: '/api/attendance/me/today',
  checkIn: '/api/attendance/check-in',
  checkOut: '/api/attendance/check-out',
  mySessions: '/api/attendance/me/sessions',
  corrections: '/api/attendance/corrections',
  correction: (id: string) => `/api/attendance/corrections/${id}`,
  withdrawCorrection: (id: string) => `/api/attendance/corrections/${id}/withdraw`,
  remoteRequests: '/api/attendance/remote-exceptions/requests',
  overview: '/api/attendance/overview',
  settings: '/api/attendance/settings',
  remoteExceptions: '/api/attendance/remote-exceptions',
  startBreak: '/api/attendance/breaks/start',
  endBreak: '/api/attendance/breaks/end',
  activeBreak: '/api/attendance/breaks/active',
  sessionBreaks: (id: string) => `/api/attendance/sessions/${id}/breaks`,
} as const;

/* ------------------------------------------------------------------ DTOs (BE1-C2) */

export type SessionState = 'open' | 'closed' | 'closed_provisional' | 'pending_review';
/** Derived from schedule + grace (DEC-007/008/022): never typed in by anyone. */
export type Punctuality = 'on_time' | 'late' | 'unclassified' | 'non_working_day';
/** Verification result. Shown as "Recorded · mode …", never "Passed" (AC-ATT-015). */
export type VerificationResult = 'passed' | 'failed' | 'remote' | 'disabled' | 'not_configured' | 'retroactive';
export type VerificationMode = 'none' | 'ip' | 'location' | 'either' | 'both' | string;

export interface VerificationDto {
  result: VerificationResult;
  mode: VerificationMode | null;
}

export interface AttendanceSessionDto {
  id: Id;
  employeeId: Id;
  employeeName: string;
  workDate: IsoDate;
  state: SessionState;
  origin: 'check_in' | 'retroactive';
  /** Originals: never overwritten by a correction. */
  checkInAt: IsoDateTime;
  checkOutAt: IsoDateTime | null;
  /** What counts after corrections. Show these; show the originals as "was …" when `adjusted`. */
  effectiveCheckInAt: IsoDateTime;
  effectiveCheckOutAt: IsoDateTime | null;
  checkOutUnknown: boolean;
  checkoutAttemptedAt: IsoDateTime | null;
  adjusted: boolean;
  remote: boolean;
  punctuality: Punctuality;
  lateMinutes: number;
  durationMinutes: number | null;
  requiredMinutes: number;
  durationStatus: 'met' | 'short' | 'open' | 'unknown';
  verification: { checkIn: VerificationDto; checkOut: VerificationDto | null };
  checkoutFailureReason: string | null;
  summary: { workCompleted: string | null; outstandingTasks: string | null; blockers: string | null; notes: string | null } | null;
  /** J-04: still open past the flag hours. It is never closed automatically. */
  missingCheckout: boolean;
  reviewPending: boolean;
  pendingCorrectionId: Id | null;
  settingsVersion: number | null;
  version: number;
}

export type CorrectionStatus = 'submitted' | 'approved' | 'rejected' | 'withdrawn' | 'applied';

export interface AttendanceCorrectionDto {
  id: Id;
  sessionId: Id | null;
  employeeId: Id;
  employeeName: string;
  kind: 'request' | 'direct' | 'retroactive';
  status: CorrectionStatus;
  proposedCheckInAt: IsoDateTime | null;
  proposedCheckOutAt: IsoDateTime | null;
  proposedCheckOutUnknown?: boolean;
  previousCheckInAt: IsoDateTime | null;
  previousCheckOutAt: IsoDateTime | null;
  reason: string;
  closedSessionProvisionally: boolean;
  createdBy: Id;
  decidedBy: Id | null;
  decidedByName?: string | null;
  decidedAt: IsoDateTime | null;
  decisionReason: string | null;
  createdAt: IsoDateTime;
  version: number;
}

/** `GET /me/today`. `schedule` and `officeCheck` are inactive until the Owner configures them (`configured:false`). */
export interface AttendanceTodayDto {
  now: IsoDateTime;
  date: IsoDate;
  configured: boolean;
  missing: string[];
  workingDay: boolean;
  nonWorkingReason: 'weekend' | 'holiday' | null;
  schedule: { timezone: string | null; workingDays: string[]; shiftStart: string | null; shiftEnd: string | null; graceMinutes: number | null };
  requiredMinutes: number;
  officeCheck: { mode: VerificationMode | null; active: boolean };
  remoteExceptionToday: boolean;
  session: AttendanceSessionDto | null;
  openSessionFromEarlierDay: AttendanceSessionDto | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  summaryRule: { required: boolean; minLength: number };
  employeeRequestsEnabled: boolean;
  remoteSelfRequestEnabled: boolean;
  failedCheckout: string;
  pendingCorrections: number;
  label?: string;
}

export type CheckOutOutcome = 'closed' | 'closed_provisional' | 'pending_review';

export interface CheckInResult {
  session: AttendanceSessionDto;
  outcome: 'checked_in';
}

export interface CheckOutInput {
  version?: number;
  summary: { workCompleted: string; outstandingTasks?: string; blockers?: string; notes?: string };
}

export interface CheckOutResult {
  session: AttendanceSessionDto;
  outcome: CheckOutOutcome;
}

export interface MySessionsQuery {
  from?: IsoDate;
  to?: IsoDate;
  page?: number;
  pageSize?: number;
}

export interface MySessionsSummary {
  sessions: number;
  onTime: number;
  late: number;
  unclassified: number;
  nonWorkingDay: number;
  totalMinutes: number;
  closedSessions: number;
  averageMinutes: number | null;
  adjusted: number;
  missingCheckout: number;
  reviewPending: number;
}

export interface MySessionsDto extends Page<AttendanceSessionDto> {
  summary: MySessionsSummary;
}

export interface CorrectionInput {
  sessionId?: Id;
  proposedCheckInAt?: IsoDateTime;
  proposedCheckOutAt?: IsoDateTime;
  reason: string;
}

export interface CorrectionsQuery {
  status?: CorrectionStatus;
  page?: number;
  pageSize?: number;
}

export interface RemoteRequestInput {
  startDate: IsoDate;
  endDate?: IsoDate;
  reason: string;
}

/** The three settings flags the employee screens show (`GET /settings`, any role). Values are demonstration defaults. */
export interface AttendanceFlagsDto {
  flags: { employeeRequests: boolean; remoteSelfRequest: boolean; failedCheckout: string };
  label?: string;
}

/* ------------------------------------------------------------------ error codes (BE1-C2) */

/** `details.reason` values on 409 `STATE_CONFLICT` / 422 `RULE_VIOLATION`. */
export const ATTENDANCE_REASONS = {
  officeCheckFailed: 'OFFICE_CHECK_FAILED',
  openSession: 'OPEN_SESSION',
  noOpenSession: 'NO_OPEN_SESSION',
  checkoutBeforeCheckin: 'CHECKOUT_BEFORE_CHECKIN',
  inFuture: 'IN_FUTURE',
  overlap: 'OVERLAP',
  policyNotConfigured: 'POLICY_NOT_CONFIGURED',
} as const;

/** Read `details.reason` (or the code itself, which BE1 may also use) from an API error. */
export function attendanceReason(err: { code: string; details?: unknown }): string | null {
  const d = err.details;
  if (d && typeof d === 'object' && 'reason' in d && typeof (d as { reason: unknown }).reason === 'string') {
    return (d as { reason: string }).reason;
  }
  return typeof err.code === 'string' ? err.code : null;
}

/* ------------------------------------------------------------------ functions */

export async function getToday(): Promise<AttendanceTodayDto> {
  return api.get<AttendanceTodayDto>(attendancePaths.today);
}

export async function checkIn(idempotencyKey: string = newIdempotencyKey()): Promise<CheckInResult> {
  return api.post<CheckInResult>(attendancePaths.checkIn, {}, { idempotencyKey });
}

export async function checkOut(input: CheckOutInput, idempotencyKey: string = newIdempotencyKey()): Promise<CheckOutResult> {
  return api.post<CheckOutResult>(attendancePaths.checkOut, input, { idempotencyKey });
}

export async function getMySessions(q: MySessionsQuery = {}): Promise<MySessionsDto> {
  return api.get<MySessionsDto>(attendancePaths.mySessions, { query: { ...q } });
}

/** Own correction requests (the Owner would see all; this screen is the employee's). */
export async function getMyCorrections(q: CorrectionsQuery = {}): Promise<Page<AttendanceCorrectionDto>> {
  return api.get<Page<AttendanceCorrectionDto>>(attendancePaths.corrections, { query: { ...q } });
}

export async function submitCorrection(
  input: CorrectionInput,
  idempotencyKey: string = newIdempotencyKey()
): Promise<AttendanceCorrectionDto> {
  return api.post<AttendanceCorrectionDto>(attendancePaths.corrections, input, { idempotencyKey });
}

export async function withdrawCorrection(c: Pick<AttendanceCorrectionDto, 'id' | 'version'>): Promise<AttendanceCorrectionDto> {
  return api.post<AttendanceCorrectionDto>(attendancePaths.withdrawCorrection(c.id), { version: c.version });
}

/** DEC-010: only when `remoteSelfRequestEnabled`; the Owner decides. */
export async function requestRemoteException(input: RemoteRequestInput, idempotencyKey: string = newIdempotencyKey()): Promise<void> {
  await api.post(attendancePaths.remoteRequests, input, { idempotencyKey });
}

export async function getAttendanceFlags(): Promise<AttendanceFlagsDto> {
  return api.get<AttendanceFlagsDto>(attendancePaths.settings);
}

/* ------------------------------------------------------------------ breaks (Wave 2) */

export interface BreakDto {
  id: string;
  sessionId: string;
  employeeId: string;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  durationSeconds: number | null;
  breakType: 'paid' | 'unpaid';
  notes: string | null;
  autoClosed: boolean;
  createdAt: IsoDateTime;
}

export interface ActiveBreakDto {
  activeBreak: BreakDto | null;
  totalBreakSecondsToday: number;
  remainingBreakAllowanceSeconds: number;
  isExcessive: boolean;
  breaks: BreakDto[];
}

export async function getActiveBreak(): Promise<ActiveBreakDto> {
  return api.get<ActiveBreakDto>(attendancePaths.activeBreak);
}

export async function startBreak(
  input: { breakType?: 'paid' | 'unpaid'; notes?: string } = {},
  idempotencyKey: string = newIdempotencyKey()
): Promise<{ break: BreakDto }> {
  return api.post<{ break: BreakDto }>(attendancePaths.startBreak, input, { idempotencyKey });
}

export async function endBreak(
  input: { notes?: string } = {},
  idempotencyKey: string = newIdempotencyKey()
): Promise<{ break: BreakDto }> {
  return api.post<{ break: BreakDto }>(attendancePaths.endBreak, input, { idempotencyKey });
}

export async function getSessionBreaks(sessionId: string): Promise<{ breaks: BreakDto[] }> {
  return api.get<{ breaks: BreakDto[] }>(attendancePaths.sessionBreaks(sessionId));
}

