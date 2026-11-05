/**
 * Process-level crash handling for the API and the worker. An unhandled rejection or exception leaves the
 * process in an unknown state, so it logs, records an operator alert (best effort, 3 s cap) and exits with
 * code 1. The container restart policy starts a clean process; open transactions are rolled back by
 * PostgreSQL when the connection drops.
 */
import { pool } from '../db/pool.js';
import { raiseOpsAlert } from './opsAlert.js';

export function exitOnCrash(processName: string): void {
  let exiting = false;
  const crash = (what: string, err: unknown) => {
    if (exiting) return;
    exiting = true;
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`[${processName}] ${what}: ${e.name}: ${e.message}`, e.stack);
    const done = () => {
      void pool.end().catch(() => undefined);
      process.exit(1);
    };
    const timer = setTimeout(done, 3000);
    void raiseOpsAlert(`process.crash:${processName}`, `${processName} ${what} (${e.name}); restarted by the container`).finally(() => {
      clearTimeout(timer);
      done();
    });
  };
  process.on('unhandledRejection', (reason) => crash('unhandled rejection', reason));
  process.on('uncaughtException', (err) => crash('uncaught exception', err));
}
