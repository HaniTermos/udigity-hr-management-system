// Database helper for the e2e run (no .env files; everything from the shell).
//   node e2e/scripts/db.mjs reset   drop and recreate the database named in E2E_DB_URL (throwaway DBs only)
//   node e2e/scripts/db.mjs align   make the seed Owner match the persona (rana.haddad@udigity.demo / Rana Haddad)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'backend', 'package.json'));
const pg = require('pg');

const url = process.env.E2E_DB_URL;
const cmd = process.argv[2];
if (!url) { console.error('E2E_DB_URL is not set'); process.exit(2); }
const u = new URL(url);
const dbName = decodeURIComponent(u.pathname.slice(1));
// Refuse anything that is not an obviously throwaway test database on this machine.
if (!/^udigity_test(_[a-z0-9_]+)?$/.test(dbName) || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(u.hostname)) {
  console.error(`refusing to touch ${u.hostname}/${dbName}: only local udigity_test* databases are allowed`);
  process.exit(2);
}

async function withClient(connectionString, fn) {
  const c = new pg.Client({ connectionString });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

if (cmd === 'reset') {
  const admin = new URL(url); admin.pathname = '/postgres';
  await withClient(admin.toString(), async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await c.query(`CREATE DATABASE "${dbName}"`);
  });
  console.log(`database ${dbName} recreated`);
} else if (cmd === 'align') {
  // The e2e seed (backend/src/db/e2e-seed.ts) creates the Owner as udigity@gmail.com; the personas expect Rana Haddad.
  await withClient(url, async (c) => {
    const r = await c.query(
      `UPDATE employees SET email = 'rana.haddad@udigity.demo', full_name = 'Rana Haddad'
        WHERE email = 'udigity@gmail.com' AND NOT EXISTS (SELECT 1 FROM employees WHERE email = 'rana.haddad@udigity.demo')`);
    const o = await c.query(`SELECT email, full_name, role FROM employees WHERE email = 'rana.haddad@udigity.demo'`);
    if (o.rowCount !== 1) throw new Error('owner persona rana.haddad@udigity.demo missing after align');
    console.log(`owner persona ready (${r.rowCount} row renamed): ${o.rows[0].full_name} / ${o.rows[0].role}`);
  });
} else {
  console.error('usage: db.mjs reset|align'); process.exit(2);
}
