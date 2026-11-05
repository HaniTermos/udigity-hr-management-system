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
  runDailyDigests,
  securityEmailConsumer,
} from './service.js';
import { getDelivery } from './repo.js';
import { sendOpsAlerts } from './opsAlerts.js';

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

/**
 * J-13 (D18): shift-start digests (agent follow-ups due today; Owner morning digest). Every 5 min like
 * J-04; sends only from the Owner-saved shift start on scheduled working days, once per recipient per day.
 */
const dailyDigestJob: PlatformJobHandler = {
  kind: 'notifications.daily_digest',
  schedule: { spec: 'every:300' },
  maxAttempts: 3,
  leaseSeconds: 120,
  async run(ctx) {
    await runDailyDigests(ctx);
  },
};

/** J-14: email operator failure alerts (ops_alerts) to ALERT_EMAIL_TO; no address set = nothing sent. */
const opsAlertsJob: PlatformJobHandler = {
  kind: 'notifications.ops_alerts',
  schedule: { spec: 'every:60' },
  transactional: false, // D-08: SMTP sends never run inside an open transaction
  maxAttempts: 3,
  leaseSeconds: 180,
  async run() {
    await sendOpsAlerts();
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
    registerJob(dailyDigestJob); // J-13 (D18 digests)
    registerJob(opsAlertsJob); // J-14 (operator failure alerts)

    registerResourceResolver('notification', async (db, id) => {
      const d = await getDelivery(db, id);
      return d ? { kind: 'own', ownerIds: [d.recipient_id] } : null;
    });
  },
};

export default definition;
