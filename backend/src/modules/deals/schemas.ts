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
//   POST /:id/finalize (Developer)   gate deal.update_stage  -> service: assigned DV and closureMode = direct
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

export const DEAL_STAGES = ['accepted_opportunity', 'signed', 'paid', 'signed_and_paid', 'closed', 'not_proceeding'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const OPEN_DEAL_STAGES = ['accepted_opportunity', 'signed', 'paid', 'signed_and_paid'] as const;

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
  projectStatus: z.enum(['scheduled', 'in_progress', 'waiting_for_client', 'blocked', 'delivered', 'completed', 'none']).optional(),
}).strict();

/** POST /:id/developer - assign or reassign (E2). Active Developer only. */
export const AssignDeveloperBody = z.object({ version: Version, developerId: z.string().uuid() }).strict();

/** POST /:id/signature */
export const RecordSignatureBody = z.object({
  version: Version,
  date: IsoDate,
  reference: Reference,
}).strict();

/** POST /:id/payment. A deposit counts as payment (DEC-018). amount+currency optional, together. */
export const RecordPaymentBody = z.object({
  version: Version,
  date: IsoDate,
  reference: Reference,
  amount: z.number().nonnegative().max(999_999_999_999.99).multipleOf(0.01).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
}).strict().refine((b) => (b.amount === undefined) === (b.currency === undefined), {
  message: 'amount and currency are given together',
  path: ['currency'],
});

/** POST /:id/closure-request (ownerVerify mode only). */
export const ClosureRequestBody = z.object({ version: Version, note: z.string().trim().max(1000).optional() }).strict();
/** POST /:id/closure-verify (Owner verifies AND finalizes in one command). */
export const ClosureVerifyBody = z.object({ version: Version }).strict();
/** POST /:id/closure-reject */
export const ClosureRejectBody = z.object({ version: Version, reason: Reason }).strict();
/** POST /:id/finalize (direct mode: Developer or Owner; ownerVerify mode: Owner directly, "Owner may finalize directly"). */
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
  signature: { date: string; reference: string; recordedById: string; recordedAt: string } | null;
  payment: {
    date: string; reference: string; amount: string | null; currency: string | null;
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
  closure: { closedAt: string; closedById: string; mode: 'ownerVerify' | 'direct' } | null;
  openClosureReview: ClosureReviewDto | null;
  /** Latest rejected review while the stage is still signed_and_paid ("rejected banner"). */
  lastRejectedReview: ClosureReviewDto | null;
  notProceeding: { reason: string; at: string; byId: string } | null;
  /** Derived: Closed deal with no project ("Closed deal without project" / "Project provisioning pending"). */
  projectProvisioning: 'not_applicable' | 'provisioned' | 'pending' | 'failed';
  projectId: string | null;
  /** Policy values in force (each "Demonstration alternative — not approved"). */
  policy: { closureMode: 'ownerVerify' | 'direct'; developerPreClosure: 'assigned' | 'closedOnly'; autoProvision: boolean; label: string };
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
