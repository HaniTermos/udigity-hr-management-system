/**
 * BE1 environment reader (identity / admin). Owner: BE1.
 *
 * Why this file exists: `config/index.ts` is Tech-Lead owned. These keys are BE1's and are read
 * here, once, at startup, with the same fail-closed rules as config (REQUEST posted to TL to fold
 * this into config/index.ts; the exported loader is pure so it can move unchanged).
 *
 * Keys:
 * - TOTP_ENC_KEY            32-byte key (base64 or 64 hex chars) for AES-256-GCM encryption of TOTP
 *                           secrets at rest (threat model AU-13). REQUIRED in production.
 * - TOTP_ENC_KEY_ID         id stored next to each ciphertext (default `k1`), for rotation.
 * - TOTP_ENC_PREVIOUS_KEYS  optional `id:key,id:key` list of retired keys (decrypt only).
 * - COMPANY_TIMEZONE, OFFICE_IP_ALLOWLIST, ATTENDANCE_OFFICE_MODE (DEV-R4): DevOps alias names for
 *   the plan.md keys POLICY_COMPANY_TIMEZONE, POLICY_ATTENDANCE_OFFICE_IPS,
 *   POLICY_ATTENDANCE_VERIFICATION_MODE. Used only as the env default when the POLICY_* name is
 *   empty; a value saved by the Owner (company_settings) always wins. Demonstration alternative —
 *   not approved (docs/policy-defaults.md).
 */
import crypto from 'crypto';
import { ConfigError, resolveEnv } from '../../config/index.js';

type Env = Record<string, string | undefined>;

export interface EncryptionKey {
  id: string;
  key: Buffer;
}

export interface Be1Env {
  totp: {
    current: EncryptionKey;
    /** current + previous keys, by id (decrypt). */
    keyring: Map<string, EncryptionKey>;
    /** True when the dev/test fallback key is in use (never in production). */
    devFallback: boolean;
  };
  aliases: {
    companyTimezone: string;
    officeIps: string[];
    verificationMode: string;
  };
}

const KEY_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
export const VERIFICATION_MODES = ['ip', 'geofence', 'ipOrLocation', 'ipAndLocation', 'disabled'] as const;

function parseKey(name: string, raw: string): Buffer {
  const v = raw.trim();
  let buf: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) buf = Buffer.from(v, 'hex');
  else if (/^[A-Za-z0-9+/_-]{43,44}={0,1}$/.test(v)) buf = Buffer.from(v.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (!buf || buf.length !== 32) throw new ConfigError(`${name} must be 32 random bytes (base64 or 64 hex characters)`);
  return buf;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function loadBe1Env(env: Env): Be1Env {
  const isProduction = resolveEnv(env.NODE_ENV) === 'production';

  // --- TOTP encryption key (AU-13) ---------------------------------------------------------
  const keyring = new Map<string, EncryptionKey>();
  let current: EncryptionKey;
  let devFallback = false;
  const rawKey = env.TOTP_ENC_KEY?.trim();
  const keyId = env.TOTP_ENC_KEY_ID?.trim() || 'k1';
  if (!KEY_ID_RE.test(keyId)) throw new ConfigError('TOTP_ENC_KEY_ID must be 1-40 characters [A-Za-z0-9_-]');
  if (rawKey) {
    current = { id: keyId, key: parseKey('TOTP_ENC_KEY', rawKey) };
  } else if (isProduction) {
    throw new ConfigError(
      'TOTP_ENC_KEY is required in production (32 random bytes, base64 or hex). Note: an unset NODE_ENV is treated as production.'
    );
  } else {
    // Development/test only: fixed, public, clearly-named keys (one per environment) so local data
    // survives restarts and the vitest globalSetup process and test workers agree without any .env.
    // Production refuses to start without a real key and never loads these ids.
    const which = resolveEnv(env.NODE_ENV) === 'test' ? 'test-only' : 'dev-only';
    current = { id: which, key: crypto.createHash('sha256').update(`udigity-${which}-totp-key`).digest() };
    devFallback = true;
  }
  if (!isProduction) {
    for (const id of ['dev-only', 'test-only']) {
      if (!keyring.has(id) && id !== current.id) {
        keyring.set(id, { id, key: crypto.createHash('sha256').update(`udigity-${id}-totp-key`).digest() });
      }
    }
  }
  keyring.set(current.id, current);
  for (const part of (env.TOTP_ENC_PREVIOUS_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(':');
    const id = idx > 0 ? part.slice(0, idx) : '';
    if (!KEY_ID_RE.test(id)) throw new ConfigError('TOTP_ENC_PREVIOUS_KEYS must be a comma-separated list of id:key');
    if (keyring.has(id)) throw new ConfigError(`TOTP_ENC_PREVIOUS_KEYS repeats key id ${id}`);
    keyring.set(id, { id, key: parseKey('TOTP_ENC_PREVIOUS_KEYS', part.slice(idx + 1)) });
  }

  // --- DEV-R4 alias names ------------------------------------------------------------------
  const companyTimezone = env.COMPANY_TIMEZONE?.trim() || '';
  if (companyTimezone && !isValidTimeZone(companyTimezone)) {
    throw new ConfigError('COMPANY_TIMEZONE must be an IANA time zone, e.g. Asia/Beirut');
  }
  const officeIps = (env.OFFICE_IP_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  const verificationMode = env.ATTENDANCE_OFFICE_MODE?.trim() || '';
  if (verificationMode && !(VERIFICATION_MODES as readonly string[]).includes(verificationMode)) {
    throw new ConfigError(`ATTENDANCE_OFFICE_MODE must be one of ${VERIFICATION_MODES.join(', ')}`);
  }

  return { totp: { current, keyring, devFallback }, aliases: { companyTimezone, officeIps, verificationMode } };
}

export const be1Env: Be1Env = loadBe1Env(process.env);
