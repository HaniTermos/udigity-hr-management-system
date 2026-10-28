/**
 * MOD-attendance — Zod request schemas (.strict()), DTO types and VT-3 action declarations. Owner: BE1.
 * Contract: board post BE1-C2 (docs/implementation/coordination.md). Every policy value is a
 * Demonstration alternative — not approved (docs/policy-defaults.md).
 */
import { z } from 'zod';
import { defineActions, type Action, type ActionPolicy } from '../../shared/access.js';
import { PageQuerySchema } from '../../shared/pagination.js';
import { defineMatrixActions } from '../access/schemas.js';
import type { Role } from '../../middleware/auth.js';
import { VERIFICATION_MODES, WEEKDAYS, isValidDate, type Punctuality, type VerificationMode } from './time.js';

/** authz-matrix §3.3, declared FROM the matrix so roles cannot drift. */
export const ATTENDANCE_ACTIONS = defineMatrixActions([
  'attendance.check_in',
  'attendance.check_out',
  'attendance.read',
  'attendance.correction.request',
  'attendance.correction.review',
  'attendance.adjust',
  'attendance.retroactive_create',
  'attendance.remote_exception.grant',
  'attendance.failed_checkout.review',
  'attendance.break.start',
  'attendance.break.end',
  'attendance.break.read',
] as const);

/**
 * Not in the matrix yet (Security Lead adds the rows; `verifyDeclaredActions` reports them):
 * - `attendance.overview.read`: OWN-004 monitoring (Owner + 2FA). FE2 nav uses this name.
 * - `attendance.remote_exception.request`: DEC-010 self request; the flag
 *   `attendance.remoteSelfRequest` (default false) gates it in the service.
 */
export const ATTENDANCE_EXTRA_ACTIONS = defineActions({
  ['attendance.overview.read' as Action]: {
    roles: ['owner'],
    admin: true,
    description: 'OWN-004 attendance monitoring (Owner all)',
  } satisfies ActionPolicy,
  ['attendance.remote_exception.request' as Action]: {
    roles: ['owner', 'data_entry', 'call_center', 'developer'],
    description: 'Own remote-exception request; DEMO DEC-010 flag attendance.remoteSelfRequest',
  } satisfies ActionPolicy,
});

/** Route helper (matrix names do not fit the `Action` template; BE2-R1). */
export const A = {
  checkIn: 'attendance.check_in' as Action,
  checkOut: 'attendance.check_out' as Action,
  read: 'attendance.read' as Action,
  breakStart: 'attendance.break.start' as Action,
  breakEnd: 'attendance.break.end' as Action,
  breakRead: 'attendance.break.read' as Action,
  correctionRequest: 'attendance.correction.request' as Action,
  correctionReview: 'attendance.correction.review' as Action,
  adjust: 'attendance.adjust' as Action,
  retroactive: 'attendance.retroactive_create' as Action,
  remoteGrant: 'attendance.remote_exception.grant' as Action,
  remoteRequest: 'attendance.remote_exception.request' as Action,
  failedCheckoutReview: 'attendance.failed_checkout.review' as Action,
  overview: 'attendance.overview.read' as Action,
  settingsRead: 'settings.read' as Action,
  settingsUpdate: 'settings.update' as Action,
} as const;

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const isoInstant = z.string().datetime({ offset: true });
const localDate = z.string().refine(isValidDate, 'Must be a date YYYY-MM-DD');
const reasonText = z.string().trim().min(1, 'Reason is required').max(1000);
const optText = (max: number) => z.string().trim().max(max).optional();

export const IdParamSchema = z.object({ id: z.string().uuid() }).strict();

export const CheckInSchema = z.object({}).strict();

export const CheckOutSchema = z
  .object({
    version: z.number().int().positive().optional(),
    summary: z
      .object({
        workCompleted: z.string().trim().max(4000).default(''),
        outstandingTasks: optText(4000),
        blockers: optText(4000),
        notes: optText(4000),
      })
      .strict()
      .prefault({}), // zod 4: parse the default so workCompleted gets its own default
  })
  .strict();
export type CheckOutInput = z.infer<typeof CheckOutSchema>;

const RangeQuery = {
  from: localDate.optional(),
  to: localDate.optional(),
};

export const MySessionsQuerySchema = PageQuerySchema.extend(RangeQuery).strict();
export type MySessionsQuery = z.infer<typeof MySessionsQuerySchema>;

export const SESSION_STATES = ['open', 'closed', 'closed_provisional', 'pending_review'] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const SessionsQuerySchema = PageQuerySchema.extend({
  ...RangeQuery,
  employeeId: z.string().uuid().optional(),
  state: z.enum(SESSION_STATES).optional(),
}).strict();
export type SessionsQuery = z.infer<typeof SessionsQuerySchema>;

export const CorrectionRequestSchema = z
  .object({
    sessionId: z.string().uuid().optional(),
    proposedCheckInAt: isoInstant.optional(),
    proposedCheckOutAt: isoInstant.optional(),
    reason: reasonText,
  })
  .strict()
  .refine((b) => b.proposedCheckInAt !== undefined || b.proposedCheckOutAt !== undefined, {
    message: 'Propose a check-in or a checkout time',
    path: ['proposedCheckOutAt'],
  })
  .refine((b) => b.sessionId !== undefined || (b.proposedCheckInAt !== undefined && b.proposedCheckOutAt !== undefined), {
    message: 'A missing session needs both times',
    path: ['proposedCheckInAt'],
  });
export type CorrectionRequestInput = z.infer<typeof CorrectionRequestSchema>;

export const CORRECTION_STATUSES = ['submitted', 'approved', 'rejected', 'withdrawn', 'applied'] as const;
export const REVIEW_KINDS = ['missing_checkout', 'employee_request', 'corrected'] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const CorrectionsQuerySchema = PageQuerySchema.extend({
  status: z.enum(CORRECTION_STATUSES).optional(),
  employeeId: z.string().uuid().optional(),
  /** FE2 OWN-005 review-queue mode (Owner only): returns ReviewQueueResponse instead of CorrectionDto rows. */
  kind: z.enum(REVIEW_KINDS).optional(),
}).strict();
export type CorrectionsQuery = z.infer<typeof CorrectionsQuerySchema>;

export const VersionReasonSchema = z
  .object({ version: z.number().int().positive(), reason: z.string().trim().max(1000).optional() })
  .strict();

export const RejectCorrectionSchema = z
  .object({
    version: z.number().int().positive(),
    reason: reasonText,
    /** F-01: when the request closed an open session, the effective checkout to keep (null = unknown). */
    effectiveCheckOutAt: isoInstant.nullable().optional(),
  })
  .strict();

export const WithdrawSchema = z.object({ version: z.number().int().positive() }).strict();

export const AdjustSchema = z
  .object({
    version: z.number().int().positive(),
    checkInAt: isoInstant.optional(),
    checkOutAt: isoInstant.optional(),
    checkOutUnknown: z.boolean().optional(),
    reason: reasonText,
  })
  .strict()
  .refine((b) => b.checkInAt !== undefined || b.checkOutAt !== undefined || b.checkOutUnknown === true, {
    message: 'Nothing to change',
    path: ['checkOutAt'],
  })
  .refine((b) => !(b.checkOutAt !== undefined && b.checkOutUnknown === true), {
    message: 'Give a checkout time or mark it unknown, not both',
    path: ['checkOutUnknown'],
  });
export type AdjustInput = z.infer<typeof AdjustSchema>;

export const ResolveReviewSchema = z
  .object({
    version: z.number().int().positive(),
    checkOutAt: isoInstant.optional(),
    checkOutUnknown: z.boolean().optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((b) => !(b.checkOutAt !== undefined && b.checkOutUnknown === true), {
    message: 'Give a checkout time or mark it unknown, not both',
    path: ['checkOutUnknown'],
  });
export type ResolveReviewInput = z.infer<typeof ResolveReviewSchema>;

export const RetroactiveSchema = z
  .object({
    employeeId: z.string().uuid(),
    checkInAt: isoInstant,
    checkOutAt: isoInstant,
    reason: reasonText,
  })
  .strict();
export type RetroactiveInput = z.infer<typeof RetroactiveSchema>;

export const OverviewQuerySchema = z
  .object({ date: localDate.optional(), employeeId: z.string().uuid().optional() })
  .strict();
export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM (24 h)');

/**
 * FX-BE-C2: weekday ids are accepted in any case and as full names ("mon", "Monday", "MON") and are
 * stored uppercase. Every field except `version` is optional: an omitted field keeps the value of the
 * current version, so a form that edits only some fields never wipes the others (holidays, summary
 * policy, missing-checkout hours, office IPs).
 */
const weekday = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().slice(0, 3).toUpperCase() : v),
  z.enum(WEEKDAYS)
);
export const PutSettingsSchema = z
  .object({
    /** The current versionNo the client saw (0 when no version has been saved yet). */
    version: z.number().int().min(0),
    timezone: z.string().trim().min(1).max(64).optional(),
    workingDays: z.array(weekday).min(1).max(7).optional(),
    shiftStart: hhmm.optional(),
    shiftEnd: hhmm.optional(),
    graceMinutes: z.number().int().min(0).max(240).optional(),
    verificationMode: z.enum(VERIFICATION_MODES).optional(),
    officeIps: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    holidays: z.array(localDate).max(400).optional(),
    summaryRequired: z.boolean().optional(),
    summaryMinLength: z.number().int().min(0).max(2000).optional(),
    missingCheckoutFlagHours: z.number().int().min(0).max(72).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
export type PutSettingsInput = z.infer<typeof PutSettingsSchema>;

export const TestOfficeCheckSchema = z
  .object({ officeIps: z.array(z.string().trim().min(1).max(64)).max(50).optional() })
  .strict();

export const REMOTE_STATUSES = ['requested', 'granted', 'rejected', 'revoked'] as const;
export type RemoteStatus = (typeof REMOTE_STATUSES)[number];

const remoteBase = {
  startDate: localDate,
  endDate: localDate.optional(),
  reason: reasonText,
};
const rangeOk = (b: { startDate: string; endDate?: string }) => !b.endDate || b.endDate >= b.startDate;

export const GrantRemoteSchema = z
  .object({ employeeId: z.string().uuid(), ...remoteBase })
  .strict()
  .refine(rangeOk, { message: 'End date is before start date', path: ['endDate'] });
export const RequestRemoteSchema = z
  .object(remoteBase)
  .strict()
  .refine(rangeOk, { message: 'End date is before start date', path: ['endDate'] });
export const RemoteDecisionSchema = VersionReasonSchema;
export const RemoteQuerySchema = PageQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  status: z.enum(REMOTE_STATUSES).optional(),
}).strict();
export type RemoteQuery = z.infer<typeof RemoteQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs (BE1-C2). Times ISO UTC; dates company-local YYYY-MM-DD. No IP address is ever returned.
// ---------------------------------------------------------------------------

export type VerificationResult = 'passed' | 'failed' | 'remote' | 'disabled' | 'not_configured' | 'retroactive';

export interface VerificationDto {
  result: VerificationResult;
  mode: VerificationMode | null;
}

export interface SessionDto {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  state: SessionState;
  origin: 'check_in' | 'retroactive';
  checkInAt: string;
  checkOutAt: string | null;
  effectiveCheckInAt: string;
  effectiveCheckOutAt: string | null;
  checkOutUnknown: boolean;
  checkoutAttemptedAt: string | null;
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
  missingCheckout: boolean;
  reviewPending: boolean;
  pendingCorrectionId: string | null;
  settingsVersion: number | null;
  version: number;
}

export interface CorrectionDto {
  id: string;
  sessionId: string | null;
  employeeId: string;
  employeeName: string;
  kind: 'request' | 'direct' | 'retroactive';
  status: (typeof CORRECTION_STATUSES)[number];
  proposedCheckInAt: string | null;
  proposedCheckOutAt: string | null;
  proposedCheckOutUnknown: boolean;
  previousCheckInAt: string | null;
  previousCheckOutAt: string | null;
  reason: string;
  closedSessionProvisionally: boolean;
  createdBy: string;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  version: number;
}

export interface RemoteExceptionDto {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: RemoteStatus;
  reason: string;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  version: number;
}

export interface SettingsVersionDto {
  versionNo: number | null;
  timezone: string;
  workingDays: string[];
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  verificationMode: VerificationMode;
  officeIps?: string[];
  holidays?: string[];
  summaryRequired: boolean;
  summaryMinLength: number;
  missingCheckoutFlagHours: number;
  reason?: string | null;
  createdAt: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  source: 'version' | 'env';
}

/** OWN-004 row. Flat FE2 fields (`attendanceOwner.ts` MonitorRow) plus the BE1-C2 nested ones. */
export type MonitorStatus = 'checked_in' | 'checked_out' | 'open_previous' | 'not_checked_in';
export type MonitorVerification = 'recorded' | 'verified' | 'remote' | 'blocked' | 'none';

export interface OverviewRowDto {
  employeeId: string;
  employeeName: string;
  role: Role;
  status: MonitorStatus;
  openSince: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  verification: MonitorVerification;
  punctuality: Punctuality | null;
  missingCheckout: boolean;
  missingCheckin: boolean;
  reviewPending: boolean;
  pendingCorrections: number;
  remoteExceptionToday: boolean;
  employee: { id: string; fullName: string; role: Role };
  session: SessionDto | null;
}

/** OWN-005 review queue (FE2 `ReviewItem`). */
export interface ReviewItemDto {
  id: string;
  kind: ReviewKind;
  sessionId: string;
  version: number;
  employeeId: string;
  employeeName: string;
  role: Role;
  sessionDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  verification: MonitorVerification;
  blocksCheckIn: boolean;
  sessionState: SessionState;
  proposedCheckInAt?: string | null;
  proposedCheckOutAt?: string | null;
  employeeReason?: string | null;
  requestedAt?: string | null;
  correctedAt?: string | null;
  correctedBy?: string | null;
  correctionReason?: string | null;
}

// ---------------------------------------------------------------------------
// Breaks (Wave 2)
// ---------------------------------------------------------------------------

export const StartBreakSchema = z
  .object({
    breakType: z.enum(['paid', 'unpaid']).default('unpaid'),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();
export type StartBreakInput = z.infer<typeof StartBreakSchema>;

export const EndBreakSchema = z
  .object({
    notes: z.string().trim().max(500).optional(),
  })
  .strict();
export type EndBreakInput = z.infer<typeof EndBreakSchema>;

export interface BreakDto {
  id: string;
  sessionId: string;
  employeeId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  breakType: 'paid' | 'unpaid';
  notes: string | null;
  autoClosed: boolean;
  createdAt: string;
}

export interface ActiveBreakDto {
  activeBreak: BreakDto | null;
  totalBreakSecondsToday: number;
  remainingBreakAllowanceSeconds: number;
  isExcessive: boolean;
  breaks: BreakDto[];
}
