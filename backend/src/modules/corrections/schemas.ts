/**
 * MOD-corrections — Zod request schemas (.strict()), DTOs and VT-3 action declarations. Owner: BE2.
 * SM-DATAFIX-001 (Demonstration alternative — not approved, OI-19 / N-4):
 *   submitted → in_review (start-review, first wins) → resolved | closed | rejected
 *   in_review → submitted (release by the reviewer or Owner; reviewer deactivated)
 *   submitted | in_review → withdrawn (requester)
 * Terminal states never reopen.
 */
import { z } from 'zod';
import { defineMatrixActions } from '../access/schemas.js';
import { PageQuerySchema } from '../../shared/pagination.js';
import { UpdateBusinessSchema } from '../businesses/schemas.js';

export const CORRECTION_ACTIONS = defineMatrixActions([
  'correction.submit',
  'correction.read',
  'correction.withdraw',
  'correction.review',
  'correction.apply',
  'correction.reject',
  'correction.close',
] as const);

export const CORRECTION_STATUSES = ['submitted', 'in_review', 'resolved', 'closed', 'rejected', 'withdrawn'] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];
export const OPEN_STATUSES: readonly CorrectionStatus[] = ['submitted', 'in_review'];

/** ART-01 §14 examples. "Other" covers the rest. */
export const ISSUE_TYPES = [
  'Incorrect phone',
  'Outdated social link',
  'Missing website information',
  'Wrong category',
  'Wrong business name',
  'Business no longer operating',
  'Other',
] as const;

const trimmed = (max: number) => z.string().trim().max(max);

export const SubmitCorrectionSchema = z
  .object({
    businessId: z.string().uuid(),
    issueType: z.enum(ISSUE_TYPES),
    field: trimmed(120).nullable().optional(),
    description: trimmed(2000).min(1, 'Describe what is wrong'),
    suggestedValue: trimmed(1000).nullable().optional(),
  })
  .strict();

export const CorrectionVersionSchema = z.object({ version: z.number().int().min(1) }).strict();
export const StartReviewSchema = z.object({ version: z.number().int().min(1).optional() }).strict();
export const RejectSchema = z.object({ version: z.number().int().min(1), reason: trimmed(2000).min(1, 'A reason is required') }).strict();
export const CloseNoChangeSchema = z.object({ version: z.number().int().min(1), note: trimmed(2000).min(1, 'A note is required') }).strict();
/** Apply: the business changes (same shape as PATCH /api/businesses/:id) are saved and the request resolves in ONE transaction. */
export const ResolveSchema = z
  .object({
    version: z.number().int().min(1),
    note: trimmed(2000).optional(),
    business: UpdateBusinessSchema.omit({ correctionId: true, correctionNote: true }),
  })
  .strict();

export const CorrectionListQuerySchema = PageQuerySchema.extend({
  tab: z.enum(['open', 'resolved', 'closed', 'withdrawn']).optional(),
  status: z.enum(['submitted', 'in_review']).optional(),
  /** Business name or requester name. */
  q: trimmed(100).optional(),
  /** Requester id or full name. */
  requestedBy: trimmed(120).optional(),
  age: z.enum(['lt1d', 'd1to3', 'gt3d']).optional(),
  businessId: z.string().uuid().optional(),
}).strict();

export type SubmitCorrectionInput = z.infer<typeof SubmitCorrectionSchema>;
export type CorrectionListQuery = z.infer<typeof CorrectionListQuerySchema>;
export type ResolveInput = z.infer<typeof ResolveSchema>;

export type CorrectionTab = 'open' | 'resolved' | 'closed' | 'withdrawn';

export interface CorrectionRow {
  id: string;
  /** null when redacted (the requester's own request on a business they can no longer read, OI-09). */
  businessId: string | null;
  businessName: string | null;
  businessMeta: string | null;
  redacted: boolean;
  issueType: string;
  issueDetail: string | null;
  requestedBy: string;
  requestedById: string;
  requestedByRole: string;
  createdAt: string;
  status: CorrectionStatus;
  reviewer: string | null;
  reviewerId: string | null;
  outcomeNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  mine: boolean;
  version: number;
}

export interface CorrectionDetail extends CorrectionRow {
  field: string | null;
  /** Not computed server-side (the client reads the business); always null in v1. */
  currentValue: null;
  suggestedValue: string | null;
  explanation: string | null;
  takenAt: string | null;
  resolutionNote: string | null;
}

export interface CorrectionPage {
  items: CorrectionRow[];
  page: number;
  pageSize: number;
  total: number;
  tabCounts: Record<CorrectionTab, number>;
  requesters: string[];
}
