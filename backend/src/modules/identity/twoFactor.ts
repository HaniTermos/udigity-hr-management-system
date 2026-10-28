/**
 * Owner 2FA persistence and rules (SEC-3: threat model AU-8, AU-9, AU-13). Owner: BE1.
 * Every function takes the caller's Queryable so it runs inside the caller's transaction.
 *
 * Never log, audit or put into outbox payloads: TOTP secrets, enrollment tokens, recovery codes.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Queryable } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { be1Env } from './env.js';
import { openSecret, sealSecret } from './secretBox.js';

// ---------------------------------------------------------------------------
// AU-13: encrypted TOTP secret
// ---------------------------------------------------------------------------

export interface FactorSecretRow {
  id: string;
  employee_id: string;
  secret: string | null;
  secret_ciphertext: string | null;
  secret_key_id: string | null;
}

/**
 * Decrypt the factor secret. A legacy plaintext secret (rows written before migration 010) is
 * encrypted with the current key and the plaintext cleared in the same transaction. A ciphertext
 * under a retired key is re-encrypted under the current key (rotation).
 */
export async function readFactorSecret(db: Queryable, row: FactorSecretRow): Promise<string> {
  if (row.secret_ciphertext && row.secret_key_id) {
    const plain = openSecret({ ciphertext: row.secret_ciphertext, keyId: row.secret_key_id }, row.employee_id, be1Env.totp.keyring);
    if (row.secret_key_id !== be1Env.totp.current.id || row.secret !== null) await writeSealed(db, row.id, row.employee_id, plain);
    return plain;
  }
  if (row.secret) {
    await writeSealed(db, row.id, row.employee_id, row.secret);
    return row.secret;
  }
  throw new Error('Factor has no secret');
}

async function writeSealed(db: Queryable, factorId: string, employeeId: string, plain: string): Promise<void> {
  const sealed = sealSecret(plain, employeeId, be1Env.totp.current);
  await db.query(
    `UPDATE two_factor_factors SET secret_ciphertext = $2, secret_key_id = $3, secret = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [factorId, sealed.ciphertext, sealed.keyId]
  );
}

/**
 * Store a new (not yet enrolled) secret for an Owner, encrypted. Returns false when a factor is
 * already enrolled (re-enrollment is not possible through this path).
 */
export async function storePendingSecret(
  db: Queryable,
  employeeId: string,
  secret: string,
  enrollmentTokenId: string
): Promise<boolean> {
  const sealed = sealSecret(secret, employeeId, be1Env.totp.current);
  const { rowCount } = await db.query(
    `
    INSERT INTO two_factor_factors (employee_id, factor_type, secret, secret_ciphertext, secret_key_id, is_enrolled, pending_enrollment_token_id)
    VALUES ($1, 'totp', NULL, $2, $3, false, $4)
    ON CONFLICT (employee_id) DO UPDATE
      SET secret = NULL, secret_ciphertext = EXCLUDED.secret_ciphertext, secret_key_id = EXCLUDED.secret_key_id,
          pending_enrollment_token_id = EXCLUDED.pending_enrollment_token_id,
          last_used_step = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE two_factor_factors.is_enrolled = false;
    `,
    [employeeId, sealed.ciphertext, sealed.keyId, enrollmentTokenId]
  );
  return (rowCount ?? 0) > 0;
}

/** Store an already-enrolled secret (dev seed only). */
export async function storeEnrolledSecret(db: Queryable, employeeId: string, secret: string): Promise<void> {
  const sealed = sealSecret(secret, employeeId, be1Env.totp.current);
  await db.query(
    `
    INSERT INTO two_factor_factors (employee_id, factor_type, secret, secret_ciphertext, secret_key_id, is_enrolled, enrolled_at)
    VALUES ($1, 'totp', NULL, $2, $3, true, CURRENT_TIMESTAMP)
    ON CONFLICT (employee_id) DO UPDATE
      SET secret = NULL, secret_ciphertext = EXCLUDED.secret_ciphertext, secret_key_id = EXCLUDED.secret_key_id,
          is_enrolled = true, enrolled_at = COALESCE(two_factor_factors.enrolled_at, CURRENT_TIMESTAMP),
          pending_enrollment_token_id = NULL, updated_at = CURRENT_TIMESTAMP;
    `,
    [employeeId, sealed.ciphertext, sealed.keyId]
  );
}

/** Encrypt every remaining plaintext secret (bootstrap CLI `--encrypt-existing`, seed). Returns the count. */
export async function encryptPlaintextSecrets(db: Queryable): Promise<number> {
  const { rows } = await db.query<FactorSecretRow>(
    `SELECT id, employee_id, secret, secret_ciphertext, secret_key_id FROM two_factor_factors WHERE secret IS NOT NULL FOR UPDATE`
  );
  for (const row of rows) await readFactorSecret(db, row);
  return rows.length;
}

// ---------------------------------------------------------------------------
// AU-8: enrollment tokens (security_tokens purpose 'two_factor_enrollment')
// ---------------------------------------------------------------------------

export const ENROLLMENT_TOKEN_TTL_HOURS = 24;

/** High-entropy token: plain SHA-256 is enough and does not couple the CLI to SESSION_SECRET. */
export function hashEnrollmentToken(raw: string): string {
  return crypto.createHash('sha256').update(`2fa-enroll:${raw}`).digest('hex');
}

export interface IssuedEnrollmentToken {
  id: string;
  token: string;
  expiresAt: Date;
}

export async function issueEnrollmentToken(
  db: Queryable,
  input: { employeeId: string; issuedBy: string | null; issuedVia: 'cli' | 'owner_session' | 'seed'; requestedIp?: string | null; now?: Date }
): Promise<IssuedEnrollmentToken> {
  const now = input.now ?? new Date();
  await db.query(
    `UPDATE security_tokens SET superseded_at = CURRENT_TIMESTAMP
     WHERE employee_id = $1 AND purpose = 'two_factor_enrollment' AND used_at IS NULL AND superseded_at IS NULL`,
    [input.employeeId]
  );
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + ENROLLMENT_TOKEN_TTL_HOURS * 3_600_000);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO security_tokens (employee_id, purpose, token_hash, expires_at, requested_ip, issued_by, issued_via)
     VALUES ($1, 'two_factor_enrollment', $2, $3, $4, $5, $6) RETURNING id`,
    [input.employeeId, hashEnrollmentToken(token), expiresAt, input.requestedIp ?? null, input.issuedBy, input.issuedVia]
  );
  return { id: rows[0].id, token, expiresAt };
}

/** Find an open enrollment token for this employee, locked. Returns its id or null. */
export async function findOpenEnrollmentToken(db: Queryable, employeeId: string, raw: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM security_tokens
     WHERE token_hash = $1 AND employee_id = $2 AND purpose = 'two_factor_enrollment'
       AND used_at IS NULL AND superseded_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     FOR UPDATE`,
    [hashEnrollmentToken(raw), employeeId]
  );
  return rows[0]?.id ?? null;
}

/** Lock the bound token by id and consume it. False when it is no longer open (expired, superseded, used). */
export async function consumeEnrollmentTokenById(db: Queryable, tokenId: string, employeeId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE security_tokens SET used_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND employee_id = $2 AND purpose = 'two_factor_enrollment'
       AND used_at IS NULL AND superseded_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
    [tokenId, employeeId]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// AU-9: recovery codes (bcrypt, single use, shown once)
// ---------------------------------------------------------------------------

// No 0/o/1/l/i to avoid transcription errors. 10 chars * log2(31) ≈ 49.5 bits per code.
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const RECOVERY_LEN = 10;


export function generateRecoveryCode(): string {
  let out = '';
  // crypto.randomInt is uniform (rejection sampling inside).
  for (let i = 0; i < RECOVERY_LEN; i++) out += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/** Accepts the code with or without the dash, any case, surrounding spaces. */
export function normalizeRecoveryCode(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/[\s-]/g, '');
  if (s.length !== RECOVERY_LEN) return null;
  for (const ch of s) if (!RECOVERY_ALPHABET.includes(ch)) return null;
  return s;
}

/** Supersede the open batch and create `count` new codes. Returns the plaintext codes (show once). */
export async function replaceRecoveryCodes(db: Queryable, employeeId: string, count: number): Promise<string[]> {
  await db.query(
    `UPDATE two_factor_recovery_codes SET superseded_at = CURRENT_TIMESTAMP
     WHERE employee_id = $1 AND used_at IS NULL AND superseded_at IS NULL`,
    [employeeId]
  );
  const batchId = crypto.randomUUID();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateRecoveryCode();
    codes.push(code);
    const hash = await bcrypt.hash(normalizeRecoveryCode(code)!, config.password.recoveryCodeBcryptRounds);
    await db.query(
      'INSERT INTO two_factor_recovery_codes (employee_id, batch_id, code_hash) VALUES ($1, $2, $3)',
      [employeeId, batchId, hash]
    );
  }
  return codes;
}

/** Consume one matching open code. Returns the code row id, or null when nothing matched. */
export async function useRecoveryCode(
  db: Queryable,
  employeeId: string,
  input: string,
  sessionId: string
): Promise<string | null> {
  const normalized = normalizeRecoveryCode(input);
  const { rows } = await db.query<{ id: string; code_hash: string }>(
    `SELECT id, code_hash FROM two_factor_recovery_codes
     WHERE employee_id = $1 AND used_at IS NULL AND superseded_at IS NULL
     ORDER BY created_at FOR UPDATE`,
    [employeeId]
  );
  if (!normalized) return null;
  for (const row of rows) {
    if (await bcrypt.compare(normalized, row.code_hash)) {
      await db.query(
        'UPDATE two_factor_recovery_codes SET used_at = CURRENT_TIMESTAMP, used_session_id = $2 WHERE id = $1 AND used_at IS NULL',
        [row.id, sessionId]
      );
      return row.id;
    }
  }
  return null;
}

export async function countOpenRecoveryCodes(db: Queryable, employeeId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM two_factor_recovery_codes
     WHERE employee_id = $1 AND used_at IS NULL AND superseded_at IS NULL`,
    [employeeId]
  );
  return Number(rows[0]?.n ?? 0);
}
