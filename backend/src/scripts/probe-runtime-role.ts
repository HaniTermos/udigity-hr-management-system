/**
 * UDI-6 verification probe (manual, never in CI): connects with PROBE_DATABASE_URL and prints the
 * runtime-role guard verdict plus the real outcome of statements the app and an attacker would run.
 * Every probe runs in a transaction that is rolled back, each statement under its own savepoint.
 *
 *   PROBE_DATABASE_URL=postgres://udigity_api:…@host:port/db npx tsx src/scripts/probe-runtime-role.ts
 */
import pg from 'pg';
import { runtimeRoleProblems } from '../shared/runtimeRole.js';

const url = process.env.PROBE_DATABASE_URL;
if (!url) {
  console.error('PROBE_DATABASE_URL is required');
  process.exit(2);
}

const PROBES: [string, string][] = [
  ['read employees', 'SELECT count(*) FROM employees'],
  ['insert audit_events', `INSERT INTO audit_events (event_name, entity_type, source_workflow) VALUES ('probe.check', 'probe', 'UDI-6')`],
  ['update audit_events', 'UPDATE audit_events SET event_name = event_name'],
  ['delete audit_events', 'DELETE FROM audit_events'],
  ['truncate audit_events', 'TRUNCATE audit_events'],
  ['disable audit trigger', 'ALTER TABLE audit_events DISABLE TRIGGER ALL'],
  ['create table', 'CREATE TABLE probe_t (id int)'],
  ['drop table', 'DROP TABLE businesses'],
  ['write schema_migrations', 'DELETE FROM schema_migrations'],
  ['create role', 'CREATE ROLE probe_role'],
  ['update company_settings', 'UPDATE company_settings SET updated_at = updated_at'],
];

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const who = await client.query<{ u: string }>('SELECT current_user AS u');
    console.log(`role: ${who.rows[0].u}`);
    const problems = await runtimeRoleProblems(client);
    console.log(problems.length ? `guard: UNSAFE\n  - ${problems.join('\n  - ')}` : 'guard: SAFE (no problems)');
    await client.query('BEGIN');
    for (const [label, sql] of PROBES) {
      await client.query('SAVEPOINT p');
      try {
        await client.query(sql);
        console.log(`  allowed  ${label}`);
        await client.query('RELEASE SAVEPOINT p');
      } catch (err) {
        console.log(`  denied   ${label} (${(err as { code?: string }).code}: ${(err as Error).message.split('\n')[0]})`);
        await client.query('ROLLBACK TO SAVEPOINT p');
      }
    }
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
