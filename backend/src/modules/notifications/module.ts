/** MOD-notifications module definition. Owner: BE5. */
import { config } from '../../config/index.js';
import { registerOutboxConsumer } from '../../shared/outbox.js';
import { registerJob } from '../../shared/platform.js';
import type { ModuleDefinition } from '../../shared/module.js';
import type { PlatformJobHandler } from '../platform/service.js';
import { registerResourceResolver } from '../access/schemas.js';
import router, { deliveryMonitorRouter, testMailRouter } from './routes.js';
import {
  businessEventsNotificationConsumer,
  dispatchDueDeliveries,
  dispatchDueReminders,
  reminderPlannerConsumer,
  securityEmailConsumer,
} from './service.js';
import { getDelivery } from './repo.js';

/** J-01: reminder dispatch. Runs every 30s. */
const reminderDispatchJob: PlatformJobHandler = {
  kind: 'notifications.reminder_dispatch',
  schedule: { spec: 'every:30' },
  transactional: false,
  maxAttempts: 3,
  leaseSeconds: 120,
  async run() {
    await dispatchDueReminders();
  },
};

/** J-02: email delivery dispatch + retries. Sends outside any transaction (transactional: false). */
const deliveryDispatchJob: PlatformJobHandler = {
  kind: 'notifications.delivery_dispatch',
  schedule: { spec: 'every:30' },
  transactional: false,
  maxAttempts: 3,
  leaseSeconds: 300,
  async run() {
    await dispatchDueDeliveries();
  },
};

const definition: ModuleDefinition = {
  name: 'notifications',
  archId: 'MOD-notifications',
  owner: 'BE5',
  mounts: [
    { path: '/api/notifications', router },
    { path: '/api/delivery-monitor', router: deliveryMonitorRouter },
    // QA-2 mail sink: exists only when NODE_ENV=test.
    ...(config.env === 'test' ? [{ path: '/api/test-support/mail', router: testMailRouter }] : []),
  ],
  init() {
    registerOutboxConsumer(securityEmailConsumer); // E-03
    registerOutboxConsumer(reminderPlannerConsumer); // E-05, E-06
    registerOutboxConsumer(businessEventsNotificationConsumer); // E-07..E-15, BL-03

    registerJob(reminderDispatchJob); // J-01
    registerJob(deliveryDispatchJob); // J-02 (email part)

    registerResourceResolver('notification', async (db, id) => {
      const d = await getDelivery(db, id);
      return d ? { kind: 'own', ownerIds: [d.recipient_id] } : null;
    });
  },
};

export default definition;
