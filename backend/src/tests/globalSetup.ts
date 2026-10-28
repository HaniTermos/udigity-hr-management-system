/**
 * Vitest global setup. Prepares the dedicated test database ONLY when TEST_DATABASE_URL is set.
 * It never touches the development database: config.ts honours only TEST_DATABASE_URL when NODE_ENV=test.
 */
export default async function setup(): Promise<void | (() => Promise<void>)> {
  process.env.NODE_ENV = 'test';
  if (!process.env.TEST_DATABASE_URL) {
    console.info('[tests] TEST_DATABASE_URL not set: DB-backed API tests are skipped.');
    return;
  }
  const { runMigrations } = await import('../db/migrate.js');
  const { seedDatabase } = await import('../db/seed.js');
  const { pool } = await import('../db/pool.js');
  await runMigrations();
  await seedDatabase();
  return async () => {
    await pool.end();
  };
}
