/** MOD-identity module definition. Owner: BE1. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerOutboxConsumer } from '../../shared/outbox.js';
import { registerJob, type JobHandler } from '../../shared/platform.js';
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
    // transactional: false — each cleanup batch commits on its own (D-05).
    const sessionCleanup: JobHandler = {
      kind: 'identity.session_cleanup',
      schedule: { spec: 'every:3600' },
      maxAttempts: 3,
      leaseSeconds: 300,
      // Commit per batch (FIX-BE-B): every statement in cleanupSessions is a self-contained, idempotent
      // batched UPDATE/DELETE whose predicate is re-evaluated each time, so no outer transaction is needed
      // and an interrupted run just leaves the rest for the next hourly run.
      transactional: false,
      async run(ctx) {
        await cleanupSessions(ctx.tx, ctx.now);
      },
    };
    registerJob(sessionCleanup);
  },
};

export default definition;
