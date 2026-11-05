import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

/**
 * C-09 / F-10: session timeouts for every pooled connection (sent as start-up parameters).
 * - statement_timeout 30 s: the slowest legitimate request query is far below it; exports set their own
 *   15 s per transaction (SET LOCAL) and retention deletes are batched to 2000 rows. A runaway query can
 *   no longer pin one of the 20 connections.
 * - lock_timeout 5 s: waiting for a row/advisory lock (for example the per-employee attendance lock) fails
 *   with 55P03 instead of queueing without bound behind a stuck holder.
 * - idle_in_transaction_session_timeout 60 s: a client that opened BEGIN and stalled (slow export client,
 *   forgotten release) is cut off and its locks freed. No code path holds a transaction idle on purpose
 *   (D-08: external I/O happens outside transactions).
 * Migrations and seeds use getClient(), which lifts them (DDL can legitimately run longer).
 */
export const DB_TIMEOUTS = { statementMs: 30_000, lockMs: 5_000, idleInTransactionMs: 60_000 } as const;

function buildPoolConfig(): pg.PoolConfig {
  const common = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: DB_TIMEOUTS.statementMs,
    lock_timeout: DB_TIMEOUTS.lockMs,
    idle_in_transaction_session_timeout: DB_TIMEOUTS.idleInTransactionMs,
  };
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

/**
 * A client for migrations and seeds: the session timeouts are lifted, and the connection is closed on release
 * (not returned to the pool) so the lifted settings never reach request handling.
 */
export async function getClient() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 0; SET lock_timeout = 0; SET idle_in_transaction_session_timeout = 0');
  } catch (err) {
    client.release(true);
    throw err;
  }
  const release = client.release.bind(client);
  client.release = () => release(true);
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
