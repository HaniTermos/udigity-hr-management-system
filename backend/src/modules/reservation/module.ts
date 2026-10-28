/** MOD-reservation module definition. Owner: BE3. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerJob } from '../../shared/platform.js';
import { registerResourceResolver } from '../access/schemas.js';
import router from './routes.js';
import { resolveReservationBusiness, sweepExpired } from './service.js';

const definition: ModuleDefinition = {
  name: 'reservation',
  archId: 'MOD-reservation',
  owner: 'BE3',
  mounts: [
    { path: '/api/reservations', router },
  ],
  init() {
    // R-06: a reservation resolves to its business (BE2-C1).
    registerResourceResolver('reservation', async (db, id) => {
      const businessId = await resolveReservationBusiness(db, id);
      return businessId ? { kind: 'business', businessId } : null;
    });
    // J-05 expiry sweep (plan §8): every 60 s, conditional update = single writer of `contact_reservation.expired`.
    registerJob({
      kind: 'reservation.expiry_sweep',
      schedule: { spec: 'every:60' },
      maxAttempts: 3,
      leaseSeconds: 60,
      async run(ctx) {
        await sweepExpired(ctx);
      },
    });
  },
};

export default definition;
