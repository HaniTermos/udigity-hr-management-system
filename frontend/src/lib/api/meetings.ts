/**
 * meetings API (backend MOD-meetings, BE4-C1). Owner: FE5. Screens: SCR-DEV-003/004; FE4 schedules from SCR-CC-007.
 * Source of truth: backend `modules/meetings/schemas.ts`. Responses are wrapped: `{ meeting }`.
 */
import { api, buildQuery, type QueryValue } from './client';
import type { Id, IsoDateTime } from './types';

export const meetingsPaths = {
  list: '/api/meetings',
  create: '/api/meetings',
  detail: (id: string) => `/api/meetings/${id}`,
  attendeeOptions: '/api/meetings/attendee-options',
  command: (id: string, verb: 'held' | 'missed' | 'cancel') => `/api/meetings/${id}/${verb}`,
} as const;

/** "Missed" is a Proposed state (R-13). "Outcome due" / "Upcoming" are derived flags, never stored. */
export type MeetingStatus = 'scheduled' | 'held' | 'missed' | 'cancelled';

export interface Meeting {
  id: Id;
  dealId: Id;
  dealCode: string | null;
  businessId: Id;
  businessName: string | null;
  version: number;
  status: MeetingStatus;
  title: string | null;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime | null;
  location: string | null;
  agenda: string | null;
  discoveryNotes: string | null;
  cancelReason: string | null;
  attendees: { employeeId: Id; fullName: string }[];
  rescheduleCount: number;
  awaitingOutcome: boolean;
  upcoming: boolean;
  allowed: { reschedule: boolean; recordOutcome: boolean; cancel: boolean; viewNotes: boolean };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface MeetingRange {
  /** Range of at most 62 days. */
  from: IsoDateTime;
  to: IsoDateTime;
  mine?: boolean;
  status?: MeetingStatus | 'any';
}

/** Calendar range, or `{ dealId }` alone for all meetings of one deal. */
export function meetingListPath(q: MeetingRange | { dealId: string }): string {
  const query: Record<string, QueryValue> =
    'dealId' in q
      ? { dealId: q.dealId }
      : { from: q.from, to: q.to, mine: q.mine ? true : undefined, status: q.status === 'any' ? undefined : q.status };
  return `${meetingsPaths.list}${buildQuery(query)}`;
}

export interface ScheduleMeetingInput {
  dealId?: string;
  businessId?: string;
  title?: string;
  startsAt: IsoDateTime;
  endsAt?: IsoDateTime;
  location?: string;
  agenda?: string;
  attendeeIds: string[];
}

export async function scheduleMeeting(body: ScheduleMeetingInput, idempotencyKey?: string): Promise<Meeting> {
  return (await api.post<{ meeting: Meeting }>(meetingsPaths.create, body, { idempotencyKey })).meeting;
}

export interface RescheduleMeetingInput {
  version: number;
  startsAt: IsoDateTime;
  endsAt?: IsoDateTime;
  reason?: string;
}

export async function rescheduleMeeting(id: string, body: RescheduleMeetingInput, idempotencyKey?: string): Promise<Meeting> {
  return (await api.patch<{ meeting: Meeting }>(meetingsPaths.detail(id), body, { idempotencyKey })).meeting;
}

/** Held: `discoveryNotes` required. Missed: optional `note`. There is no `held` flag in the body. */
export async function recordMeetingOutcome(
  id: string,
  body: { version: number } & ({ outcome: 'held'; discoveryNotes: string } | { outcome: 'missed'; note?: string }),
  idempotencyKey?: string
): Promise<Meeting> {
  const { outcome, ...rest } = body;
  return (await api.post<{ meeting: Meeting }>(meetingsPaths.command(id, outcome), rest, { idempotencyKey })).meeting;
}

/** Final: a cancelled meeting cannot be reopened. */
export async function cancelMeeting(id: string, body: { version: number; reason: string }, idempotencyKey?: string): Promise<Meeting> {
  return (await api.post<{ meeting: Meeting }>(meetingsPaths.command(id, 'cancel'), body, { idempotencyKey })).meeting;
}
