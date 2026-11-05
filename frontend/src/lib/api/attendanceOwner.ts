/**
 * Owner attendance API (SCR-OWN-004 monitoring, SCR-OWN-005 corrections review). Owner: FE2.
 * Endpoints are the plan §4.1 catalogue: GET /attendance/overview, GET /attendance/corrections,
 * POST /attendance/corrections/:id/approve|reject, POST /attendance/sessions/:id/adjust.
 *
 * Aligned with BE1-C2 (backend `modules/attendance/schemas.ts` is the source of truth). Separate from FE1's
 * `attendance.ts` on purpose; the session shape is shared.
 */
import { api, newIdempotencyKey } from './client';
import { attendancePaths } from './attendance';
import type { AttendanceSessionDto, Punctuality } from './attendance';
import type { IsoDate, IsoDateTime, Page, PageQuery, Role } from './types';

export const ownerAttendancePaths = {
  overview: attendancePaths.overview,
  corrections: attendancePaths.corrections,
  approve: (id: string) => `${attendancePaths.correction(id)}/approve`,
  reject: (id: string) => `${attendancePaths.correction(id)}/reject`,
  adjust: (sessionId: string) => `/api/attendance/sessions/${sessionId}/adjust`,
} as const;

/* ---------------- OWN-004 monitoring ---------------- */
export type MonitorStatus = 'checked_in' | 'checked_out' | 'open_previous' | 'not_checked_in';
export type VerificationState = 'recorded' | 'remote' | 'blocked' | 'none';

export interface MonitorRow {
  employeeId: string;
  employeeName: string;
  role: Role;
  status: MonitorStatus;
  /** Start of the still-open session when `status` is `open_previous`. */
  openSince: IsoDateTime | null;
  checkInAt: IsoDateTime | null;
  checkOutAt: IsoDateTime | null;
  verification: VerificationState;
  punctuality: Punctuality | null;
  missingCheckout: boolean;
  missingCheckin: boolean;
  reviewPending: boolean;
  pendingCorrections: number;
  remoteExceptionToday: boolean;
  employee: { id: string; fullName: string; role: Role };
  session: AttendanceSessionDto | null;
}

export type ExceptionKind = 'missing_checkout' | 'checkin_alerts_off';

export interface AttendanceException {
  id: string;
  kind: ExceptionKind;
  title: string;
  detail: string;
  employeeId: string | null;
  occurredAt: IsoDateTime | null;
}

export interface MonitorSummary {
  expected: number | null;
  checkedIn: number;
  checkedOut: number;
  /** `null` while the schedule is not configured (nobody can be "absent"). */
  notCheckedIn: number | null;
  missingCheckout: number;
  /** `null` = not configured, never 0. */
  lateArrivals: number | null;
  firstCheckIn: IsoDateTime | null;
  lastCheckIn: IsoDateTime | null;
}

export interface AttendanceOverview {
  date: IsoDate;
  asOf: IsoDateTime;
  configured: boolean;
  missing: string[];
  /** Timezone, working days, shift start and grace all saved. */
  scheduleConfigured: boolean;
  workingDay: boolean;
  nonWorkingReason: 'weekend' | 'holiday' | null;
  counts: {
    employees: number;
    checkedIn: number;
    checkedOut: number;
    notCheckedIn: number | null;
    late: number | null;
    remote: number;
    missingCheckout: number;
    missingCheckin: number;
    reviewItems: number;
    pendingCorrections: number;
  };
  summary: MonitorSummary;
  rows: MonitorRow[];
  reviewItems: AttendanceSessionDto[];
  openFromEarlierDays: AttendanceSessionDto[];
  label?: string;
  exceptions: AttendanceException[];
}

export interface OverviewQuery {
  date?: IsoDate;
  employeeId?: string;
}

export function overviewKey(q: OverviewQuery): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${ownerAttendancePaths.overview}?${s}` : ownerAttendancePaths.overview;
}

export async function getAttendanceOverview(q: OverviewQuery = {}): Promise<AttendanceOverview> {
  return api.get<AttendanceOverview>(ownerAttendancePaths.overview, { query: { ...q } });
}

/* ---------------- OWN-005 corrections ---------------- */
export type ReviewKind = 'missing_checkout' | 'employee_request' | 'corrected';

export interface ReviewItem {
  /** Correction request id (employee_request) or session id (missing_checkout / corrected). */
  id: string;
  kind: ReviewKind;
  sessionId: string;
  /** Concurrency token of the row the action targets. */
  version: number;
  employeeId: string;
  employeeName: string;
  role: Role;
  sessionDate: IsoDate;
  checkInAt: IsoDateTime;
  checkOutAt: IsoDateTime | null;
  verification: VerificationState;
  /** An open session blocks the employee's next check-in. */
  blocksCheckIn: boolean;
  sessionState: AttendanceSessionDto['state'];
  /** employee_request only. */
  proposedCheckInAt?: IsoDateTime | null;
  proposedCheckOutAt?: IsoDateTime | null;
  employeeReason?: string | null;
  requestedAt?: IsoDateTime | null;
  /** corrected only. */
  correctedAt?: IsoDateTime | null;
  correctedBy?: string | null;
  correctionReason?: string | null;
}

/** DEC-026 preview rows (not counted, shown only as a preview of the flagged alternatives). */
export interface ReviewPreview {
  id: string;
  title: string;
  detail: string;
  flagLabel: string;
}

export interface ReviewQueueResponse extends Page<ReviewItem> {
  counts: { review: number; requests: number; corrected: number };
  previews: ReviewPreview[];
}

export interface CorrectionQuery extends PageQuery {
  kind: ReviewKind;
}

export function correctionsKey(q: CorrectionQuery): string {
  return `${ownerAttendancePaths.corrections}?kind=${q.kind}&page=${q.page ?? 1}&pageSize=${q.pageSize ?? 50}`;
}

export async function listReviewItems(q: CorrectionQuery): Promise<ReviewQueueResponse> {
  return api.get<ReviewQueueResponse>(ownerAttendancePaths.corrections, { query: { ...q } });
}

/** DEC-011 Alt A reading: the Owner enters the corrected time and a reason. */
export async function adjustSession(item: ReviewItem, input: { checkOutAt: IsoDateTime; reason: string }): Promise<void> {
  await api.post(ownerAttendancePaths.adjust(item.sessionId), { version: item.version, ...input }, { idempotencyKey: newIdempotencyKey() });
}

/** DEC-011 Alt B reading: approve or reject the employee's request. */
export async function approveRequest(item: ReviewItem): Promise<void> {
  await api.post(ownerAttendancePaths.approve(item.id), { version: item.version }, { idempotencyKey: newIdempotencyKey() });
}

export async function rejectRequest(item: ReviewItem, reason: string): Promise<void> {
  await api.post(ownerAttendancePaths.reject(item.id), { version: item.version, reason }, { idempotencyKey: newIdempotencyKey() });
}
