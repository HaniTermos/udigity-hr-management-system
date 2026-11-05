/**
 * Start-up check (Owner 2026-11-05): production must never hold the dev/test seed accounts. The seed publishes
 * their shared password and 2FA test secret in this repository, so their presence means demo data reached
 * production. Logs a loud error naming only the count (never addresses or secrets); it does not stop the API,
 * so the Owner can still sign in and deactivate them. The TOTP check refuses the public test secret separately.
 */
import type { Queryable } from '../db/pool.js';

export const DEMO_EMAIL_DOMAIN = '@udigity.demo';

export async function countDemoAccounts(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM employees WHERE lower(email) LIKE $1`,
    [`%${DEMO_EMAIL_DOMAIN}`]
  );
  return Number(rows[0]?.n ?? 0);
}

export async function warnIfDemoAccounts(db: Queryable, env: string): Promise<number> {
  if (env !== 'production') return 0;
  const n = await countDemoAccounts(db);
  if (n > 0) {
    console.error(
      `[security] ${n} demo account(s) (${DEMO_EMAIL_DOMAIN}) exist in the PRODUCTION database: their password is public. ` +
        'Deactivate them now (Employees) and never run the seed against production.'
    );
  }
  return n;
}
