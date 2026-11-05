/**
 * calling API — backend MOD-calls + MOD-reservation + MOD-assignment (BE3). Owner: FE4.
 * Screens: SCR-CC-001..008; FE2 consumes `callingPaths.assignments*` for SCR-OWN-007/008.
 * DTOs mirror the BE3-C1 contract (backend `modules/{calls,reservation,assignment}/schemas.ts`); design:
 * docs/implementation/calling-design.md. Times are ISO-8601 UTC strings; render them in the company timezone.
 *
 * Every policy value in these DTOs (reservation timing, accepted-note length, save-after-loss branch, overdue
 * threshold) is a "Demonstration alternative — not approved". The only approved rule is U-01
 * ("Save, keep reservation" for every outcome except Rejected); the UI reads it from `workspace.allowed`.
 * No fixtures: the Increment 2 fixtures were deleted when BE3 shipped. Other agents request additions on the board.
 */
import { api, newIdempotencyKey } from './client';
import { apiFetch } from './http';
import type { Page } from './types';

export { newIdempotencyKey };

export const callingPaths = {
  queue: '/api/calling/queue',
  workspace: (businessId: string) => `/api/calling/businesses/${businessId}/workspace`,
  attempts: '/api/calling/attempts',
  inboundRejection: '/api/calling/attempts/inbound-rejection',
  doNotCall: '/api/calling/do-not-call',
  reopen: (businessId: string) => `/api/calling/businesses/${businessId}/reopen`,
  requeue: (businessId: string) => `/api/calling/businesses/${businessId}/requeue`,
  opportunities: '/api/calling/opportunities',
  followUps: '/api/follow-ups',
  followUp: (id: string) => `/api/follow-ups/${id}`,
  followUpCommand: (id: string, verb: 'complete' | 'cancel') => `/api/follow-ups/${id}/${verb}`,
  reservations: '/api/reservations',
  reservationCommand: (id: string, verb: 'renew' | 'release' | 'override') => `/api/reservations/${id}/${verb}`,
  assignments: '/api/calling-assignments',
  assignmentsCommand: (verb: 'assign' | 'reassign-impact' | 'reassign' | 'unassign' | 'autofill') => `/api/calling-assignments/${verb}`,
} as const;

/* ------------------------------------------------------------------ outcomes */

/** The four outcomes an agent can save. `pending` is the initial value and the target of reopen/requeue only. */
export type CallOutcome = 'on_hold' | 'needs_another_call' | 'rejected' | 'accepted';
export type BusinessOutcome = 'pending' | CallOutcome;

export type QueueBucket =
  | 'overdue_follow_up'
  | 'callback_due'
  | 'callback_to_schedule'
  | 'new_assigned'
  | 'on_hold'
  | 'upcoming_follow_up'
  | 'requires_contact';

/* ------------------------------------------------------------------ DTOs */

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
  /** false = saved after the reservation was lost (flag keepAttemptOnly). */
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
  /** Derived: scheduled and past the overdue threshold (demonstration default). */
  overdue: boolean;
  responsibleInactive: boolean;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelSource: 'user' | 'reassignment' | 'outcome_rejected' | null;
  version: number;
}

export interface FollowUpCommandResultDto {
  followUp: FollowUpDto;
  /** B3-Q04: an open follow-up was rescheduled instead of duplicated. */
  rescheduled: boolean;
  state?: CallingStateDto;
}

export interface QueueItemDto {
  businessId: string;
  businessName: string;
  bucket: QueueBucket;
  outcome: BusinessOutcome;
  callbackMarker: boolean;
  openFollowUp: { id: string; scheduledFor: string; responsibleId: string } | null;
  nextActionAt: string | null;
  lastAttemptAt: string | null;
  attemptCount: number;
  /** Someone else holds a live reservation (the holder is named in the workspace, not here). */
  reservedByOther: boolean;
  reservedByMe: boolean;
  assigneeId: string;
  assignedAt: string;
}

export interface QueueDto {
  items: QueueItemDto[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<QueueBucket, number>;
  agentId: string | null;
}

export interface QueueQuery {
  bucket?: QueueBucket;
  /** Owner only. */
  agentId?: string;
  sort?: 'nextAction' | 'businessName' | 'lastAttemptAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface WorkspaceReservationDto {
  state: 'none' | 'mine' | 'other';
  id: string | null;
  holderName: string | null;
  acquiredAt: string | null;
  leaseExpiresAt: string | null;
}

export interface WorkspaceDto {
  businessId: string;
  businessName: string;
  archived: boolean;
  access: { level: 'full' | 'owner' | 'context_limited'; exceptionRow: string | null };
  state: CallingStateDto;
  assignment: { assigneeId: string; assigneeName: string; assignedAt: string; isMe: boolean } | null;
  reservation: WorkspaceReservationDto;
  openFollowUp: FollowUpDto | null;
  attempts: CallAttemptDto[];
  allowed: {
    startContact: boolean;
    logAttempt: boolean;
    /** U-01 (APPROVED): per outcome, false only for rejected. */
    keepReservation: Record<CallOutcome, boolean>;
    outcomes: CallOutcome[];
    reopen: boolean;
    requeue: boolean;
  };
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
  deal: { dealId: string; stage: string; developerId: string | null; developerName: string | null; firstMeetingAt: string | null } | null;
  accessLevel: 'full' | 'owner' | 'context_limited';
}

export interface OpportunitiesDto extends Page<OpportunityItemDto> {
  dealInfoAvailable: boolean;
}

export interface ReopenResultDto {
  state: CallingStateDto;
  reopeningId: string;
}

/* ------------------------------------------------------------------ reservation DTOs */

export interface ReservationHolderDto {
  id: string;
  businessId: string;
  state: 'active';
  leaseToken: string;
  acquiredAt: string;
  leaseExpiresAt: string;
  idleExpiresAt: string;
  idleWarningAt: string;
  maxTotalExpiresAt: string;
  heartbeatSeconds: number;
  reentry: boolean;
}

/** 409 RESERVATION_CONFLICT `details`. */
export interface ReservationConflictDetails {
  holderName: string;
  acquiredAt: string;
  leaseExpiresAt: string;
}

export interface RenewResultDto {
  id: string;
  state: 'active';
  leaseExpiresAt: string;
  idleExpiresAt: string;
  idleWarningAt: string;
  idleWarning: boolean;
  maxTotalExpiresAt: string;
  maxTotalWarning: boolean;
  heartbeatSeconds: number;
}

export type ReservationLostReason = 'idle' | 'max_total' | 'lease_elapsed' | 'overridden' | 'access_denied' | 'token_mismatch' | 'released';

/** 409 RESERVATION_LOST `details`. */
export interface ReservationLostDetails {
  reason: ReservationLostReason;
}

export interface ReleaseResultDto {
  id: string;
  state: string;
  endReason: string | null;
}

/* ------------------------------------------------------------------ request bodies */

export interface FollowUpInput {
  /** ISO-8601 with offset. */
  scheduledFor: string;
  purpose?: string;
  responsibleId?: string;
}

interface AttemptCommon {
  businessId: string;
  reservationId: string;
  leaseToken: string;
  stateVersion: number;
  channel?: 'outbound_call' | 'inbound_other';
  notes?: string;
  fulfilsFollowUpId?: string;
  /** U-01: never true for rejected (the server answers 400). */
  keepReservation?: boolean;
}

export type LogAttemptBody =
  | (AttemptCommon & { outcome: 'on_hold'; followUp?: FollowUpInput })
  | (AttemptCommon & {
      outcome: 'needs_another_call';
      followUp?: FollowUpInput;
      callbackToBeScheduled?: boolean;
      clientRequestNote?: string;
    })
  | (AttemptCommon & { outcome: 'rejected'; rejectionReason: string })
  | (AttemptCommon & {
      outcome: 'accepted';
      clientNeedsNote: string;
      serviceInterest?: string;
      developerId?: string;
    });

export interface LogAttemptResultDto {
  attempt: CallAttemptDto;
  state: CallingStateDto;
  followUp: FollowUpDto | null;
  completedFollowUpId: string | null;
  dealId: string | null;
  developerAssigned: boolean;
  cancelledFollowUpIds: string[];
  reservation: 'released' | 'kept' | 'release_failed' | 'lost';
  reservationLease?: RenewResultDto;
  warning?: 'outcome_not_applied';
}

export interface InboundRejectionBody {
  businessId: string;
  stateVersion: number;
  rejectionReason: string;
  notes?: string;
}

export interface FollowUpListQuery {
  from?: string;
  to?: string;
  state?: FollowUpState;
  /** Owner only. */
  responsibleId?: string;
  sort?: 'scheduledFor' | 'businessName';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type FollowUpReplacement = FollowUpInput | 'callback_to_be_scheduled';

/** 422 `details.code` when completing/cancelling the last open follow-up of a Needs-another-call business. */
export const D2_REPLACEMENT_REQUIRED = 'D2_REPLACEMENT_REQUIRED';

/* ------------------------------------------------------------------ functions */

export const getQueue = (q: QueueQuery = {}) => api.get<QueueDto>(callingPaths.queue, { query: { ...q } });

export const getWorkspace = (businessId: string) => api.get<WorkspaceDto>(callingPaths.workspace(businessId));

export const acquireReservation = (businessId: string, idempotencyKey: string = newIdempotencyKey()) =>
  api.post<ReservationHolderDto>(callingPaths.reservations, { businessId }, { idempotencyKey });

export const renewReservation = (id: string, body: { leaseToken: string; idleSeconds: number; keepWorking?: boolean }) =>
  api.post<RenewResultDto>(callingPaths.reservationCommand(id, 'renew'), { keepWorking: false, ...body });

export const releaseReservation = (id: string, leaseToken: string) =>
  api.post<ReleaseResultDto>(callingPaths.reservationCommand(id, 'release'), { leaseToken });

/**
 * Release that survives the page going away (tab close, reload, navigation). `sendBeacon` cannot set the CSRF
 * header, so this uses `fetch(..., { keepalive: true })` through the CSRF-aware transport. Fire and forget.
 */
export function releaseReservationKeepalive(id: string, leaseToken: string): void {
  void apiFetch(callingPaths.reservationCommand(id, 'release'), { method: 'POST', body: { leaseToken }, keepalive: true });
}

/** Owner + 2FA. */
export const overrideReservation = (id: string, reason: string) =>
  api.post<{ id: string; state: 'overridden'; endedAt: string }>(callingPaths.reservationCommand(id, 'override'), { reason });

export const logAttempt = (body: LogAttemptBody, idempotencyKey: string) =>
  api.post<LogAttemptResultDto>(callingPaths.attempts, body, { idempotencyKey });

/** Inbound do-not-call (B3-Q10): its own route, no reservation. */
export const logInboundRejection = (body: InboundRejectionBody, idempotencyKey: string) =>
  api.post<LogAttemptResultDto>(callingPaths.inboundRejection, body, { idempotencyKey });

export const getDoNotCall = (q: { q?: string; sort?: 'rejectedAt' | 'businessName'; order?: 'asc' | 'desc'; page?: number; pageSize?: number } = {}) =>
  api.get<Page<DoNotCallItemDto>>(callingPaths.doNotCall, { query: { ...q } });

export const getOpportunities = (q: { developerAssigned?: boolean; page?: number; pageSize?: number } = {}) =>
  api.get<OpportunitiesDto>(callingPaths.opportunities, { query: { ...q } });

/** DEC-016 (Owner + 2FA). Demonstration alternative — not approved. */
export const reopenBusiness = (businessId: string, body: { reason: string; stateVersion: number }) =>
  api.post<ReopenResultDto>(callingPaths.reopen(businessId), body);

export const requeueBusiness = (businessId: string, body: { reason: string; stateVersion: number }) =>
  api.post<ReopenResultDto>(callingPaths.requeue(businessId), body);

export const listFollowUps = (q: FollowUpListQuery = {}) => api.get<Page<FollowUpDto>>(callingPaths.followUps, { query: { ...q } });

export const createFollowUp = (body: { businessId: string; scheduledFor: string; purpose?: string; responsibleId?: string }, idempotencyKey?: string) =>
  api.post<FollowUpCommandResultDto>(callingPaths.followUps, body, { idempotencyKey });

export const updateFollowUp = (id: string, body: { version: number; scheduledFor?: string; responsibleId?: string; reason?: string }) =>
  api.patch<FollowUpCommandResultDto>(callingPaths.followUp(id), body);

export const completeFollowUp = (id: string, body: { version: number; completionNote?: string; attemptId?: string; replacement?: FollowUpReplacement }) =>
  api.post<FollowUpCommandResultDto>(callingPaths.followUpCommand(id, 'complete'), body);

export const cancelFollowUp = (id: string, body: { version: number; reason: string; replacement?: FollowUpReplacement }) =>
  api.post<FollowUpCommandResultDto>(callingPaths.followUpCommand(id, 'cancel'), body);
