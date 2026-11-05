/** MOD-projects module definition. Owner: BE4. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerOutboxConsumer } from '../../shared/outbox.js';
import { registerJob } from '../../shared/platform.js';
import { registerResourceResolver } from '../access/schemas.js';
import { registerDealProjectInfoProvider } from '../deals/service.js';
import router, { tasksRouter } from './routes.js';
import { handleDealClosed, projectInfoForDeals, resolveProjectBusiness, resolveTaskBusiness, runProvisionRetry } from './service.js';

const definition: ModuleDefinition = {
  name: 'projects',
  archId: 'MOD-projects',
  owner: 'BE4',
  mounts: [
    { path: '/api/projects', router },
    { path: '/api/tasks', router: tasksRouter },
  ],
  init() {
    // BE2-C1: projects and tasks resolve to the project's business (R-06).
    registerResourceResolver('project', async (db, id) => {
      const businessId = await resolveProjectBusiness(db, id);
      return businessId ? { kind: 'business', businessId } : null;
    });
    registerResourceResolver('task', async (db, id) => {
      const businessId = await resolveTaskBusiness(db, id);
      return businessId ? { kind: 'business', businessId } : null;
    });
    // Deal DTOs read project id/status/provisioning through this provider (deals never imports projects).
    registerDealProjectInfoProvider(projectInfoForDeals);
    // E-14 → project provisioning (F2 auto; reads the flag when it handles the event). Uses BE5's relay.
    registerOutboxConsumer({
      name: 'projects.provision',
      events: ['deal.closed'],
      async handle(ctx, event) {
        await handleDealClosed(ctx, event);
      },
    });
    // J-07 provisioning retry (enqueue-only; backoff set by the enqueuing attempt). Uses BE5's JobQueue.
    registerJob({
      kind: 'projects.provision_retry',
      maxAttempts: 3,
      leaseSeconds: 60,
      async run(ctx, job) {
        await runProvisionRetry(ctx, job.payload);
      },
    });
  },
};

export default definition;
