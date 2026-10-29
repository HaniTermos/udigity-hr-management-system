/**
 * deals API (backend MOD-deals, BE4-C1). Owner: FE5. Screens: SCR-DEV-001/002/008.
 * Source of truth: backend `modules/deals/schemas.ts`. Every command carries `version`; every command also
 * sends the `Idempotency-Key` header (one key per user action, kept across retries). Responses are wrapped:
 * `{ deal }`. Every policy value is "Demonstration alternative — not approved".
 */
import { api, buildQuery, type QueryValue } from './client';
import type { Id, IsoDate, IsoDateTime, AccessLevel } from './types';

export const dealsPaths = {
  list: '/api/deals',
  detail: (id: string) => `/api/deals/${id}`,
  history: (id: string) => `/api/deals/${id}/history`,
  command: (id: string, verb: DealVerb) => `/api/deals/${id}/${verb}`,
} as const;

/**
 * Stored stages (D16 approved: accepted → meeting scheduled → proposal sent → signed → payment pending
 * verification → verified closed; lost = `not_proceeding`). Labels are derived client-side (`DEAL_STAGE_LABEL`).
 */
export type DealStage =
  | 'accepted_opportunity'
  | 'meeting_scheduled'
  | 'proposal_sent'
  | 'signed'
  | 'paid'
  | 'signed_and_paid'
  | 'closed'
  | 'not_proceeding';

/** Forward-only pipeline moves (`advance-stage`). */
export type DealAdvanceTarget = 'meeting_scheduled' | 'proposal_sent';

/** D16 closure evidence still missing on an open deal. */
export type ClosureEvidence = 'agreementReference' | 'paymentDate';

/** `direct` appears only on deals closed before the approved policy retired it. */
export type ClosureMode = 'ownerVerify' | 'direct';

export interface DealListItem {
  id: Id;
  code: string;
  version: number;
  businessId: Id;
  businessName: string | null;
  stage: DealStage;
  acceptedById: Id;
  assignedDeveloperId: Id | null;
  assignedDeveloperName: string | null;
  signatureDate: IsoDate | null;
  paymentDate: IsoDate | null;
  closedAt: IsoDateTime | null;
  projectId: Id | null;
  developerNotAssigned: boolean;
  closureVerificationRequested: boolean;
  /** Stored project status of the deal's project, or null (no project yet). */
  projectStatus: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DealListQuery {
  tab?: 'closed' | 'accepted';
  stage?: DealStage;
  scope?: 'assigned_to_me' | 'all';
  developerId?: string;
  needsAttention?: 'developer_not_assigned' | 'closure_verification_requested';
  closedWithinDays?: number;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'updatedAt' | 'closedAt' | 'code' | 'stage';
  order?: 'asc' | 'desc';
}

/** Path with query for `usePage` / `useApi`. The deal list has no `q` or `projectStatus` filter (BE4-C1 item 6). */
export function dealListPath(q: DealListQuery = {}): string {
  return `${dealsPaths.list}${buildQuery(q as Record<string, QueryValue>)}`;
}

export interface ClosureReview {
  id: Id;
  status: 'requested' | 'verified' | 'rejected';
  requestedById: Id;
  requestedAt: IsoDateTime;
  requestNote: string | null;
  decidedById: Id | null;
  decidedAt: IsoDateTime | null;
  rejectReason: string | null;
}

export interface DealAllowed {
  assignDeveloper: boolean;
  advanceStage: boolean;
  advanceTargets: DealAdvanceTarget[];
  updateContract: boolean;
  /** Owner, verified closed deal. */
  correctFinancials: boolean;
  recordSignature: boolean;
  recordPayment: boolean;
  removeFact: boolean;
  requestClosureVerification: boolean;
  verifyClosure: boolean;
  rejectClosure: boolean;
  finalize: boolean;
  markNotProceeding: boolean;
  reopen: boolean;
  scheduleMeeting: boolean;
}

export type ProjectProvisioningState = 'not_applicable' | 'provisioned' | 'pending' | 'failed';

export interface Deal {
  id: Id;
  code: string;
  version: number;
  businessId: Id;
  businessName: string | null;
  stage: DealStage;
  clientNeedsNote: string;
  acceptedById: Id;
  acceptedByName: string | null;
  assignedDeveloperId: Id | null;
  assignedDeveloperName: string | null;
  developerNotAssigned: boolean;
  facts: {
    /** `reference` = the agreement reference (closure evidence); the date is optional. */
    signature: { date: IsoDate | null; reference: string | null; recordedById: Id; recordedAt: IsoDateTime } | null;
    payment: {
      date: IsoDate;
      reference: string | null;
      amount: string | null;
      currency: string | null;
      recordedById: Id;
      recordedAt: IsoDateTime;
    } | null;
  };
  /** Contract amount, distinct from the payment received. A null amount is missing, never zero. */
  contract: { amount: string | null; currency: string | null };
  /** Closure evidence still missing (empty = ready for Owner verification). */
  closureMissing: ClosureEvidence[];
  closure: { closedAt: IsoDateTime; closedById: Id; mode: ClosureMode } | null;
  openClosureReview: ClosureReview | null;
  lastRejectedReview: ClosureReview | null;
  notProceeding: { reason: string; at: IsoDateTime; byId: Id } | null;
  projectProvisioning: ProjectProvisioningState;
  projectId: Id | null;
  policy: { closureMode: 'ownerVerify'; developerPreClosure: 'assigned' | 'closedOnly'; autoProvision: boolean; label: string };
  /** Drive every button from this: the server recomputes and re-checks on the command. */
  allowed: DealAllowed;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DealResponse {
  deal: Deal;
  access: AccessLevel;
  exceptionRow?: unknown;
}

export interface DealHistoryItem {
  id: Id;
  type: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  actorId: Id | null;
  at: IsoDateTime;
}

export type DealFactKey = 'signature' | 'payment';

export interface DealCommandBodies {
  developer: { developerId: string };
  'advance-stage': { to: DealAdvanceTarget };
  contract: { amount: number | null; currency: string | null };
  signature: { date?: string; reference: string };
  payment: { date: string; reference?: string; amount?: number; currency?: string };
  /** Owner, verified closed deal; only the fields given change. */
  'financial-correction': {
    reason: string;
    agreementReference?: string;
    signatureDate?: string | null;
    paymentDate?: string;
    paymentReference?: string | null;
    paymentAmount?: number | null;
    paymentCurrency?: string | null;
    contractAmount?: number | null;
    contractCurrency?: string | null;
  };
  'remove-fact': { fact: DealFactKey; reason: string };
  'closure-request': { note?: string };
  'closure-verify': Record<string, never>;
  'closure-reject': { reason: string };
  finalize: Record<string, never>;
  'not-proceeding': { reason: string };
  reopen: { reason: string };
}

export type DealVerb = keyof DealCommandBodies;

/** `POST /api/deals/:id/<verb>` with `version` and the required `Idempotency-Key`. Returns the updated deal. */
export async function runDealCommand<V extends DealVerb>(
  id: string,
  verb: V,
  body: DealCommandBodies[V] & { version: number },
  idempotencyKey: string
): Promise<Deal> {
  const res = await api.post<{ deal: Deal }>(dealsPaths.command(id, verb), body, { idempotencyKey });
  return res.deal;
}

/**
 * Payload `details.missing` of a 409 STATE_CONFLICT from `finalize` / closure commands, as the fact to
 * record: `agreementReference` → signature, `paymentDate` → payment (older servers sent the fact names).
 */
export function missingFacts(details: unknown): DealFactKey[] {
  const m = (details as { missing?: unknown } | undefined)?.missing;
  if (!Array.isArray(m)) return [];
  const out: DealFactKey[] = [];
  for (const x of m) {
    if (x === 'agreementReference' || x === 'signature') out.push('signature');
    if (x === 'paymentDate' || x === 'payment') out.push('payment');
  }
  return out;
}
