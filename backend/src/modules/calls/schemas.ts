/**
 * MOD-calls — Zod request schemas (.strict()), response DTOs and VT-3 action declarations. Owner: BE3.
 * Status: Increment 4 (implemented). Action names/roles: docs/security/authz-matrix.md §3.7 via the BE2-C1 harness;
 * the two list actions keep the ORCH-4 (c) names and are not in the matrix yet (REQUEST BE3-R5 to Security).
 * Contract: docs/implementation/plan.md section 4.1 (/api/calling, /api/follow-ups); design: docs/implementation/calling-design.md.
 * Policy-dependent behaviour (flags) is documented in the design file; schemas stay flag-independent.
 * Approved rule U-01: "Save, keep reservation" is allowed for every outcome except Rejected.
 */
import { z } from 'zod';
import { MAX_PAGE } from '../../shared/pagination.js';
import { isoDateTime as isoDateTimeStrict, safeString } from '../../shared/validation.js';
import { defineActions } from '../../shared/access.js';
import { defineMatrixActions } from '../access/schemas.js';
import type { RenewResultDto } from '../reservation/schemas.js';

export const ACTIONS = defineMatrixActions([
  'calling.queue.read', // queue + contact workspace (CC-001/002)
  'call.log_attempt', // POST /attempts and /attempts/inbound-rejection
  'call.set_outcome', // POST /attempts (the outcome part of the same save)
  'business.reopen_rejected', // DEC-016
  'business.requeue', // B3-Q12
  'follow_up.read',
  'follow_up.create',
  'follow_up.reschedule',
  'follow_up.complete',
  'follow_up.cancel',
] as const);

/** ORCH-4 (c) names, not yet in authz-matrix.md (BE3-R5). Rows are scoped by access.scopeFilter. */
export const LIST_ACTIONS = defineActions({
  'call_attempt.list_do_not_call': { roles: ['owner', 'call_center'], description: 'CC-008 do-not-call list' },
  // D15 (approved 2026-10-29): accepted opportunities are the assigned Developer's and the Owner's only; CC is refused.
  'call_attempt.list_opportunities': { roles: ['owner'], description: 'CC-007 accepted opportunities (Owner view; D15)' },
});

const uuid = safeString().uuid();
const version = z.number().int().min(1);
const isoDateTime = isoDateTimeStrict();
const text = (max: number) => safeString().trim().max(max);

export const IdParam = z.object({ id: uuid }).strict();
export const BusinessIdParam = z.object({ id: uuid }).strict();

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------
export const CALL_OUTCOMES = ['on_hold', 'needs_another_call', 'rejected', 'accepted'] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
/** Stored on the business; `pending` is the initial value and the target of reopen/requeue only. */
export const BUSINESS_OUTCOMES = ['pending', ...CALL_OUTCOMES] as const;
export type BusinessOutcome = (typeof BUSINESS_OUTCOMES)[number];

/** Follow-up created in the same save (On hold optional, Needs another call required unless the D2 marker is chosen). */
export const FollowUpInput = z
  .object({
    scheduledFor: isoDateTime,
    purpose: text(500).optional(),
    /** Defaults to the attempt's agent; Owner may name another active Call Center agent. */
    responsibleId: uuid.optional(),
  })
  .strict();
export type FollowUpInput = z.infer<typeof FollowUpInput>;

const attemptBase = {
  businessId: uuid,
  reservationId: uuid,
  leaseToken: uuid,
  /** Calling-state version the workspace loaded (stale client => 409 VERSION_CONFLICT with current values). */
  stateVersion: version,
  channel: z.enum(['outbound_call', 'inbound_other']).default('outbound_call'),
  notes: text(4000).optional(),
  /** Optional follow-up this attempt fulfils (marked Completed in the same save). */
  fulfilsFollowUpId: uuid.optional(),
  /**
   * U-01 (APPROVED): keep the reservation after saving. Allowed for on_hold, needs_another_call and accepted;
   * rejected rejects `true` with 422 RULE_VIOLATION. Default false = release after commit (AR-03).
   */
  keepReservation: z.boolean().default(false),
};

/**
 * POST /api/calling/attempts — requires `Idempotency-Key`. Attempt time is server now (B3-Q07); there is no time field.
 * Mandatory fields (B3-Q16): needs_another_call => followUp XOR callbackToBeScheduled; rejected => reason;
 * accepted => clientNeedsNote (min length from calls.acceptedNoteMinLength, validated in the service because it is a SET);
 * on_hold => none.
 */
export const LogAttemptBody = z.discriminatedUnion('outcome', [
  z
    .object({
      ...attemptBase,
      outcome: z.literal('on_hold'),
      followUp: FollowUpInput.optional(),
    })
    .strict(),
  z
    .object({
      ...attemptBase,
      outcome: z.literal('needs_another_call'),
      followUp: FollowUpInput.optional(),
      /** D2: explicit "callback to be scheduled" marker; mutually exclusive with followUp. */
      callbackToBeScheduled: z.boolean().default(false),
      clientRequestNote: text(1000).optional(),
    })
    .strict(),
  z
    .object({
      ...attemptBase,
      outcome: z.literal('rejected'),
      rejectionReason: text(1000).min(3),
    })
    .strict(),
  z
    .object({
      ...attemptBase,
      outcome: z.literal('accepted'),
      clientNeedsNote: text(4000).min(1),
      serviceInterest: text(500).optional(),
      /** Developer assignment now (Call Center or Owner, E2) or deferred (E3 "developer not yet assigned"). */
      developerId: uuid.optional(),
    })
    .strict(),
]).superRefine((v, ctx) => {
  // D2: Needs another call never exists without a follow-up or the explicit marker (exactly one of them).
  if (v.outcome === 'needs_another_call' && (v.followUp !== undefined) === v.callbackToBeScheduled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either a follow-up or the callback-to-be-scheduled marker',
      path: ['followUp'],
    });
  }
  // U-01 (APPROVED): keep-reservation is hidden/forbidden only for Rejected.
  if (v.keepReservation && !canKeepReservation(v.outcome)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A rejected contact cannot keep its reservation', path: ['keepReservation'] });
  }
});
export type LogAttemptBody = z.infer<typeof LogAttemptBody>;

/**
 * B3-Q10: inbound do-not-call outside a call. Same path as an attempt with channel inbound_other and outcome rejected;
 * no reservation is required for it, so reservationId/leaseToken are absent from this body.
 */
export const LogInboundRejectionBody = z
  .object({
    businessId: uuid,
    stateVersion: version,
    rejectionReason: text(1000).min(3),
    notes: text(4000).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Queue / lists
// ---------------------------------------------------------------------------
/**
 * Derived buckets (nothing stored), one per item, in this priority: overdue_follow_up, callback_due (open follow-up due
 * by the end of today, company time), callback_to_schedule (D2 marker), new_assigned (pending, no attempts),
 * on_hold, upcoming_follow_up (open follow-up later than today), requires_contact (everything else still open).
 */
export const QUEUE_BUCKETS = [
  'overdue_follow_up', 'callback_due', 'callback_to_schedule', 'new_assigned', 'on_hold', 'upcoming_follow_up', 'requires_contact',
] as const;
export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

const paging = {
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  order: z.enum(['asc', 'desc']).default('asc'),
};

export const QueueQuery = z
  .object({
    ...paging,
    sort: z.enum(['businessName', 'nextAction', 'lastAttemptAt']).default('nextAction'),
    bucket: z.enum(QUEUE_BUCKETS).optional(),
    /** Owner only: view another agent's queue. */
    agentId: uuid.optional(),
  })
  .strict();

export const DoNotCallQuery = z
  .object({ ...paging, sort: z.enum(['businessName', 'rejectedAt']).default('rejectedAt'), q: text(100).optional() })
  .strict();

export const OpportunitiesQuery = z
  .object({
    ...paging,
    sort: z.enum(['acceptedAt', 'businessName']).default('acceptedAt'),
    developerAssigned: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  })
  .strict();

/** POST /api/calling/businesses/:id/reopen (DEC-016, Owner) and /requeue (B3-Q12, Owner). */
export const ReopenBody = z.object({ reason: text(1000).min(3), stateVersion: version }).strict();

// ---------------------------------------------------------------------------
// Follow-ups (/api/follow-ups)
// ---------------------------------------------------------------------------
const MAX_RANGE_MS = 62 * 24 * 3600 * 1000;

export const ListFollowUpsQuery = z
  .object({
    ...paging,
    sort: z.enum(['scheduledFor', 'businessName']).default('scheduledFor'),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    state: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
    responsibleId: uuid.optional(),
  })
  .strict()
  .refine((q) => (q.from === undefined) === (q.to === undefined), { message: 'from and to go together', path: ['from'] })
  .refine((q) => q.from === undefined || q.to === undefined || (Date.parse(q.to) - Date.parse(q.from) > 0 && Date.parse(q.to) - Date.parse(q.from) <= MAX_RANGE_MS), {
    message: 'Calendar range must be positive and at most 62 days',
    path: ['to'],
  });

/** POST /api/follow-ups — standalone create; B3-Q04: if one is open, the service reschedules it (returns it with `rescheduled: true`). */
export const CreateFollowUpBody = z
  .object({ businessId: uuid, scheduledFor: isoDateTime, purpose: text(500).optional(), responsibleId: uuid.optional() })
  .strict();

/** PATCH /api/follow-ups/:id — reschedule and/or change responsible; at least one field. */
export const UpdateFollowUpBody = z
  .object({ version, scheduledFor: isoDateTime.optional(), responsibleId: uuid.optional(), reason: text(500).min(3).optional() })
  .strict()
  .refine((b) => b.scheduledFor !== undefined || b.responsibleId !== undefined, { message: 'Nothing to change', path: ['scheduledFor'] });

/** D2: completing/cancelling the last open follow-up of a Needs-another-call business needs a replacement or the marker. */
export const CompleteFollowUpBody = z
  .object({
    version,
    completionNote: text(1000).optional(),
    attemptId: uuid.optional(),
    replacement: z.union([FollowUpInput, z.literal('callback_to_be_scheduled')]).optional(),
  })
  .strict();

export const CancelFollowUpBody = z
  .object({ version, reason: text(500).min(3), replacement: z.union([FollowUpInput, z.literal('callback_to_be_scheduled')]).optional() })
  .strict();

// ---------------------------------------------------------------------------
// Rules shared with the UI
// ---------------------------------------------------------------------------

/**
 * U-01 (APPROVED by the user: "Accepted keeps reservation"): "Save, keep reservation" is offered for
 * every outcome except Rejected. The single rule used by the schema, the service and the workspace DTO.
 */
export function canKeepReservation(outcome: CallOutcome): boolean {
  return outcome !== 'rejected';
}

// ---------------------------------------------------------------------------
// Response DTOs (contract for FE4 / FE2; ISO-8601 UTC strings, camelCase)
// ---------------------------------------------------------------------------
export interface CallingStateDto {
  businessId: string;
  outcome: BusinessOutcome;
  outcomeChangedAt: string | null;
  rejectionReason: string | null;
  /** D2 "callback to be scheduled" marker. */
  callbackMarker: boolean;
  lastTouchpointAt: string | null;
  /** Send back as `stateVersion` on the next save. */
  version: number;
}

export interface CallAttemptDto {
  id: string;
  businessId: string;
  agentId: string;
  agentName: string;
  attemptedAt: string;
  channel: 'outbound_call' | 'inbound_other';
  outcome: CallOutcome;
  /** false = saved after the reservation was lost (flag calls.saveAfterReservationLoss = keepAttemptOnly). */
  outcomeApplied: boolean;
  notes: string | null;
  rejectionReason: string | null;
  clientNeedsNote: string | null;
  serviceInterest: string | null;
}

export type FollowUpState = 'scheduled' | 'completed' | 'cancelled';

export interface FollowUpDto {
  id: string;
  businessId: string;
  businessName: string;
  responsibleId: string;
  responsibleName: string;
  scheduledFor: string;
  purpose: string | null;
  state: FollowUpState;
  /** Derived: scheduled and scheduledFor <= now. */
  due: boolean;
  /** Derived: scheduled and scheduledFor + followUps.overdueMinutes (DEMO 60) has passed. */
  overdue: boolean;
  /** Derived: the responsible user is inactive. */
  responsibleInactive: boolean;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelSource: 'user' | 'reassignment' | 'outcome_rejected' | null;
  version: number;
}

/** POST /api/follow-ups result: B3-Q04 — an open follow-up is rescheduled instead of duplicated. */
export interface FollowUpCommandResultDto {
  followUp: FollowUpDto;
  rescheduled: boolean;
  /** Present when the command also changed the calling state (D2 marker set/cleared). */
  state?: CallingStateDto;
}

export interface LogAttemptResultDto {
  attempt: CallAttemptDto;
  state: CallingStateDto;
  /** Follow-up created or rescheduled by this save. */
  followUp: FollowUpDto | null;
  /** Follow-up completed by `fulfilsFollowUpId`. */
  completedFollowUpId: string | null;
  /** Present for accepted: the deal created by BE4 `createAcceptedOpportunity` in the same transaction. */
  dealId: string | null;
  developerAssigned: boolean;
  /** Cancelled follow-ups (D4: Rejected cancels open follow-ups in the same save). */
  cancelledFollowUpIds: string[];
  /** Reservation after the post-commit step: released, still held (U-01), release failed (lapses at lease end), or lost. */
  reservation: 'released' | 'kept' | 'release_failed' | 'lost';
  /** Present when `reservation = 'kept'`: the renewed lease. */
  reservationLease?: RenewResultDto;
  /**
   * `outcome_not_applied`: save-after-loss branch keepAttemptOnly (DEMO B3-Q05) — the attempt row and notes are stored,
   * the outcome, follow-up and deal are NOT; the client tells the agent to reopen the contact. Absent on a normal save.
   */
  warning?: 'outcome_not_applied';
}

export interface QueueItemDto {
  businessId: string;
  businessName: string;
  bucket: QueueBucket;
  outcome: BusinessOutcome;
  callbackMarker: boolean;
  openFollowUp: { id: string; scheduledFor: string; responsibleId: string } | null;
  /** The time that orders the queue: the open follow-up time, else the assignment start. */
  nextActionAt: string | null;
  lastAttemptAt: string | null;
  attemptCount: number;
  /** Someone else holds a live reservation. The holder's name is not in the queue (open the workspace). */
  reservedByOther: boolean;
  reservedByMe: boolean;
  assigneeId: string;
  assignedAt: string;
}

export interface QueueDto {
  items: QueueItemDto[];
  page: number;
  pageSize: number;
  /** Items in the selected bucket (or all buckets), counted after the access scope. */
  total: number;
  /** Per-bucket counts for the tabs (after the access scope). */
  counts: Record<QueueBucket, number>;
  agentId: string | null;
}

export interface WorkspaceReservationDto {
  /** none | mine (re-acquire to get the lease token, `reentry: true`) | other. */
  state: 'none' | 'mine' | 'other';
  id: string | null;
  /** Shown only to users who passed the business access check (everyone who can open the workspace). */
  holderName: string | null;
  acquiredAt: string | null;
  leaseExpiresAt: string | null;
}

export interface WorkspaceDto {
  businessId: string;
  businessName: string;
  archived: boolean;
  /** Access level of the caller: full | owner | context_limited (+ exceptionRow). */
  access: { level: 'full' | 'owner' | 'context_limited'; exceptionRow: string | null };
  state: CallingStateDto;
  assignment: { assigneeId: string; assigneeName: string; assignedAt: string; isMe: boolean } | null;
  reservation: WorkspaceReservationDto;
  openFollowUp: FollowUpDto | null;
  /** Latest 50 attempts, newest first. */
  attempts: CallAttemptDto[];
  /** What the UI may offer now; the server re-checks every command. */
  allowed: {
    startContact: boolean;
    logAttempt: boolean;
    /** U-01 (APPROVED): keep-reservation per outcome (false only for rejected). */
    keepReservation: Record<CallOutcome, boolean>;
    /** Agents cannot change Accepted (B3-Q12): only `accepted` (attempt only) is accepted then. */
    outcomes: CallOutcome[];
    reopen: boolean;
    requeue: boolean;
  };
  /** Demonstration values from settings (labelled in the UI as "Demonstration alternative — not approved"). */
  policy: {
    acceptedNoteMinLength: number;
    heartbeatSeconds: number;
    saveAfterReservationLoss: 'keepAttemptOnly' | 'reject';
    label: string;
  };
}

export interface DoNotCallItemDto {
  businessId: string;
  businessName: string;
  rejectedAt: string | null;
  rejectionReason: string | null;
  rejectedById: string | null;
  rejectedByName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  attemptCount: number;
  stateVersion: number;
}

export interface OpportunityItemDto {
  businessId: string;
  businessName: string;
  acceptedAt: string | null;
  acceptedById: string | null;
  acceptedByName: string | null;
  attemptId: string | null;
  clientNeedsNote: string | null;
  serviceInterest: string | null;
  callNotes: string | null;
  /** BE4 read op; `null` while unavailable (`dealInfoAvailable: false` on the page). */
  deal: { dealId: string; stage: string; developerId: string | null; developerName: string | null; firstMeetingAt: string | null } | null;
  /** Context-limited row (DEC-002 R1) — confine to this surface. */
  accessLevel: 'full' | 'owner' | 'context_limited';
}

export interface OpportunitiesDto {
  items: OpportunityItemDto[];
  page: number;
  pageSize: number;
  total: number;
  dealInfoAvailable: boolean;
}

export interface ReopenResultDto {
  state: CallingStateDto;
  reopeningId: string;
}
