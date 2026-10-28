/**
 * Runtime DB role privileges (migration 012, AT-2 / DEV-R5) against the real migrations.
 *
 * FX-BE (review 01 F-01): the expected database name comes from TEST_DATABASE_URL (any test DB name
 * works), the migration count from the migration folder (no hard-coded total), and nothing is
 * committed: every privilege probe runs inside a transaction that is rolled back, each denied
 * statement under its own SAVEPOINT. These tests check the grants of the `udigity_app` group role
 * through SET ROLE; the production login role is checked at startup/readiness (F-OPS, F-04).
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '../db/pool.js';
import { assertRuntimeRole, runtimeRoleProblems } from '../shared/runtimeRole.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

/** Run `sql` as udigity_app under a savepoint and return the Postgres error code (null if it succeeded). */
async function errorCodeOf(client: PoolClient, sql: string, params: unknown[] = []): Promise<string | null> {
  await client.query('SAVEPOINT probe');
  try {
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT probe');
    return null;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT probe');
    return (err as { code?: string }).code ?? 'unknown';
  }
}

/** Open a transaction as udigity_app, run `fn`, always roll back. */
async function asAppRole(fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE udigity_app');
    await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

describe.skipIf(!hasTestDb)('Actual Database Connection & Runtime Role Privileges (Real Migrations)', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('determines current_user, session_user, and current_database via backend pool without public routes', async () => {
    const { rows } = await query<{ current_user: string; session_user: string; current_database: string }>(
      'SELECT current_user, session_user, current_database()'
    );
    expect(rows.length).toBe(1);
    expect(rows[0].current_user).toBeTruthy();
    expect(rows[0].session_user).toBeTruthy();
    const expectedDb = decodeURIComponent(new URL(process.env.TEST_DATABASE_URL as string).pathname.replace(/^\//, ''));
    expect(rows[0].current_database).toBe(expectedDb);
  });

  it('confirms every application migration file is recorded on the test database', async () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const { rows } = await query<{ count: string }>('SELECT count(*) FROM schema_migrations');
    expect(Number(rows[0].count)).toBe(files.length);
  });

  it('verifies intended runtime role udigity_app privileges on real operational tables', async () => {
    await asAppRole(async (client) => {
      expect(await errorCodeOf(client, 'SELECT count(*) FROM businesses')).toBeNull();
      const emp = await client.query<{ id: string }>('SELECT id FROM employees LIMIT 1');
      expect(emp.rows.length).toBeGreaterThan(0);
      const ins = await client.query<{ id: string }>(
        `INSERT INTO businesses (name, created_by) VALUES ('Privilege Test Co', $1) RETURNING id`,
        [emp.rows[0].id]
      );
      expect(ins.rows.length).toBe(1);
      const upd = await client.query<{ name: string }>(
        `UPDATE businesses SET name = 'Privilege Test Co Updated' WHERE id = $1 RETURNING name`,
        [ins.rows[0].id]
      );
      expect(upd.rows[0].name).toBe('Privilege Test Co Updated');
    });
  });

  it('verifies udigity_app can INSERT and SELECT on real audit_events but UPDATE, DELETE, and TRUNCATE are prohibited', async () => {
    await asAppRole(async (client) => {
      expect(await errorCodeOf(client, 'SELECT count(*) FROM audit_events')).toBeNull();
      const ins = await client.query<{ id: string }>(
        `INSERT INTO audit_events (event_name, entity_type, payload) VALUES ('privilege.test', 'system', '{"verified": true}') RETURNING id`
      );
      expect(ins.rows.length).toBe(1);
      const auditId = ins.rows[0].id;
      expect(await errorCodeOf(client, `UPDATE audit_events SET payload = '{"tampered": true}' WHERE id = $1`, [auditId])).toBe('42501');
      expect(await errorCodeOf(client, 'DELETE FROM audit_events WHERE id = $1', [auditId])).toBe('42501');
      expect(await errorCodeOf(client, 'TRUNCATE TABLE audit_events')).toBe('42501');
    });
  });

  it('UDI-6 guard: udigity_app passes runtimeRoleProblems; the migrating owner role does not', async () => {
    await asAppRole(async (client) => {
      expect(await runtimeRoleProblems(client)).toEqual([]);
    });
    // The test connection is the table owner (it ran the migrations): exactly what production must refuse.
    const ownerProblems = await runtimeRoleProblems(pool);
    expect(ownerProblems.some((p) => /owns \d+ table/.test(p))).toBe(true);
    await expect(assertRuntimeRole(pool)).rejects.toThrow(/Unsafe database role for production/);
  });

  it('verifies udigity_app is prohibited from ALTER, DROP, or disabling triggers on real tables', async () => {
    await asAppRole(async (client) => {
      expect(await errorCodeOf(client, 'ALTER TABLE audit_events DROP COLUMN payload')).toBe('42501');
      expect(await errorCodeOf(client, 'DROP TABLE audit_events')).toBe('42501');
      expect(await errorCodeOf(client, 'ALTER TABLE audit_events DISABLE TRIGGER ALL')).toBe('42501');
    });
  });
});
