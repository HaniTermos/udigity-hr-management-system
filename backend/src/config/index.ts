import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root (never in tests: tests must not pick up the dev DB settings)
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

export type AppEnv = 'development' | 'test' | 'production';
export type PendingTwoFactorScope = 'R11-a' | 'R11-b';

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {}

// --- TOTP secret encryption (AU-13) and DEV-R4 aliases (folded in from identity/env.ts, BE1-R1) ----

export interface EncryptionKey {
  id: string;
  key: Buffer;
}

export interface TotpEncryptionConfig {
  current: EncryptionKey;
  /** current + previous keys, by id (decrypt). */
  keyring: Map<string, EncryptionKey>;
  /** True when the dev/test fallback key is in use (never in production). */
  devFallback: boolean;
}

/** DEV-R4: DevOps alias names, used only when the plan.md POLICY_* key is empty (BE1 `getSetting`). */
export interface PolicyEnvAliases {
  /** COMPANY_TIMEZONE → POLICY_COMPANY_TIMEZONE */
  companyTimezone: string;
  /** OFFICE_IP_ALLOWLIST → POLICY_ATTENDANCE_OFFICE_IPS */
  officeIps: string[];
  /** ATTENDANCE_OFFICE_MODE → POLICY_ATTENDANCE_VERIFICATION_MODE */
  verificationMode: string;
}

const KEY_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
export const VERIFICATION_MODES = ['ip', 'geofence', 'ipOrLocation', 'ipAndLocation', 'disabled'] as const;

function parseEncryptionKey(name: string, raw: string): Buffer {
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

function devKey(id: string): EncryptionKey {
  return { id, key: crypto.createHash('sha256').update(`udigity-${id}-totp-key`).digest() };
}

/**
 * TOTP_ENC_KEY (32 bytes, base64 or hex), TOTP_ENC_KEY_ID (default `k1`), TOTP_ENC_PREVIOUS_KEYS
 * (`id:key,…`, decrypt only). Production refuses to start without TOTP_ENC_KEY. Development/test use
 * fixed, public, clearly named keys (`dev-only` / `test-only`) that production never loads.
 */
export function loadTotpEncryption(env: Env): TotpEncryptionConfig {
  const appEnv = resolveEnv(env.NODE_ENV);
  const isProduction = appEnv === 'production';
  const keyring = new Map<string, EncryptionKey>();
  let current: EncryptionKey;
  let devFallback = false;
  const rawKey = env.TOTP_ENC_KEY?.trim();
  const keyId = env.TOTP_ENC_KEY_ID?.trim() || 'k1';
  if (!KEY_ID_RE.test(keyId)) throw new ConfigError('TOTP_ENC_KEY_ID must be 1-40 characters [A-Za-z0-9_-]');
  if (rawKey) {
    current = { id: keyId, key: parseEncryptionKey('TOTP_ENC_KEY', rawKey) };
  } else if (isProduction) {
    throw new ConfigError(
      'TOTP_ENC_KEY is required in production (32 random bytes, base64 or hex). Note: an unset NODE_ENV is treated as production.'
    );
  } else {
    current = devKey(appEnv === 'test' ? 'test-only' : 'dev-only');
    devFallback = true;
  }
  if (!isProduction) {
    for (const id of ['dev-only', 'test-only']) {
      if (id !== current.id) keyring.set(id, devKey(id));
    }
  }
  keyring.set(current.id, current);
  for (const part of (env.TOTP_ENC_PREVIOUS_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(':');
    const id = idx > 0 ? part.slice(0, idx) : '';
    if (!KEY_ID_RE.test(id)) throw new ConfigError('TOTP_ENC_PREVIOUS_KEYS must be a comma-separated list of id:key');
    if (keyring.has(id)) throw new ConfigError(`TOTP_ENC_PREVIOUS_KEYS repeats key id ${id}`);
    keyring.set(id, { id, key: parseEncryptionKey('TOTP_ENC_PREVIOUS_KEYS', part.slice(idx + 1)) });
  }
  return { current, keyring, devFallback };
}

/** DEV-R4 aliases, validated. Demonstration alternative — not approved (docs/policy-defaults.md). */
export function loadPolicyEnvAliases(env: Env): PolicyEnvAliases {
  const companyTimezone = env.COMPANY_TIMEZONE?.trim() || '';
  if (companyTimezone && !isValidTimeZone(companyTimezone)) {
    throw new ConfigError('COMPANY_TIMEZONE must be an IANA time zone, e.g. Asia/Beirut');
  }
  const officeIps = (env.OFFICE_IP_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  const verificationMode = env.ATTENDANCE_OFFICE_MODE?.trim() || '';
  if (verificationMode && !(VERIFICATION_MODES as readonly string[]).includes(verificationMode)) {
    throw new ConfigError(`ATTENDANCE_OFFICE_MODE must be one of ${VERIFICATION_MODES.join(', ')}`);
  }
  return { companyTimezone, officeIps, verificationMode };
}

/**
 * FX-MAIL: base of every link in security emails (invitation / password reset). Taken from config only
 * (PUBLIC_APP_URL, else the first APP_ORIGIN), never from request headers. It must be a bare origin:
 * absolute, no credentials, path, query or fragment (one trailing `/` is tolerated). Production also
 * requires https. Returns the normalised origin; a bad value fails start-up (API and worker).
 */
export function resolvePublicAppUrl(raw: string, isProduction: boolean): string {
  const v = raw.trim();
  if (!v) {
    if (isProduction) throw new ConfigError('PUBLIC_APP_URL (or APP_ORIGIN) is required in production: it is the base of email links');
    return '';
  }
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new ConfigError('PUBLIC_APP_URL must be an absolute URL such as https://hrsystem.udigity.com');
  }
  if (u.protocol !== 'https:' && (isProduction || u.protocol !== 'http:')) {
    throw new ConfigError(isProduction ? 'PUBLIC_APP_URL must use https:// in production' : 'PUBLIC_APP_URL must be an http(s) URL');
  }
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' || v.replace(/\/$/, '').toLowerCase() !== u.origin) {
    throw new ConfigError('PUBLIC_APP_URL must be an origin only (scheme and host[:port]; no credentials, path, query or fragment)');
  }
  return u.origin;
}

const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'udigity_dev_session_secret_change_me_in_production_32chars',
  'CHANGE_ME',
]);

/**
 * bcrypt work factor (V-02). Production and development always use `fallback` (the security value).
 * Only NODE_ENV=test may lower it (vitest.config.ts), because bcryptjs runs on the test process's
 * main thread and production-cost hashing pushed the 2FA/reset tests past their 5 s budget.
 */
function bcryptCost(env: Env, appEnv: AppEnv, key: string, fallback: number): number {
  if (appEnv !== 'test') return fallback;
  const value = int(env, key, fallback);
  if (value < 4 || value > 15) throw new ConfigError(`${key} must be between 4 and 15`);
  return value;
}

function int(env: Env, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  // C-14: digits only. parseInt would accept "1.5abc" as 1 and hide a typo.
  const value = /^\s*\d{1,9}\s*$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConfigError(`${key} must be a positive integer`);
  }
  return value;
}

function port(env: Env, key: string, fallback: number): number {
  const value = int(env, key, fallback);
  if (value > 65535) throw new ConfigError(`${key} must be a TCP port (1-65535)`);
  return value;
}

const LOCAL_HOST_RE = /^(localhost|.*\.localhost|127(\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)$/i;

/**
 * C-14: APP_ORIGIN / CORS_ORIGIN entries. The Origin/Referer check compares exact strings, so a trailing slash, an
 * upper-case host or a path would make every browser POST fail with ORIGIN_REJECTED while /readyz stays green.
 * Production refuses anything that is not already the canonical `https://host[:port]` form (the error names the
 * canonical value); development/test normalise what they can and keep the rest unchanged.
 */
export function normaliseOrigins(raw: string, label: string, isProduction: boolean): string[] {
  const out: string[] = [];
  for (const entry of raw.split(',').map((o) => o.trim()).filter(Boolean)) {
    let u: URL | null = null;
    try {
      u = new URL(entry);
    } catch {
      u = null;
    }
    if (!isProduction) {
      out.push(u && (u.protocol === 'http:' || u.protocol === 'https:') ? u.origin : entry);
      continue;
    }
    if (!u || u.protocol !== 'https:' || u.origin === 'null') {
      throw new ConfigError(`${label} must list https:// origins such as https://hrsystem.udigity.com (got an unusable entry)`);
    }
    if (u.username || u.password || u.search || u.hash || u.pathname !== '/') {
      throw new ConfigError(`${label} entries must be origins only (no credentials, path, query or fragment); use ${u.origin}`);
    }
    if (entry !== u.origin) {
      throw new ConfigError(`${label} entry must be written exactly as ${u.origin} (lower case, no trailing slash)`);
    }
    if (LOCAL_HOST_RE.test(u.hostname)) throw new ConfigError(`${label} must be the public host name, not a local address`);
    out.push(u.origin);
  }
  return out;
}

/** Express `trust proxy` names (subnet presets) accepted beside IP addresses and CIDR ranges. */
const PROXY_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** TRUSTED_PROXY_CIDRS: comma list of IPs / CIDRs / Express presets; null when unset. */
export function parseTrustedProxies(raw: string | undefined): string[] | null {
  if (raw === undefined || raw.trim() === '') return null;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of list) {
    if (PROXY_PRESETS.has(entry)) continue;
    const [addr, prefix, extra] = entry.split('/');
    const family = net.isIP(addr);
    const max = family === 4 ? 32 : 128;
    const prefixOk = prefix === undefined || (/^\d{1,3}$/.test(prefix) && Number(prefix) <= max);
    if (!family || extra !== undefined || !prefixOk) {
      throw new ConfigError(`TRUSTED_PROXY_CIDRS: "${entry}" is not an IP address, CIDR range or one of ${[...PROXY_PRESETS].join(', ')}`);
    }
  }
  return list;
}

/**
 * Resolve NODE_ENV. Fails closed: an unset or unknown NODE_ENV is treated as
 * 'production' (strict mode: secrets required, no verbose errors, Secure cookies).
 */
export function resolveEnv(raw: string | undefined): AppEnv {
  if (raw === 'development' || raw === 'test' || raw === 'production') return raw;
  return 'production';
}

export function loadConfig(env: Env) {
  const appEnv = resolveEnv(env.NODE_ENV);
  const isProduction = appEnv === 'production';

  // --- Database -----------------------------------------------------------
  // In tests only TEST_DATABASE_URL is honoured, so a test run can never reach the dev DB.
  const databaseUrl = appEnv === 'test' ? env.TEST_DATABASE_URL || '' : env.DATABASE_URL || '';
  // DEV-R5: migrations may run as the table-owner role (MIGRATION_DATABASE_URL) while the API and
  // worker use the restricted `udigity_app` member (DATABASE_URL). Empty = migrate with `url`.
  // Tests always migrate their own TEST_DATABASE_URL.
  const migrationUrl = appEnv === 'test' ? databaseUrl : env.MIGRATION_DATABASE_URL || '';
  const db = {
    url: databaseUrl,
    migrationUrl,
    host: env.DB_HOST || '',
    port: port(env, 'DB_PORT', 5432),
    name: env.DB_NAME || '',
    user: env.DB_USER || '',
    password: env.DB_PASSWORD || '',
  };
  const dbConfigured = Boolean(db.url) || Boolean(db.host && db.name && db.user && db.password);

  // --- Session secret -----------------------------------------------------
  let secret = env.SESSION_SECRET || '';
  if (isProduction) {
    if (!secret || secret.length < 32 || KNOWN_PLACEHOLDER_SECRETS.has(secret)) {
      throw new ConfigError(
        'SESSION_SECRET is required in production (>= 32 random characters, not the example value). ' +
          'Note: an unset NODE_ENV is treated as production.'
      );
    }
    if (!dbConfigured) {
      throw new ConfigError(
        'Database configuration is required in production (DATABASE_URL, or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD).'
      );
    }
  } else if (!secret) {
    // Development/test only: an ephemeral secret. Sessions do not survive a restart.
    secret = crypto.randomBytes(32).toString('hex');
  }

  const pendingScopeRaw = env.OWNER_PENDING_2FA_SCOPE || 'R11-a';
  if (pendingScopeRaw !== 'R11-a' && pendingScopeRaw !== 'R11-b') {
    throw new ConfigError('OWNER_PENDING_2FA_SCOPE must be R11-a or R11-b');
  }

  const appOrigins = normaliseOrigins(
    env.APP_ORIGIN || env.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:3000'),
    env.APP_ORIGIN ? 'APP_ORIGIN' : 'CORS_ORIGIN',
    isProduction
  );
  if (isProduction && appOrigins.length === 0) {
    throw new ConfigError('APP_ORIGIN is required in production (the public origin of the app)');
  }
  const corsOrigins = env.CORS_ORIGIN ? normaliseOrigins(env.CORS_ORIGIN, 'CORS_ORIGIN', isProduction) : [];
  if (isProduction && corsOrigins.some((o) => !appOrigins.includes(o))) {
    throw new ConfigError('CORS_ORIGIN must equal APP_ORIGIN (the one public origin)');
  }
  const publicAppUrl = resolvePublicAppUrl(env.PUBLIC_APP_URL || appOrigins[0] || '', isProduction);
  if (isProduction && !appOrigins.includes(publicAppUrl)) {
    throw new ConfigError(`PUBLIC_APP_URL (${publicAppUrl}) must equal the public origin in APP_ORIGIN (${appOrigins.join(', ')})`);
  }
  if (isProduction && LOCAL_HOST_RE.test(new URL(publicAppUrl).hostname)) {
    throw new ConfigError('PUBLIC_APP_URL must be the public host name, not a local address');
  }

  return {
    env: appEnv,
    isProduction,
    port: port(env, 'PORT', 5000),
    corsOrigin: corsOrigins[0] || appOrigins[0] || '',
    /** Origins accepted by the Origin/Referer check on mutating requests (ADR-002/003). */
    appOrigins,
    /** Requests with neither Origin nor Referer: rejected in production, allowed in dev/test (CLI tools, supertest). */
    allowMissingOrigin: env.ALLOW_MISSING_ORIGIN ? env.ALLOW_MISSING_ORIGIN === 'true' : !isProduction,
    trustProxy: env.TRUST_PROXY === 'true',
    /**
     * D2: the reverse-proxy hops whose X-Forwarded-For entry Express may use for `req.ip` (office check).
     * null = unset: development/test keep the legacy single hop (TRUST_PROXY=true); production trusts no
     * proxy and /readyz answers 503 until it is set.
     */
    trustedProxyCidrs: parseTrustedProxies(env.TRUSTED_PROXY_CIDRS),

    db: { ...db, configured: dbConfigured },

    session: {
      secret,
      // Host-only prefix in production (ADR-002). __Host- requires Secure, so dev uses the plain name.
      cookieName: env.SESSION_COOKIE_NAME || (isProduction ? '__Host-udigity_session' : 'udigity_session'),
      csrfCookieName: env.CSRF_COOKIE_NAME || (isProduction ? '__Host-udigity_csrf' : 'udigity_csrf'),
      secureCookie: isProduction || env.COOKIE_SECURE === 'true',
      // IMPL-SESSION: Demonstration alternative — not approved (docs/policy-defaults.md).
      // Working default: idle 2 h, absolute 12 h, pending-2FA session 10 min.
      idleMinutes: int(env, 'SESSION_IDLE_MINUTES', 120),
      absoluteHours: int(env, 'SESSION_ABSOLUTE_HOURS', int(env, 'SESSION_MAX_AGE_HOURS', 12)),
      pending2faMinutes: int(env, 'SESSION_PENDING_2FA_MINUTES', 10),
    },

    // R-11: Demonstration alternative — not approved (docs/policy-defaults.md).
    // Working default R11-a (pending Owner session can do nothing until 2FA); R11-b allows non-admin routes.
    owner2faPendingScope: pendingScopeRaw as PendingTwoFactorScope,

    // IMPL-LOCKOUT: Demonstration alternative — not approved (docs/policy-defaults.md).
    // Working default: 5 failures per account in 15 min -> 15 min lock; same for 2FA codes.
    lockout: {
      maxFailures: int(env, 'LOCKOUT_MAX_FAILURES', 5),
      windowMinutes: int(env, 'LOCKOUT_WINDOW_MINUTES', 15),
      lockMinutes: int(env, 'LOCKOUT_DURATION_MINUTES', 15),
    },

    // Per-IP rate limit on auth endpoints. IMPL-LOCKOUT names a per-IP limit but no number:
    // 20 requests / 15 min is a placeholder. Demonstration alternative — not approved (docs/policy-defaults.md).
    authRateLimit: {
      // Failed sign-ins per IP per window (successes never count; office NAT fairness, see identity/limits.ts).
      max: int(env, 'AUTH_RATE_LIMIT_MAX', 100),
      windowMinutes: int(env, 'AUTH_RATE_LIMIT_WINDOW_MINUTES', 15),
    },

    // IMPL-PASSWORD: Demonstration alternative — not approved (docs/policy-defaults.md).
    // Working default: min 12 characters, no composition rules; reset link single use, 60 min; reset ends all sessions.
    password: {
      minLength: int(env, 'PASSWORD_MIN_LENGTH', 12),
      resetTtlMinutes: int(env, 'PASSWORD_RESET_TTL_MINUTES', 30),
      /** bcrypt cost for account passwords: 12 outside tests (V-02). */
      bcryptRounds: bcryptCost(env, appEnv, 'PASSWORD_BCRYPT_ROUNDS', 12),
      /** bcrypt cost for 2FA recovery codes: 10 outside tests (V-02). */
      recoveryCodeBcryptRounds: bcryptCost(env, appEnv, 'RECOVERY_CODE_BCRYPT_ROUNDS', 10),
    },

    // IMPL-2FA: TOTP authenticator app. Owner 2FA itself is Confirmed (architecture-b §6);
    // the TOTP method is a Demonstration alternative — not approved (docs/policy-defaults.md).
    totp: {
      issuer: env.TOTP_ISSUER || 'Udigity',
      /** AU-13 at-rest encryption of TOTP secrets (BE1-R1). */
      encryption: loadTotpEncryption(env),
    },

    /** DEV-R4 alias env names (read by BE1 `getSetting` only when the POLICY_* key is empty). */
    policyAliases: loadPolicyEnvAliases(env),

    /** Trusted public origin used to build links in security emails (validated; https in production). */
    publicAppUrl,
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;

export const config: AppConfig = loadConfig(process.env);
