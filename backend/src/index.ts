import { app } from './app.js';
import { config } from './config/index.js';
import { pool } from './db/pool.js';
import { assertRuntimeRole } from './shared/runtimeRole.js';
import { exitOnCrash } from './shared/crash.js';
import { warnIfDemoAccounts } from './shared/productionDataCheck.js';

async function main(): Promise<void> {
  // UDI-6: never serve production traffic as the owner/superuser role.
  if (config.isProduction) await assertRuntimeRole(pool);
  // Owner 2026-11-05: loud warning when dev/test seed accounts exist in production (never blocks start-up).
  await warnIfDemoAccounts(pool, config.env).catch((err: Error) => console.error('[security] demo-account check failed:', err.message));

  const server = app.listen(config.port, () => {
    console.log(`🚀 Udigity Backend Server running on port ${config.port} (${config.env})`);
    console.log(`📡 App origin(s): ${config.appOrigins.join(', ')}`);
  });

  // F-09: the bundled nginx keeps upstream connections open (keepalive 16, nginx keepalive_timeout 65 s) and reuses
  // them. Node's default keepAliveTimeout is 5 s, so an idle connection that Node already closed would be reused
  // and fail as an intermittent 502. Keep Node's timeout above every proxy idle timeout (an outer proxy such as
  // OpenLiteSpeed/Apache/Caddy usually idles at 30-75 s); headersTimeout must stay above keepAliveTimeout.
  server.keepAliveTimeout = 75_000;
  server.headersTimeout = 76_000;

  exitOnCrash('api');

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
    });
  });
}

main().catch(async (err) => {
  console.error(`Backend failed to start: ${(err as Error).message}`);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
