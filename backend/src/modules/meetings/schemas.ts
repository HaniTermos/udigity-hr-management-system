/**
 * MOD-meetings - Zod request schemas (.strict()), DTO types and VT-3 action declarations. Owner: BE4.
 * Status: Increment 5 (live). SM-MEETING-001: scheduled, held, cancelled, missed (Missed = Proposed state).
 * Developer scheduling exists only when deals.developerPreClosure = assigned (DEC-005 Alt 1; demonstration alternative - not approved).
 */
import { z } from 'zod';
import { defineMatrixActions } from '../access/schemas.js';
import { BoolQuery } from '../deals/schemas.js';

/**
 * VT-3 actions from docs/security/authz-matrix.md §3.8. `meeting.cancel` has no matrix row yet:
 * the cancel command is gated by `meeting.reschedule` (same roles) until Security adds it ([BE4-R2]).
 */
export const MEETING_ACTIONS = defineMatrixActions([
  'meeting.read',
  'meeting.create',
  'meeting.reschedule',
  'meeting.mark_missed',
  'meeting.complete',
] as const);

export const IdParam = z.object({ id: z.string().uuid() }).strict();

/**
 * GET /api/meetings/attendee-options (FX-BE-C3): the staff picker for whoever may schedule.
 * Review 2026-11-04 E-07: non-Owners get only the people relevant to the meeting (see routes.ts), so
 * pass the deal (`dealId`) or the business (`businessId`, its open deal) the meeting is for.
 */
export const AttendeeOptionsQuery = z
  .object({
    dealId: z.string().uuid().optional(),
    businessId: z.string().uuid().optional(),
    q: z.string().trim().max(80).optional(),
    role: z.string().trim().min(1).max(64).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict();
export interface AttendeeOptionDto {
  id: string;
  fullName: string;
  role: string;
}
const Version = z.number().int().min(1);
const IsoDateTime = z.string().datetime({ offset: true });
const AttendeeIds = z.array(z.string().uuid()).min(1, 'At least one attendee').max(20);

export const MEETING_STATUSES = ['scheduled', 'held', 'cancelled', 'missed'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** GET /api/meetings - calendar range (max 62 days, plan 4.4) or list. "My meetings" is the default UI filter. */
/** `from`/`to` may be omitted only with `dealId` (the deal detail meetings card lists all of a deal's meetings). */
export const ListMeetingsQuery = z.object({
  from: IsoDateTime.optional(),
  to: IsoDateTime.optional(),
  mine: BoolQuery.optional(),
  dealId: z.string().uuid().optional(),
  status: z.enum(MEETING_STATUSES).optional(),
  awaitingOutcome: BoolQuery.optional(),
}).strict().refine((q) => (q.from === undefined && q.to === undefined ? q.dealId !== undefined : q.from !== undefined && q.to !== undefined), {
  message: 'from and to are required (or dealId alone)',
  path: ['from'],
}).refine((q) => q.from === undefined || q.to === undefined || (Date.parse(q.to) - Date.parse(q.from) <= 62 * 86_400_000 && Date.parse(q.to) > Date.parse(q.from)), {
  message: 'Range must be positive and at most 62 days',
  path: ['to'],
});

/** POST /api/meetings. Start time must not be in the past (service check against ctx.now). */
export const CreateMeetingBody = z
  .object({
    dealId: z.string().uuid().optional(),
    businessId: z.string().uuid().optional(),
    title: z.string().trim().max(200).optional(),
    startsAt: IsoDateTime,
    endsAt: IsoDateTime.optional(),
    location: z.string().trim().max(300).optional(),
    agenda: z.string().trim().max(4000).optional(),
    attendeeIds: AttendeeIds,
  })
  .strict()
  .refine((b) => b.dealId !== undefined || b.businessId !== undefined, {
    message: 'dealId or businessId is required',
    path: ['dealId'],
  });

/** PATCH /api/meetings/:id - reschedule (event, not a state) from Scheduled or Missed. */
export const RescheduleMeetingBody = z.object({
  version: Version,
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  agenda: z.string().trim().max(4000).nullable().optional(),
  attendeeIds: AttendeeIds.optional(),
  reason: z.string().trim().max(1000).optional(),
}).strict();

/** POST /:id/held - start time must have been reached. Notes attach to the deal. */
export const MeetingHeldBody = z.object({ version: Version, discoveryNotes: z.string().trim().min(1).max(8000) }).strict();
/** POST /:id/missed - start time must have passed. */
export const MeetingMissedBody = z.object({ version: Version, note: z.string().trim().max(1000).optional() }).strict();
/** POST /:id/cancel - reason required, destructive confirm in UI. Not reopenable. */
export const MeetingCancelBody = z.object({ version: Version, reason: z.string().trim().min(3).max(1000) }).strict();

export interface MeetingDto {
  id: string;
  dealId: string;
  dealCode: string | null;
  businessId: string;
  businessName: string | null;
  version: number;
  status: MeetingStatus;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  agenda: string | null;
  discoveryNotes: string | null;
  cancelReason: string | null;
  attendees: { employeeId: string; fullName: string }[];
  rescheduleCount: number;
  /** Derived (not a status): scheduled and start time passed. */
  awaitingOutcome: boolean;
  /** Derived: Scheduled and start time in the future. */
  upcoming: boolean;
  allowed: { reschedule: boolean; recordOutcome: boolean; cancel: boolean; viewNotes: boolean };
  createdAt: string;
  updatedAt: string;
}
