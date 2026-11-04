/**
 * MOD-admin — Zod request schemas (.strict()) and VT-3 action declarations. Owner: BE1.
 */
import { z } from 'zod';
import { isoDateOrDateTime, safeString } from '../../shared/validation.js';
import { defineActions, type Action, type ActionPolicy } from '../../shared/access.js';
import { defineMatrixActions } from '../access/schemas.js';
import { PageQuerySchema } from '../../shared/pagination.js';

/**
 * authz-matrix §3.9 `settings.read` / `settings.update` and §3.10 `audit.read`: Owner + completed 2FA,
 * declared FROM the matrix so they cannot drift (security review inc2 R3). `/api/settings/flags`
 * is part of `settings.read`.
 */
export const ADMIN_ACTIONS = defineMatrixActions(['settings.read', 'settings.update', 'audit.read'] as const);

/**
 * Derived values every role needs (authz §3.9 note "Non-Owners receive only the derived values they
 * need", e.g. the company timezone for time display). A separate action, so the role split is an
 * access declaration, not a handler branch (R3). Not in the matrix yet: Security Lead adds the row.
 */
export const ADMIN_PUBLIC_ACTIONS = defineActions({
  ['settings.read_public' as Action]: {
    roles: ['owner', 'data_entry', 'call_center', 'developer'],
    description: 'Read derived company values (timezone, configured flags)',
  } satisfies ActionPolicy,
});

/** Route helper: matrix names do not fit the shared `Action` template (BE2-R1), hence the cast. */
export const A = {
  settingsRead: 'settings.read' as Action,
  settingsReadPublic: 'settings.read_public' as Action,
  settingsUpdate: 'settings.update' as Action,
  auditRead: 'audit.read' as Action,
} as const;

const SettingValue = z.union([
  safeString().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.union([safeString().max(200), z.number().finite()])).max(400),
  z.null(), // null = remove the saved value (back to the env default)
]);

const ValuesRecord = z.record(safeString().max(80), SettingValue);

/**
 * PATCH /api/settings. `values` (any editable key), or FE2's split `company` (company.* keys) and
 * `policies` (other SET keys): all three are merged; at least one change is required.
 */
export const PatchSettingsSchema = z
  .object({
    version: z.number().int().positive(),
    values: ValuesRecord.optional(),
    company: ValuesRecord.optional(),
    policies: ValuesRecord.optional(),
    reason: safeString().trim().max(500).optional(),
  })
  .strict()
  .transform((b) => ({ version: b.version, reason: b.reason, values: { ...b.policies, ...b.company, ...b.values } }))
  .refine((b) => Object.keys(b.values).length > 0, { message: 'No changes', path: ['values'] });

export const AuditQuerySchema = PageQuerySchema.extend({
  event: safeString().trim().max(100).regex(/^[a-z0-9_.*]+$/).optional(),
  actorId: safeString().uuid().optional(),
  entityType: safeString().trim().max(100).regex(/^[a-z0-9_]+$/).optional(),
  entityId: safeString().trim().max(255).optional(),
  /** FE2 name for entityId (business, employee or record reference). */
  entityRef: safeString().trim().max(255).optional(),
  /** ISO date-time, or a YYYY-MM-DD date (a company-timezone calendar day: start of that day; UTC when no timezone is configured). */
  from: isoDateOrDateTime().optional(),
  /** Exclusive. A YYYY-MM-DD date means "up to the end of that day". */
  to: isoDateOrDateTime().optional(),
}).strict();

export type AuditQuery = z.infer<typeof AuditQuerySchema>;

export interface AuditEventDto {
  id: string;
  occurredAt: string;
  eventName: string;
  /** True when the event name is a placeholder awaiting approval (G2). */
  placeholderName: boolean;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  entityType: string;
  entityId: string | null;
  sessionId: string | null;
  requestId: string | null;
  clientIp: string | null;
  payload: unknown;
  before: unknown;
  after: unknown;
  reason: string | null;
  sourceWorkflow: string | null;
  createdAt: string;
}

/** Audit names used in code that are not in the architecture catalogue yet (need approval, G2). */
export const PLACEHOLDER_AUDIT_NAMES = new Set([
  'two_factor.enrolled',
  'two_factor.recovery_codes_generated',
  'two_factor.enrollment_token_issued',
  'two_factor.reset_by_operator',
  'account.activated',
  'credential_setup.completed',
  'employee.updated',
  // Work items (R2-03, BE-LEAD): no catalogue name yet.
  'work_item.created',
  'work_item.updated',
  // Attendance (Inc 3): names the workflows describe without a catalogue name.
  'attendance.checkin_failed',
  'attendance.closed_provisionally',
  'attendance.review_resolved',
  'attendance.retroactive_created',
  'attendance.missing_checkout_flagged',
  'attendance.remote_exception_granted',
  'attendance.remote_exception_requested',
  'attendance.remote_exception_rejected',
  'attendance.remote_exception_revoked',
  'attendance_correction.withdrawn',
]);
