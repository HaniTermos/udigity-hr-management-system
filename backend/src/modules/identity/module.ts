/** MOD-identity module definition. Owner: BE1. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerOutboxConsumer } from '../../shared/outbox.js';
import { registerJob } from '../../shared/platform.js';
import { registerSecondFactorVerifier } from '../../shared/access.js';
import { cleanupSessions } from '../platform/retention.js';
import router from './routes.js';
import { revokeSessionsConsumer } from './service.js';

const definition: ModuleDefinition = {
  name: 'identity',
  archId: 'MOD-identity',
  owner: 'BE1',
  mounts: [
    { path: '/api/auth', router },
  ],
  init() {
    registerOutboxConsumer(revokeSessionsConsumer); // E-02
    // FX-ACCESS-R1: a custom role's grantable admin rows run only in a session that verified TOTP.
    registerSecondFactorVerifier((user) => user.sessionState === 'active' && user.secondFactorVerified === true);
    // J-06 (F-14): end expired sessions and delete old ended ones. Hourly, idempotent.
    registerJob({
      kind: 'identity.session_cleanup',
      schedule: { spec: 'every:3600' },
      maxAttempts: 3,
      leaseSeconds: 300,
      async run(ctx) {
        await cleanupSessions(ctx.tx, ctx.now);
      },
    });
  },
};

export default definition;
