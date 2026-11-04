/** MOD-platform module definition. Owner: BE5. */
import { config } from '../../config/index.js';
import { registerOutboxWriter } from '../../shared/outbox.js';
import { registerJob, registerJobQueue } from '../../shared/platform.js';
import type { ModuleDefinition } from '../../shared/module.js';
import { healthRouter, testSupportRouter } from './routes.js';
import { retentionPurge } from './retention.js';
import { beat, jobQueue, outboxWriter, relayOutboxOnce, type PlatformJobHandler } from './service.js';

const relayJob: PlatformJobHandler = {
  kind: 'platform.outbox_relay',
  transactional: false,
  maxAttempts: 1,
  leaseSeconds: 60,
  async run() {
    await relayOutboxOnce();
  },
};

const definition: ModuleDefinition = {
  name: 'platform',
  archId: 'MOD-platform',
  owner: 'BE5',
  mounts: [
    { path: '/health/worker', router: healthRouter },
    // QA-2: test clock + job runner. Exists only when NODE_ENV=test (never dev/production).
    ...(config.env === 'test' ? [{ path: '/api/test-support', router: testSupportRouter }] : []),
  ],
  init() {
    registerOutboxWriter(outboxWriter);
    registerJobQueue(jobQueue);
    // J-03: the worker polls the relay every 2 s directly (no job rows per poll); registered as a
    // kind so tests and ops can run it on demand.
    registerJob(relayJob);
    // J-09: heartbeat for /health/worker.
    registerJob({
      kind: 'platform.heartbeat',
      schedule: { spec: 'every:60' },
      maxAttempts: 1,
      leaseSeconds: 30,
      async run(ctx) {
        await beat(ctx.tx);
      },
    });
    // J-12 (F-14): retention purge by the retention.* windows. Every 6 h (works without company.timezone).
    // D-05: transactional: false, so every batch of the purge commits on its own (short locks).
    const retentionJob: PlatformJobHandler = {
      kind: 'platform.retention_purge',
      schedule: { spec: 'every:21600' },
      transactional: false,
      maxAttempts: 3,
      leaseSeconds: 900,
      async run(ctx) {
        await retentionPurge(ctx.tx, ctx.now);
      },
    };
    registerJob(retentionJob);
  },
};

export default definition;
