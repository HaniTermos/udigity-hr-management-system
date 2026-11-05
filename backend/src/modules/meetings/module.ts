/** MOD-meetings module definition. Owner: BE4. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerOutboxConsumer } from '../../shared/outbox.js';
import { registerResourceResolver } from '../access/schemas.js';
import router from './routes.js';
import { cancelScheduledMeetingsForDeal, resolveMeetingBusiness } from './service.js';

const definition: ModuleDefinition = {
  name: 'meetings',
  archId: 'MOD-meetings',
  owner: 'BE4',
  mounts: [{ path: '/api/meetings', router }],
  init() {
    // BE2-C1: a meeting resolves to its deal's business (access through the deal, OI-29).
    registerResourceResolver('meeting', async (db, id) => {
      const businessId = await resolveMeetingBusiness(db, id);
      return businessId ? { kind: 'business', businessId } : null;
    });
    // delivery-design §6: a deal marked Not proceeding cancels its Scheduled meetings (deals never calls meetings).
    registerOutboxConsumer({
      name: 'meetings.cancel_for_deal_not_proceeding',
      events: ['deal.not_proceeding'],
      async handle(ctx, event) {
        await cancelScheduledMeetingsForDeal(ctx, event);
      },
    });
  },
};

export default definition;
