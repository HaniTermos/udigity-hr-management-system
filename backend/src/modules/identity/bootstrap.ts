/**
 * Owner bootstrap / operator 2FA procedure (threat model AU-8, AU-9, SE-4). Owner: BE1.
 *
 * Run on the server by the operator (never over HTTP):
 *   npx tsx src/modules/identity/bootstrap.ts --email owner@company.tld --name "Full Name"
 *       Creates the first Owner if missing, with a random password printed ONCE to this terminal (nothing is
 *       logged elsewhere). The Owner signs in and turns 2FA on in Settings (password re-check, QR code); since
 *       2026-11-05 no enrollment token is printed (one is still recorded internally and simply expires).
 *   npx tsx src/modules/identity/bootstrap.ts --email owner@company.tld --reset-2fa --reason "..."
 *       Operator recovery after the Owner lost the authenticator AND the recovery codes. The operator
 *       verifies identity out of band first. Un-enrolls the factor, voids recovery codes, ends all the
 *       Owner's sessions, issues an enrollment token. Audited (`two_factor.reset_by_operator`).
 *   npx tsx src/modules/identity/bootstrap.ts --encrypt-existing
 *       Encrypts any TOTP secret still stored in plaintext (AU-13 backfill).
 *
 * The enrollment still requires the Owner's password at enroll/start, so a leaked token alone does
 * not enroll anything. (`npm run owner:bootstrap` script requested from TL.)
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { recordAuditEvent } from '../admin/audit.js';
import { endAllSessions } from './sessions.js';
import { encryptPlaintextSecrets, issueEnrollmentToken } from './twoFactor.js';

export interface BootstrapArgs {
  email?: string;
  name?: string;
  reset2fa: boolean;
  reason?: string;
  encryptExisting: boolean;
}

export function parseArgs(argv: string[]): BootstrapArgs {
  const out: BootstrapArgs = { reset2fa: false, encryptExisting: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--reason') out.reason = argv[++i];
    else if (a === '--reset-2fa') out.reset2fa = true;
    else if (a === '--encrypt-existing') out.encryptExisting = true;
    else throw new Error(`Unknown argument ${a}`);
  }
  return out;
}

export type BootstrapResult =
  | { kind: 'created'; employeeId: string; password: string; enrollmentToken: string; expiresAt: Date }
  | { kind: 'token_issued'; employeeId: string; enrollmentToken: string; expiresAt: Date }
  | { kind: 'encrypted'; count: number };

/** 20 random bytes, base64url: ~27 characters. Shown once; the Owner changes it after first sign-in. */
function randomPassword(): string {
  return crypto.randomBytes(20).toString('base64url');
}

const SOURCE = 'CLI-owner-bootstrap';

export async function runBootstrap(args: BootstrapArgs): Promise<BootstrapResult> {
  if (args.encryptExisting) {
    const count = await withTransaction((c) => encryptPlaintextSecrets(c));
    return { kind: 'encrypted', count };
  }
  const email = args.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('--email is required');

  return withTransaction(async (client: PoolClient) => {
    const { rows } = await client.query<{ id: string; role: string; is_active: boolean; is_enrolled: boolean | null }>(
      `SELECT e.id, e.role, e.is_active, f.is_enrolled FROM employees e
       LEFT JOIN two_factor_factors f ON f.employee_id = e.id AND f.factor_type = 'totp'
       WHERE LOWER(e.email) = $1 FOR UPDATE OF e`,
      [email]
    );
    const existing = rows[0];

    if (!existing) {
      const name = args.name?.trim();
      if (!name || name.length > 255) throw new Error('--name is required to create the first Owner');
      const { rows: created } = await client.query<{ id: string }>(
        `INSERT INTO employees (email, full_name, role, is_active) VALUES ($1, $2, 'owner', true) RETURNING id`,
        [email, name]
      );
      const employeeId = created[0].id;
      const password = randomPassword();
      if (Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('Generated bootstrap password exceeds 72 bytes');
      }
      await client.query('INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)', [
        employeeId,
        await bcrypt.hash(password, config.password.bcryptRounds),
      ]);
      const issued = await issueEnrollmentToken(client, { employeeId, issuedBy: null, issuedVia: 'cli' });
      await recordAuditEvent(client, {
        eventName: 'account.created',
        entityType: 'employee',
        entityId: employeeId,
        after: { role: 'owner', isActive: true },
        payload: { via: 'cli' },
        sourceWorkflow: SOURCE,
      });
      await recordAuditEvent(client, {
        eventName: 'two_factor.enrollment_token_issued', // placeholder name; needs approval (G2)
        entityType: 'employee',
        entityId: employeeId,
        payload: { securityTokenId: issued.id, via: 'cli' },
        sourceWorkflow: SOURCE,
      });
      return { kind: 'created', employeeId, password, enrollmentToken: issued.token, expiresAt: issued.expiresAt };
    }

    if (existing.role !== 'owner' || !existing.is_active) throw new Error('That account is not an active Owner');

    if (existing.is_enrolled) {
      if (!args.reset2fa) throw new Error('This Owner already has 2FA enrolled. Use --reset-2fa --reason "..." after verifying identity out of band.');
      const reason = args.reason?.trim();
      if (!reason) throw new Error('--reason is required with --reset-2fa');
      await client.query(
        `UPDATE two_factor_factors SET is_enrolled = false, pending_enrollment_token_id = NULL, last_used_step = NULL,
           failed_count = 0, failed_window_started_at = NULL, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE employee_id = $1`,
        [existing.id]
      );
      await client.query(
        `UPDATE two_factor_recovery_codes SET superseded_at = CURRENT_TIMESTAMP
         WHERE employee_id = $1 AND used_at IS NULL AND superseded_at IS NULL`,
        [existing.id]
      );
      const ended = await endAllSessions(client, existing.id, 'revoked');
      await recordAuditEvent(client, {
        eventName: 'two_factor.reset_by_operator', // placeholder name; needs approval (G2)
        entityType: 'employee',
        entityId: existing.id,
        reason: reason.slice(0, 500),
        payload: { endedSessions: ended.length },
        sourceWorkflow: SOURCE,
      });
    }

    const issued = await issueEnrollmentToken(client, { employeeId: existing.id, issuedBy: null, issuedVia: 'cli' });
    await recordAuditEvent(client, {
      eventName: 'two_factor.enrollment_token_issued', // placeholder name; needs approval (G2)
      entityType: 'employee',
      entityId: existing.id,
      payload: { securityTokenId: issued.id, via: 'cli' },
      sourceWorkflow: SOURCE,
    });
    return { kind: 'token_issued', employeeId: existing.id, enrollmentToken: issued.token, expiresAt: issued.expiresAt };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBootstrap(parseArgs(process.argv.slice(2)))
    .then(async (r) => {
      // Printed once, to the operator's terminal only.
      if (r.kind === 'encrypted') console.log(`Encrypted ${r.count} plaintext TOTP secret(s).`);
      else {
        // Owner 2026-11-05: the Owner turns 2FA on from Settings with a password re-check; no token is handed over.
        if (r.kind === 'created') console.log(`Owner created. Temporary password (shown once): ${r.password}`);
        else console.log('Owner has no 2FA now: they sign in with their password and turn 2FA on in Settings.');
        console.log('Next: sign in, open Settings > Two-factor authentication > Turn on, scan the QR code, then change the');
        console.log('temporary password in Profile. Owner tools stay locked until 2FA is on.');
      }
      await pool.end();
      process.exit(0);
    })
    .catch(async (err: Error) => {
      console.error(`Bootstrap failed: ${err.message}`);
      await pool.end();
      process.exit(1);
    });
}
