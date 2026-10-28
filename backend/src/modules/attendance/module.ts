/** MOD-attendance module definition. Owner: BE1. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerJob } from '../../shared/platform.js';
import { registerResourceResolver } from '../access/schemas.js';
import router from './routes.js';
import { correctionOwner, sessionOwner } from './repo.js';
import { runExceptionCheck } from './service.js';

const definition: ModuleDefinition = {
  name: 'attendance',
  archId: 'MOD-attendance',
  owner: 'BE1',
  mounts: [{ path: '/api/attendance', router }],
  init() {
    // Non-business resources: own-record rule (Owner all, others own), resolved by the owning employee.
    registerResourceResolver('attendance_session', async (db, id) => {
      const owner = await sessionOwner(db, id);
      return owner ? { kind: 'own', ownerIds: [owner] } : null;
    });
    registerResourceResolver('attendance_correction', async (db, id) => {
      const owner = await correctionOwner(db, id);
      return owner ? { kind: 'own', ownerIds: [owner] } : null;
    });
    // J-04 (plan §8): every 5 min. Flags missing checkout / check-in; never closes a session.
    registerJob({
      kind: 'attendance.exception_check',
      schedule: { spec: 'every:300' },
      maxAttempts: 3,
      leaseSeconds: 120,
      async run(ctx) {
        await runExceptionCheck(ctx);
      },
    });
  },
};

export default definition;
