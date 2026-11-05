import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { pool, getClient } from './pool.js';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DEV-R5: when MIGRATION_DATABASE_URL is set (outside tests), migrations run as that table-owner role
 * on a short-lived pool; the API/worker pool (DATABASE_URL, restricted `udigity_app` member) is not used.
 */
async function migrationClient(): Promise<{ client: pg.PoolClient; done: () => Promise<void> }> {
  const url = config.db.migrationUrl;
  if (url && url !== config.db.url) {
    const owner = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
    const client = await owner.connect();
    return {
      client,
      done: async () => {
        client.release();
        await owner.end();
      },
    };
  }
  const client = await getClient();
  return { client, done: async () => client.release() };
}

export async function runMigrations() {
  const { client, done } = await migrationClient();
  try {
    console.log('🔄 Checking database connection and migrations...');
    await client.query('BEGIN');

    // Create migrations tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️ Migrations directory not found:', migrationsDir);
      await client.query('COMMIT');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations'
    );
    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    let appliedCount = 0;
    for (const file of files) {
      if (!appliedVersions.has(file)) {
        console.log(`▶ Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        appliedCount++;
        console.log(`✅ Applied migration: ${file}`);
      }
    }

    await client.query('COMMIT');
    if (appliedCount === 0) {
      console.log('✨ Database schema is already up to date.');
    } else {
      console.log(`🎉 Successfully applied ${appliedCount} migration(s).`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await done();
  }
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
