/**
 * Delivery policy switches (BE4). Every value here is a pending policy:
 * "Demonstration alternative — not approved (docs/policy-defaults.md)".
 *
 * FLAG values come from the shared registry (`shared/flags.ts`), SET values through BE1 `getSetting`.
 * `deals.reopenTarget` (OQ-15, ORCH-2 item 2) is not in the registry yet: TL REQUEST posted
 * ([BE4-R1]). Until TL adds it, the working default below is used and no env variable is read here.
 *
 * Tests flip branches with `setDeliveryPolicyForTests` (refused outside NODE_ENV=test).
 */
import { config } from '../../config/index.js';
import type { Queryable } from '../../db/pool.js';
import { DEMO_LABEL, flags } from '../../shared/flags.js';
import { getSetting } from '../admin/service.js';

export { DEMO_LABEL };

/** OQ-15: where "Reopen" sends a Not proceeding deal. Default per ORCH-2: `accepted_opportunity`. */
export type ReopenTarget = 'accepted_opportunity' | 'previous_stage';
export const REOPEN_TARGET_DEFAULT: ReopenTarget = 'accepted_opportunity';

export interface DeliveryPolicy {
  /** DEC-005 `deals.developerPreClosure`. */
  developerPreClosure: 'assigned' | 'closedOnly';
  /** DEC-006 `deals.closureMode`. D16 (approved): only Owner verification closes; `direct` is retired. */
  closureMode: 'ownerVerify';
  /** F2 `projects.autoProvision`. */
  autoProvision: boolean;
  /** OQ-15 (pending registry key `deals.reopenTarget`). */
  reopenTarget: ReopenTarget;
}

let overrides: Partial<DeliveryPolicy> = {};

export function deliveryPolicy(): DeliveryPolicy {
  return {
    developerPreClosure: flags['deals.developerPreClosure'],
    closureMode: flags['deals.closureMode'],
    autoProvision: flags['projects.autoProvision'],
    reopenTarget: REOPEN_TARGET_DEFAULT,
    ...overrides,
  };
}

/** Test hook: both branches of every flag are exercised by the BE4 API tests. */
export function setDeliveryPolicyForTests(next: Partial<DeliveryPolicy>): void {
  if (config.env !== 'test') throw new Error('setDeliveryPolicyForTests is available only in tests');
  overrides = { ...next };
}

/** DEC-018 `deals.currencies` (SET, NEEDS VALUE): empty list = "Not configured / policy pending". */
export async function dealCurrencies(db: Queryable): Promise<string[]> {
  const v = await getSetting(db, 'deals.currencies');
  return Array.isArray(v) ? v.map((c) => String(c).toUpperCase()) : [];
}
