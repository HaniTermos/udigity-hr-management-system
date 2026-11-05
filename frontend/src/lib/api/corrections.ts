/**
 * corrections API — backend MOD-corrections (BE2). Owner: FE3.
 * Screens: SCR-DE-005/006 (FE3); the SCR-SHR-009 submit drawer is used by FE4/FE5.
 * Source of truth: backend `modules/corrections/schemas.ts`, posted as [BE2-C2] on the board.
 * State machine (demonstration alternative — not approved): submitted → in_review → resolved | closed | rejected;
 * in_review → submitted (release); submitted | in_review → withdrawn. Terminal states never reopen.
 */
import { api } from './client';
import type { BusinessUpdateInput } from './businesses';
import type { IsoDateTime, Page, PageQuery } from './types';

export const correctionsPaths = {
  list: '/api/correction-requests',
  create: '/api/correction-requests',
  detail: (id: string) => `/api/correction-requests/${id}`,
  command: (id: string, verb: 'start-review' | 'release' | 'resolve' | 'reject' | 'close-no-change' | 'withdraw') =>
    `/api/correction-requests/${id}/${verb}`,
} as const;

export type CorrectionStatus = 'submitted' | 'in_review' | 'resolved' | 'closed' | 'rejected' | 'withdrawn';

/** `closed` lists closed and rejected requests. */
export type CorrectionTab = 'open' | 'resolved' | 'closed' | 'withdrawn';

export interface CorrectionRow {
  id: string;
  /** `null` when redacted: your own request on a business you can no longer read (OI-09). */
  businessId: string | null;
  businessName: string | null;
  /** Second line under the business, e.g. `Downtown branch · Salon`. */
  businessMeta: string | null;
  redacted: boolean;
  issueType: string;
  /** Second line under the issue, e.g. `Suggested +961 70 000 113`. */
  issueDetail: string | null;
  requestedBy: string;
  requestedById: string;
  requestedByRole: string;
  createdAt: IsoDateTime;
  status: CorrectionStatus;
  reviewer: string | null;
  reviewerId: string | null;
  /** Outcome note shown on the Resolved and Closed / rejected tabs. */
  outcomeNote: string | null;
  resolvedBy: string | null;
  resolvedAt: IsoDateTime | null;
  /** It is your own request. */
  mine: boolean;
  version: number;
}

export interface CorrectionDetail extends CorrectionRow {
  /** Field label, e.g. `Phone 2` or `Social account · Instagram`. */
  field: string | null;
  /** Not computed by the server in v1: always `null`. Read the business for the current value. */
  currentValue: string | null;
  suggestedValue: string | null;
  explanation: string | null;
  takenAt: IsoDateTime | null;
  resolutionNote: string | null;
}

export interface CorrectionQuery extends PageQuery {
  tab?: CorrectionTab;
  /** Business name or requester. */
  q?: string;
  status?: 'submitted' | 'in_review';
  requestedBy?: string;
  age?: 'lt1d' | 'd1to3' | 'gt3d';
  businessId?: string;
}

export interface CorrectionPage extends Page<CorrectionRow> {
  /** Rows the viewer cannot read are omitted and not counted (OI-07). */
  tabCounts: Record<CorrectionTab, number>;
  requesters: string[];
}

export const listCorrections = (q: CorrectionQuery = {}) => api.get<CorrectionPage>(correctionsPaths.list, { query: { ...q } });

export const getCorrection = (id: string) => api.get<CorrectionDetail>(correctionsPaths.detail(id));

/** First to take wins; anyone else gets 409 `STATE_CONFLICT`. Repeating it as the reviewer is a no-op. */
export const startCorrectionReview = (id: string, version?: number) =>
  api.post<CorrectionDetail>(correctionsPaths.command(id, 'start-review'), version === undefined ? {} : { version });

/** Reviewer or Owner: In review → Submitted. */
export const releaseCorrection = (id: string, version: number) =>
  api.post<CorrectionDetail>(correctionsPaths.command(id, 'release'), { version });

/** "No change needed": already correct, note required. */
export const closeCorrectionNoChange = (id: string, note: string, version: number) =>
  api.post<CorrectionDetail>(correctionsPaths.command(id, 'close-no-change'), { note, version });

/** "Reject request": the request is wrong, reason required (OI-19). */
export const rejectCorrection = (id: string, reason: string, version: number) =>
  api.post<CorrectionDetail>(correctionsPaths.command(id, 'reject'), { reason, version });

/** Requester only, while Submitted or In review. */
export const withdrawCorrection = (id: string, version: number) =>
  api.post<CorrectionDetail>(correctionsPaths.command(id, 'withdraw'), { version });

/**
 * Apply and resolve in one transaction. The edit screen normally uses PATCH with `correctionId` instead; this
 * command is the same save addressed from the request.
 */
export const resolveCorrection = (
  id: string,
  body: { version: number; note?: string; business: Omit<BusinessUpdateInput, 'correctionId' | 'correctionNote'> }
) => api.post<CorrectionDetail>(correctionsPaths.command(id, 'resolve'), body);

/* ---------------- submit (SCR-SHR-009; used by FE3, FE4, FE5) ---------------- */

export const CORRECTION_ISSUE_TYPES = [
  'Incorrect phone',
  'Outdated social link',
  'Missing website information',
  'Wrong category',
  'Wrong business name',
  'Business no longer operating',
  'Other',
] as const;

export interface SubmitCorrectionInput {
  businessId: string;
  issueType: string;
  /** Optional field the issue is about, e.g. `Social account · Instagram`. */
  field: string | null;
  /** "What is wrong?" (required). */
  description: string;
  /** Optional. Checked only when Data Entry applies it. */
  suggestedValue: string | null;
}

export const submitCorrection = (input: SubmitCorrectionInput, idempotencyKey?: string) =>
  api.post<CorrectionRow>(correctionsPaths.create, input, { idempotencyKey });
