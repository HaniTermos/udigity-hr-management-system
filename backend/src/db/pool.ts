import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

function buildPoolConfig(): pg.PoolConfig {
  const common = { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 };
  if (config.db.url) {
    return { ...common, connectionString: config.db.url };
  }
  if (config.env === 'test') {
    // Tests may only use TEST_DATABASE_URL. Without it, point at nothing so no test can
    // reach the development database through DB_* defaults.
    return { ...common, host: '127.0.0.1', port: 1, database: 'no_test_database_configured', user: 'none' };
  }
  return {
    ...common,
    host: config.db.host || 'localhost',
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
  };
}

export const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/** Anything that can run a parameterised query: the pool or a transaction client. */
export interface Queryable {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<pg.QueryResult<T>>;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (config.env === 'development' && duration > 100) {
    console.debug('Executed slow query:', { duration, rows: res.rowCount });
  }
  return res;
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Run `fn` in one transaction. Commits when `fn` resolves, rolls back when it throws.
 * Every command and its audit row go through here (ADR-008: audit in the same transaction).
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
