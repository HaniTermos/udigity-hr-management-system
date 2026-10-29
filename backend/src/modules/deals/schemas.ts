/**
 * MOD-deals - Zod request schemas (.strict()), DTO types and VT-3 action declarations. Owner: BE4.
 * Status: Increment 5 (live). Design: docs/implementation/delivery-design.md.
 * Policies behind flags (deals.developerPreClosure, deals.closureMode, deals.currencies) are
 * "Demonstration alternative - not approved (docs/policy-defaults.md)".
 */
import { z } from 'zod';
import { PageQuerySchema } from '../../shared/pagination.js';
import { defineMatrixActions } from '../access/schemas.js';

// ---------------------------------------------------------------------------
// VT-3 actions: names and roles come from docs/security/authz-matrix.md §3.8 (BE2-C1 harness, no drift).
// Resource-level rules (assigned Developer, DEC-005, DEC-006, Owner only) are access.check + service guards.
// Commands with no matrix row use the nearest matrix action as the route gate and the service narrows
// the actor (Security REQUEST [BE4-R2]):
//   POST /:id/remove-fact            gate deal.update_stage  -> service: Owner only
//   POST /:id/advance-stage          gate deal.update_stage  -> service: Owner or assigned DV, forward only (D16)
//   POST /:id/contract               gate deal.update_stage  -> service: Owner or assigned DV, open deals (D16)
//   POST /:id/financial-correction   gate deal.finalize      -> service: Owner, closed deals, reason (D16)
//   POST /api/meetings/:id/cancel    gate meeting.reschedule
//   POST /api/projects (manual F2)   gate deal.update_stage  -> service: Owner or the deal's assigned DV
// ---------------------------------------------------------------------------
export const DEAL_ACTIONS = defineMatrixActions([
  'deal.read',
  'deal.list_closed',
  'deal.assign_developer',
  'deal.update_stage',
  'deal.record_signature',
  'deal.record_payment',
  'deal.request_closure_verification',
  'deal.verify_closure',
  'deal.finalize',
  'deal.reject_closure',
  'deal.mark_not_proceeding',
  'deal.reopen_not_proceeding',
] as const);

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
export const IdParam = z.object({ id: z.string().uuid() }).strict();
const Version = z.number().int().min(1);
const Reason = z.string().trim().min(3).max(1000);
const Reference = z.string().trim().min(1).max(200);
/** yyyy-mm-dd, a company-calendar date (never a timestamp). */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
/** Query-string boolean: only "true" / "false" (z.coerce.boolean would read "false" as true). */
export const BoolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

/**
 * D16 (approved): accepted → meeting scheduled → proposal sent → signed → payment pending verification →
 * verified closed. "Payment pending verification" is `paid`/`signed_and_paid` with an open closure review
 * (derived, not a stored stage); "Verified closed" = `closed`; "Lost" = `not_proceeding`.
 */
export const DEAL_STAGES = [
  'accepted_opportunity',
  'meeting_scheduled',
  'proposal_sent',
  'signed',
  'paid',
  'signed_and_paid',
  'closed',
  'not_proceeding',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const OPEN_DEAL_STAGES = ['accepted_opportunity', 'meeting_scheduled', 'proposal_sent', 'signed', 'paid', 'signed_and_paid'] as const;
/** Pipeline stages without a recorded fact; `advance-stage` moves between them, forward only. */
export const PIPELINE_STAGES = ['accepted_opportunity', 'meeting_scheduled', 'proposal_sent'] as const;
export const ADVANCE_TARGETS = ['meeting_scheduled', 'proposal_sent'] as const;
export type AdvanceTarget = (typeof ADVANCE_TARGETS)[number];
/** Forward order (skips allowed). Signed and paid facts are order-independent, so both rank 3. */
export const STAGE_RANK: Readonly<Record<DealStage, number>> = Object.freeze({
  accepted_opportunity: 0,
  meeting_scheduled: 1,
  proposal_sent: 2,
  signed: 3,
  paid: 3,
  signed_and_paid: 4,
  closed: 5,
  not_proceeding: -1,
});
/** D16 closure evidence names (stable API values). */
export type ClosureEvidence = 'agreementReference' | 'paymentDate';

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
/** GET /api/deals. `assignedToMe` and `needsAttention` are derived filters. */
export const ListDealsQuery = PageQuerySchema.extend({
  stage: z.enum(DEAL_STAGES).optional(),
  developerId: z.string().uuid().optional(),
  assignedToMe: BoolQuery.optional(),
  needsAttention: z.enum(['developer_not_assigned', 'closure_verification_requested']).optional(),
  tab: z.enum(['closed', 'accepted']).optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  /** FE5 alias: `assigned_to_me` = assignedToMe=true. */
  scope: z.enum(['assigned_to_me', 'all']).optional(),
  /** Closed in the last N days (Developer closed-deals list). */
  closedWithinDays: z.coerce.number().int().min(1).max(3660).optional(),
  /** FX-BE-C5: deal code or business name contains (case-insensitive), 2..80 chars. */
  q: z.string().trim().min(2).max(80).optional(),
  /** FX-BE-C5: project status of the deal's project, or `none` (no project yet). */
  projectStatus: z.enum(['scheduled', 'in_progress', 'waiting_for_client', 'blocked', 'delivered', 'completed', 'cancelled', 'none']).optional(),
}).strict();

/** POST /:id/developer - assign or reassign (E2). Active Developer only. */
export const AssignDeveloperBody = z.object({ version: Version, developerId: z.string().uuid() }).strict();

/** POST /:id/advance-stage - forward-only pipeline move (D16); a backward move is 409. */
export const AdvanceStageBody = z.object({ version: Version, to: z.enum(ADVANCE_TARGETS) }).strict();

/** POST /:id/signature. `reference` = the agreement reference (D16 evidence); the date is optional. */
export const RecordSignatureBody = z.object({
  version: Version,
  date: IsoDate.optional(),
  reference: Reference,
}).strict();

const Amount = z.number().nonnegative().max(999_999_999_999.99).multipleOf(0.01);
const Currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);

/**
 * POST /:id/payment. A first payment or deposit counts (D16). The payment date is evidence; the payment
 * reference is optional. amount+currency optional, together (currency required when an amount exists).
 */
export const RecordPaymentBody = z.object({
  version: Version,
  date: IsoDate,
  reference: Reference.optional(),
  amount: Amount.optional(),
  currency: Currency.optional(),
}).strict().refine((b) => (b.amount === undefined) === (b.currency === undefined), {
  message: 'amount and currency are given together',
  path: ['currency'],
});

/** POST /:id/contract - contract amount on an open deal (D16). `null` clears it (missing, never zero). */
export const ContractBody = z.object({
  version: Version,
  amount: Amount.nullable(),
  currency: Currency.nullable(),
}).strict().refine((b) => (b.amount === null) === (b.currency === null), {
  message: 'amount and currency are given together',
  path: ['currency'],
});

/**
 * POST /:id/financial-correction - Owner, verified closed deal, reason required (D16 "Owner controls
 * verified financial changes"). Only the fields given change; prior values are kept in deal_changes.
 * The evidence (agreement reference, payment date) can be corrected but never removed.
 */
export const FinancialCorrectionBody = z.object({
  version: Version,
  reason: Reason,
  agreementReference: Reference.optional(),
  signatureDate: IsoDate.nullable().optional(),
  paymentDate: IsoDate.optional(),
  paymentReference: Reference.nullable().optional(),
  paymentAmount: Amount.nullable().optional(),
  paymentCurrency: Currency.nullable().optional(),
  contractAmount: Amount.nullable().optional(),
  contractCurrency: Currency.nullable().optional(),
}).strict();
export type FinancialCorrectionInput = z.infer<typeof FinancialCorrectionBody>;

/** POST /:id/closure-request (ownerVerify mode only). */
export const ClosureRequestBody = z.object({ version: Version, note: z.string().trim().max(1000).optional() }).strict();
/** POST /:id/closure-verify (Owner verifies AND finalizes in one command). */
export const ClosureVerifyBody = z.object({ version: Version }).strict();
/** POST /:id/closure-reject */
export const ClosureRejectBody = z.object({ version: Version, reason: Reason }).strict();
/** POST /:id/finalize - Owner only: "The Owner may record and verify closure directly" (D16). */
export const FinalizeBody = z.object({ version: Version }).strict();

/** POST /:id/not-proceeding */
export const NotProceedingBody = z.object({ version: Version, reason: Reason }).strict();
/** POST /:id/reopen - Not proceeding -> Accepted opportunity, Owner only (OQ-15). */
export const ReopenBody = z.object({ version: Version, reason: Reason }).strict();

/** POST /:id/remove-fact - Owner, before closure; reason required (SM-COMMERCIAL-001 "Recorded fact removed"). */
export const RemoveFactBody = z.object({ version: Version, fact: z.enum(['signature', 'payment']), reason: Reason }).strict();

// ---------------------------------------------------------------------------
// Internal service input (E5, called by MOD-calls inside its transaction; not an HTTP schema)
// ---------------------------------------------------------------------------
export interface CreateAcceptedOpportunityInput {
  businessId: string;
  callAttemptId: string;
  acceptingAgentId: string;
  clientNeedsNote: string;
  developerId?: string;
}

// ---------------------------------------------------------------------------
// Response DTOs (camelCase)
// ---------------------------------------------------------------------------
export interface DealFactsDto {
  /** `reference` is the agreement reference (D16 evidence); the date is optional. */
  signature: { date: string | null; reference: string | null; recordedById: string; recordedAt: string } | null;
  payment: {
    date: string; reference: string | null; amount: string | null; currency: string | null;
    recordedById: string; recordedAt: string;
  } | null;
}

export interface ClosureReviewDto {
  id: string;
  status: 'requested' | 'verified' | 'rejected';
  requestedById: string;
  requestedAt: string;
  requestNote: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  rejectReason: string | null;
}

/** What the UI may do right now; the server recomputes and re-checks each on the command. */
export interface DealAllowedActions {
  assignDeveloper: boolean;
  /** D16 forward-only pipeline move (accepted → meeting scheduled → proposal sent). */
  advanceStage: boolean;
  /** Pipeline stages this caller may move to now (empty when none). */
  advanceTargets: AdvanceTarget[];
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

export interface DealDto {
  id: string;
  code: string;
  version: number;
  businessId: string;
  businessName: string | null;
  stage: DealStage;
  clientNeedsNote: string;
  acceptedById: string;
  acceptedByName: string | null;
  assignedDeveloperId: string | null;
  assignedDeveloperName: string | null;
  /** Derived (E3). */
  developerNotAssigned: boolean;
  facts: DealFactsDto;
  /** D16: contract amount, distinct from the payment received. A null amount is missing, never zero. */
  contract: { amount: string | null; currency: string | null };
  /** D16 closure evidence still missing (empty = ready for Owner verification). */
  closureMissing: ClosureEvidence[];
  /** `direct` only on rows closed before the approved policy retired that mode. */
  closure: { closedAt: string; closedById: string; mode: 'ownerVerify' | 'direct' } | null;
  openClosureReview: ClosureReviewDto | null;
  /** Latest rejected review while the stage is still signed_and_paid ("rejected banner"). */
  lastRejectedReview: ClosureReviewDto | null;
  notProceeding: { reason: string; at: string; byId: string } | null;
  /** Derived: Closed deal with no project ("Closed deal without project" / "Project provisioning pending"). */
  projectProvisioning: 'not_applicable' | 'provisioned' | 'pending' | 'failed';
  projectId: string | null;
  /** Policy values in force (each "Demonstration alternative — not approved"). */
  policy: { closureMode: 'ownerVerify'; developerPreClosure: 'assigned' | 'closedOnly'; autoProvision: boolean; label: string };
  allowed: DealAllowedActions;
  createdAt: string;
  updatedAt: string;
}

export interface DealListItemDto {
  id: string;
  code: string;
  version: number;
  businessId: string;
  businessName: string | null;
  stage: DealStage;
  acceptedById: string;
  assignedDeveloperId: string | null;
  assignedDeveloperName: string | null;
  signatureDate: string | null;
  paymentDate: string | null;
  closedAt: string | null;
  projectId: string | null;
  developerNotAssigned: boolean;
  closureVerificationRequested: boolean;
  projectStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

/** CC-007 opportunities list row (read op for BE3 `GET /api/calling/opportunities`). */
export interface OpportunityDto {
  dealId: string;
  code: string;
  businessId: string;
  businessName: string | null;
  stage: DealStage;
  acceptedById: string;
  acceptedAt: string;
  assignedDeveloperId: string | null;
  assignedDeveloperName: string | null;
  developerNotAssigned: boolean;
  notProceedingReason: string | null;
  updatedAt: string;
}

/** Read op for BE3 re-queue (B3-Q12): the latest Not proceeding deal of a business without a newer open deal. */
export interface NotProceedingDealDto {
  dealId: string;
  businessId: string;
  reason: string;
  at: string;
  byId: string;
}
