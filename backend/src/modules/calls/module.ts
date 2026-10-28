/** MOD-calls module definition. Owner: BE3. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerResourceResolver } from '../access/schemas.js';
import { registerAcquireGuard } from '../reservation/service.js';
import router, { followUpsRouter } from './routes.js';
import { acquireGuard, resolveAttemptBusiness, resolveFollowUpBusiness } from './service.js';

const definition: ModuleDefinition = {
  name: 'calls',
  archId: 'MOD-calls',
  owner: 'BE3',
  mounts: [
    { path: '/api/calling', router },
    { path: '/api/follow-ups', router: followUpsRouter },
  ],
  init() {
    // R-06: follow-ups and attempts resolve to their business (BE2-C1).
    registerResourceResolver('follow_up', async (db, id) => {
      const businessId = await resolveFollowUpBusiness(db, id);
      return businessId ? { kind: 'business', businessId } : null;
    });
    registerResourceResolver('call_attempt', async (db, id) => {
      const businessId = await resolveAttemptBusiness(db, id);
      return businessId ? { kind: 'business', businessId } : null;
    });
    // Step 9 for reservation acquire (not Rejected, not archived): MOD-calls owns the calling state.
    registerAcquireGuard(acquireGuard);
  },
};

export default definition;
