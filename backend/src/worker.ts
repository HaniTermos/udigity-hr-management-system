/**
 * Worker process (plan §8; ADR-004/011). Owner: BE5. Run: `npm run worker` (node dist/worker.js),
 * dev: `npx tsx src/worker.ts`. One container next to `api`; a second instance is safe (SKIP LOCKED,
 * (kind, slot) uniqueness), but one is the deployment.
 *
 * Loop (every 2 s): J-03 outbox relay → scheduler tick (inserts due (kind, slot) rows) → due jobs.
 * J-09 heartbeat runs through the scheduler every 60 s; a first beat is written at start-up.
 * Email: refuses to start with a real SMTP transport unless EMAIL_ALLOW_REAL_SEND=true. Production without
 * any real transport starts (the other jobs must run) with a loud ERROR line, and J-02 records every
 * email as failed ("email transport not configured") on the Delivery monitor instead of sending it.
 */
import { config } from './config/index.js';
import { pool } from './db/pool.js';
import { initModules } from './modules/index.js';
import { assertEmailConfigSafe, describeEmailConfig, emailDeliveryWarning, loadEmailConfig } from './modules/notifications/emailConfig.js';
import { beat, companyTimezone, errorSummary, LOOP_BUDGET_MS, relayOutboxOnce, runDueJobs, schedulerTick, WORKER_ID } from './modules/platform/service.js';
import { assertRuntimeRole } from './shared/runtimeRole.js';
import { exitOnCrash } from './shared/crash.js';

const POLL_MS = 2000;
/** F-12: the heartbeat has its own timer, so a slow consumer or SMTP send never makes the worker look dead. */
const HEARTBEAT_MS = 30_000;
let heartbeatTimer: NodeJS.Timeout | null = null;

let stopping = false;
let timer: NodeJS.Timeout | null = null;
let running: Promise<void> | null = null;

async function iteration(): Promise<void> {
  try {
    await relayOutboxOnce({ budgetMs: LOOP_BUDGET_MS });
  } catch (err) {
    console.error(`[worker] relay error: ${errorSummary(err)}`);
  }
  try {
    await schedulerTick(await companyTimezone());
    await runDueJobs(undefined, 20, { budgetMs: LOOP_BUDGET_MS });
  } catch (err) {
    console.error(`[worker] jobs error: ${errorSummary(err)}`);
  }
}

function schedule(): void {
  if (stopping) return;
  timer = setTimeout(() => {
    running = iteration().finally(() => {
      running = null;
      schedule();
    });
  }, POLL_MS);
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.info(`[worker] ${signal} received: finishing current iteration`);
  if (timer) clearTimeout(timer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (running) await running.catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.exit(0);
}

async function main(): Promise<void> {
  const emailCfg = loadEmailConfig(process.env);
  assertEmailConfigSafe(emailCfg);
  // UDI-6: the worker writes too; it must connect as the limited app role in production.
  if (config.isProduction) await assertRuntimeRole(pool);
  initModules();
  console.info(`[worker] ${WORKER_ID} starting (${config.env}); ${describeEmailConfig(emailCfg)}`);
  const emailWarning = emailDeliveryWarning(emailCfg);
  if (emailWarning) console.error(`[worker] ${emailWarning}`);
  await beat();
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  exitOnCrash('worker');
  heartbeatTimer = setInterval(() => {
    beat().catch((err) => console.error(`[worker] heartbeat error: ${errorSummary(err)}`));
  }, HEARTBEAT_MS);
  heartbeatTimer.unref();
  schedule();
}

main().catch(async (err) => {
  console.error(`[worker] failed to start: ${errorSummary(err)}`);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
