/**
 * MOD-calls — adapter to MOD-deals (BE4). Owner: BE3.
 *
 * ORCH-4 (d): calls invokes BE4 `createAcceptedOpportunity(ctx, …)` inside the attempt transaction
 * (E5, DEC-017) and two BE4 read ops: `listOpportunities` for CC-007 and `findNotProceedingDeal` /
 * `findOpenDeal` for the Owner re-queue (B3-Q12). The port keeps one seam for tests
 * (`setOpportunityPort`, NODE_ENV=test only), e.g. to prove the attempt rolls back when the deal insert fails.
 */
import type { Queryable } from '../../db/pool.js';
import { config } from '../../config/index.js';
import type { Principal } from '../../shared/access.js';
import { stateConflict } from '../../shared/errors.js';
import type { PageResult } from '../../shared/pagination.js';
import type { CommandContext } from '../../shared/tx.js';
import { createAcceptedOpportunity, findNotProceedingDeal, findOpenDeal, listOpportunities } from '../deals/service.js';
import type { OpportunityDto } from '../deals/schemas.js';

export type { OpportunityDto } from '../deals/schemas.js';

export interface AcceptedOpportunityInput {
  businessId: string;
  callAttemptId: string;
  acceptingAgentId: string;
  clientNeedsNote: string;
  developerId?: string;
}

export interface OpportunityPort {
  /**
   * E5: create the Accepted opportunity in the caller's transaction. DEC-017: an open deal already
   * exists → 409 STATE_CONFLICT with `details.dealId` and the whole save rolls back.
   */
  createAcceptedOpportunity(ctx: CommandContext, input: AcceptedOpportunityInput): Promise<{ dealId: string; developerAssigned: boolean }>;
  /** CC-007 read op: deals visible to the caller (BE4 applies scopeFilter on `deal.read`). */
  listOpportunities(
    db: Queryable,
    principal: Principal,
    q: { page: number; pageSize: number; developerAssigned?: boolean; mine?: boolean; openOnly?: boolean }
  ): Promise<PageResult<OpportunityDto>>;
  /** B3-Q12 guard: the business's latest deal is Not proceeding and no open deal exists. */
  dealIsNotProceeding(db: Queryable, businessId: string): Promise<boolean>;
}

export const deals4Port: OpportunityPort = {
  async createAcceptedOpportunity(ctx, input) {
    const open = await findOpenDeal(ctx.tx, input.businessId);
    if (open) throw stateConflict('This business already has an open deal', { reason: 'open_deal', dealId: open.dealId, stage: open.stage });
    const r = await createAcceptedOpportunity(ctx, {
      businessId: input.businessId,
      callAttemptId: input.callAttemptId,
      acceptingAgentId: input.acceptingAgentId,
      clientNeedsNote: input.clientNeedsNote,
      ...(input.developerId ? { developerId: input.developerId } : {}),
    });
    return { dealId: r.dealId, developerAssigned: r.developerAssigned };
  },
  listOpportunities(db, principal, q) {
    return listOpportunities(db, principal, q);
  },
  async dealIsNotProceeding(db, businessId) {
    if (await findOpenDeal(db, businessId)) return false;
    return (await findNotProceedingDeal(db, businessId)) !== null;
  },
};

let port: OpportunityPort = deals4Port;

export function opportunities(): OpportunityPort {
  return port;
}

/** Test seam (NODE_ENV=test only). `null` restores the BE4 adapter. */
export function setOpportunityPort(next: OpportunityPort | null): void {
  if (config.env !== 'test') throw new Error('setOpportunityPort is available only when NODE_ENV=test');
  port = next ?? deals4Port;
}
