/**
 * calling-assignments API — backend MOD-assignment (BE3-C1). Owner: FE2.
 * Screens: SCR-OWN-007 Calling assignments, SCR-OWN-008 Reassignment impact.
 * DTOs mirror backend `modules/assignment/schemas.ts`. Every policy here is a demonstration alternative.
 */
import { api, newIdempotencyKey } from './client';
import { callingPaths } from './calling';
import type { Page, PageQuery } from './types';

export type AssignmentSource = 'manual' | 'work_list' | 'automatic';

export interface CallingAssignmentDto {
  id: string;
  businessId: string;
  assigneeId: string;
  assigneeName: string;
  assignedBy: string | null;
  source: AssignmentSource;
  startedAt: string;
  version: number;
  /** Derived flags (B7): never stored, never auto-reassigned. */
  assigneeInactive: boolean;
  assignedButInaccessible: boolean;
}

export interface AssignmentListItem {
  businessId: string;
  businessName: string;
  /** Backend outcome code: pending | on_hold | needs_another_call | accepted | rejected. */
  outcome: string;
  assignment: CallingAssignmentDto | null;
}

export type AssignmentStatusFilter = 'assigned' | 'unassigned' | 'inaccessible';

export interface AssignmentListQuery extends PageQuery {
  sort?: 'businessName' | 'assignee' | 'startedAt';
  assigneeId?: string;
  status?: AssignmentStatusFilter | '';
}

export interface SkippedItem {
  businessId: string;
  code: string;
  message: string;
}

export interface AssignResultDto {
  assigned: CallingAssignmentDto[];
  skipped: SkippedItem[];
}

export interface AutofillResultDto extends AssignResultDto {
  cap: number;
  alreadyToday: number;
}

export interface ReassignImpactDto {
  currentAssignment: { id: string; assigneeId: string; assigneeName: string; version: number } | null;
  openFollowUps: Array<{ id: string; scheduledFor: string; responsibleId: string; preselected: 'transfer' }>;
  callbackMarker: boolean;
  activeReservation: { id: string; holderName: string; leaseExpiresAt: string } | null;
  ineligible: Array<{ code: string; message: string }>;
}

export type FollowUpChoice =
  | { followUpId: string; action: 'transfer' }
  | { followUpId: string; action: 'cancel'; reason: string }
  | { followUpId: string; action: 'keep' };

export interface ReassignInput {
  businessId: string;
  newAssigneeId: string;
  version: number;
  reason: string;
  followUps: FollowUpChoice[];
  reservationOverrideId?: string;
}

export interface UnassignInput {
  businessId: string;
  version: number;
  reason: string;
  followUps: FollowUpChoice[];
}

export function assignmentsListKey(q: AssignmentListQuery): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${callingPaths.assignments}?${s}` : callingPaths.assignments;
}

export const listAssignments = (q: AssignmentListQuery = {}) => api.get<Page<AssignmentListItem>>(assignmentsListKey(q));

export const assignBusinesses = (input: { businessIds: string[]; assigneeId: string }) =>
  api.post<AssignResultDto>(callingPaths.assignmentsCommand('assign'), { ...input, source: 'manual' }, { idempotencyKey: newIdempotencyKey() });

export const autofillAgent = (input: { agentId: string; limit?: number }) =>
  api.post<AutofillResultDto>(callingPaths.assignmentsCommand('autofill'), input, { idempotencyKey: newIdempotencyKey() });

export const getReassignImpact = (input: { businessId: string; newAssigneeId: string }) =>
  api.post<ReassignImpactDto>(callingPaths.assignmentsCommand('reassign-impact'), input);

export const reassignBusiness = (input: ReassignInput) =>
  api.post<{ assignment: CallingAssignmentDto; warnings: string[] }>(callingPaths.assignmentsCommand('reassign'), input);

export const unassignBusiness = (input: UnassignInput) =>
  api.post<{ businessId: string; unassigned: true; warnings: string[] }>(callingPaths.assignmentsCommand('unassign'), input);

/** Owner + 2FA. Ends the agent's contact; the agent sees an "overridden by Owner" notice (DEC-004, demo). */
export const overrideReservation = (reservationId: string, reason: string) =>
  api.post<{ id: string; state: 'overridden'; endedAt: string }>(callingPaths.reservationCommand(reservationId, 'override'), { reason });
