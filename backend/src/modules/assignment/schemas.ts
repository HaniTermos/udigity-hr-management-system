/**
 * MOD-assignment — Zod request schemas (.strict()), response DTOs and VT-3 action declarations. Owner: BE3.
 * Status: Increment 4 (implemented). Action names/roles come from docs/security/authz-matrix.md §3.7 (BE2-C1 harness).
 * The matrix has no separate list/preview row: GET / and POST /reassign-impact are guarded by `calling.assign`
 * (Owner + completed 2FA, the same page OWN-007/008).
 * Contract: docs/implementation/plan.md section 4.1 (/api/calling-assignments); design: docs/implementation/calling-design.md.
 * B8: only this module creates or changes calling assignments (WF-WORK-001 hands Call Center items here).
 */
import { z } from 'zod';
import { MAX_PAGE } from '../../shared/pagination.js';
import { safeString } from '../../shared/validation.js';
import { defineMatrixActions } from '../access/schemas.js';

/** authz-matrix §3.7: Owner only, admin (completed 2FA). B3-Q01 / B3-Q15 / DEC-021 are demonstration defaults. */
export const ACTIONS = defineMatrixActions(['calling.assign', 'calling.reassign', 'calling.unassign', 'calling.autofill'] as const);

const uuid = safeString().uuid();
const reason = safeString().trim().min(3).max(500);

/** B3-Q03: per open follow-up the Owner chooses; "transfer" is the UI preselection. No server default. */
export const FollowUpChoice = z.discriminatedUnion('action', [
  z.object({ followUpId: uuid, action: z.literal('transfer') }).strict(),
  z.object({ followUpId: uuid, action: z.literal('cancel'), reason }).strict(),
  z.object({ followUpId: uuid, action: z.literal('keep') }).strict(),
]);
export type FollowUpChoice = z.infer<typeof FollowUpChoice>;

export const ListAssignmentsQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sort: z.enum(['businessName', 'assignee', 'startedAt']).default('startedAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    assigneeId: uuid.optional(),
    status: z.enum(['assigned', 'unassigned', 'inaccessible']).optional(),
    /** BL-01 (additive): business name (contains, case-insensitive) or phone digits. */
    q: safeString().trim().min(2).max(100).optional(),
    /** BL-01 (additive): only businesses with (`reserved`) or without (`free`) an active reservation. */
    reservation: z.enum(['reserved', 'free']).optional(),
  })
  .strict();

/** POST /assign — `Idempotency-Key` optional. */
export const AssignBody = z
  .object({
    businessIds: z.array(uuid).min(1).max(200),
    assigneeId: uuid,
    source: z.enum(['manual', 'work_list', 'automatic']).default('manual'),
  })
  .strict();

/** POST /reassign-impact — OWN-008 preview, no writes. */
export const ReassignImpactBody = z.object({ businessId: uuid, newAssigneeId: uuid }).strict();

/** POST /reassign — one business per save; `version` is the open assignment row's version. */
export const ReassignBody = z
  .object({
    businessId: uuid,
    newAssigneeId: uuid,
    version: z.number().int().min(1),
    reason,
    /** Must cover every open follow-up listed by the impact preview (no default, B3-Q03). */
    followUps: z.array(FollowUpChoice).max(1),
    /** Active reservation: the Owner must have chosen Override first (separate call) — the save never releases it. */
    reservationOverrideId: uuid.optional(),
  })
  .strict();

export const UnassignBody = z
  .object({ businessId: uuid, version: z.number().int().min(1), reason, followUps: z.array(FollowUpChoice).max(1) })
  .strict();

/**
 * POST /autofill — policy baseline 2026-10-29 §D8 "Auto-fill queues" (Owner-triggered only).
 * No `agentId`: round-robin across every active Call Center agent. With `agentId`: that agent only.
 * Each agent is filled up to the queue cap (work.autofillQueueCap, default 40 current eligible assigned
 * businesses) — a queue cap, not a performance quota. `limit` caps how many are added in this call.
 */
export const AutofillBody = z.object({ agentId: uuid.optional(), limit: z.number().int().min(1).max(200).optional() }).strict();

export interface AutofillAgentResultDto {
  agentId: string;
  agentName: string;
  /** Current eligible assigned businesses before this run. */
  queueBefore: number;
  assignedNow: number;
}

export interface CallingAssignmentDto {
  id: string;
  businessId: string;
  assigneeId: string;
  assigneeName: string;
  assignedBy: string | null;
  source: 'manual' | 'work_list' | 'automatic';
  startedAt: string;
  version: number;
  /** Derived (B7): assignee is inactive or has lost access to the business. Never auto-reassigned. */
  assigneeInactive: boolean;
  assignedButInaccessible: boolean;
}

export interface ReassignImpactDto {
  currentAssignment: { id: string; assigneeId: string; assigneeName: string; version: number } | null;
  openFollowUps: Array<{ id: string; scheduledFor: string; responsibleId: string; preselected: 'transfer' }>;
  callbackMarker: boolean;
  /** Active reservation: Owner chooses Wait or Override (WF-CALL-002). */
  activeReservation: { id: string; holderName: string; leaseExpiresAt: string } | null;
  /** Per-item ineligibility reasons (B1 rejected, B2 no phone, B4 archived, B6 open deal). */
  ineligible: Array<{ code: string; message: string }>;
}

export interface AssignResultDto {
  assigned: CallingAssignmentDto[];
  skipped: Array<{ businessId: string; code: string; message: string }>;
}
