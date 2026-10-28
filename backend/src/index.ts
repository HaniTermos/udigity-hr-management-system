import { app } from './app.js';
import { config } from './config/index.js';
import { pool } from './db/pool.js';
import { assertRuntimeRole } from './shared/runtimeRole.js';

async function main(): Promise<void> {
  // UDI-6: never serve production traffic as the owner/superuser role.
  if (config.isProduction) await assertRuntimeRole(pool);

  const server = app.listen(config.port, () => {
    console.log(`🚀 Udigity Backend Server running on port ${config.port} (${config.env})`);
    console.log(`📡 App origin(s): ${config.appOrigins.join(', ')}`);
  });

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
