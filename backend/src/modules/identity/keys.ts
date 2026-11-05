/**
 * Per-purpose keys derived from SESSION_SECRET (review 2026-11-04 controls gap "key separation / rotation").
 *
 * Each use of the secret gets its own 32-byte key, HKDF-SHA256(secret, salt "udigity", info "udigity:<purpose>"),
 * so a key leaked or misused in one place says nothing about the others:
 *   - session-token   HMAC of the session cookie token stored in `sessions.token_hash`
 *   - csrf            per-session CSRF token
 *   - reset-token     HMAC of password-reset / credential-setup tokens in `security_tokens.token_hash`
 *   - notification-secrets  AES-256-GCM key of queued one-time secrets (notifications/secrets.ts; that derivation
 *                     already existed and is unchanged, so its "legacy" key is the same key)
 *
 * Backwards compatibility (nothing in flight breaks when this ships or when the secret rotates):
 *   - Verification accepts, in order: the per-purpose key of SESSION_SECRET, the LEGACY derivation (the raw
 *     SESSION_SECRET as HMAC key, which every session / token / CSRF token issued before this change uses),
 *     then the same two for SESSION_SECRET_PREVIOUS when it is set (rotation window).
 *   - New values are always produced with the per-purpose key of the current SESSION_SECRET. A session found
 *     by an older hash is re-keyed on use (middleware/auth.ts), so old hashes disappear as people work.
 *
 * Rotation procedure (ops): set SESSION_SECRET_PREVIOUS to the current value, SESSION_SECRET to a new random
 * value (>= 32 chars), restart API and worker together. Keep the previous value for at least the longest
 * lifetime of what it protects (absolute session 12 h, reset link 30 min, queued secrets until sent), then
 * remove SESSION_SECRET_PREVIOUS and restart again.
 */
import crypto from 'crypto';
import { config } from '../../config/index.js';

export type KeyPurpose = 'session-token' | 'csrf' | 'reset-token' | 'notification-secrets';

const cache = new Map<string, Buffer>();

/** HKDF-SHA256 per-purpose key of `secret`. */
export function purposeKey(secret: string, purpose: KeyPurpose): Buffer {
  const id = `${purpose}\u0000${secret}`;
  let k = cache.get(id);
  if (!k) {
    k = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.from('udigity'), Buffer.from(`udigity:${purpose}`), 32));
    cache.set(id, k);
  }
  return k;
}

const hmacHex = (key: Buffer | string, data: string) => crypto.createHmac('sha256', key).update(data).digest('hex');

function secrets(): string[] {
  const out = [config.session.secret];
  if (config.session.previousSecret && config.session.previousSecret !== config.session.secret) out.push(config.session.previousSecret);
  return out;
}

/** Keys to try when verifying, newest first: per-purpose and legacy (raw secret) for current, then previous. */
function verificationKeys(purpose: Exclude<KeyPurpose, 'notification-secrets'>): (Buffer | string)[] {
  return secrets().flatMap((s) => [purposeKey(s, purpose), s]);
}

/** Hash stored for a new session token / reset token (current secret, per-purpose key). */
export function tokenHash(purpose: 'session-token' | 'reset-token', token: string): string {
  return hmacHex(purposeKey(config.session.secret, purpose), token);
}

/** Every hash a stored token may have (newest first). Look up with `token_hash = ANY($1)`. */
export function tokenHashCandidates(purpose: 'session-token' | 'reset-token', token: string): string[] {
  return [...new Set(verificationKeys(purpose).map((k) => hmacHex(k, token)))];
}

const csrfData = (sessionId: string, nonce: string) => `csrf:${sessionId}:${nonce}`;

/** CSRF token issued for a session (current secret, per-purpose key). */
export function csrfToken(sessionId: string, nonce: string): string {
  return hmacHex(purposeKey(config.session.secret, 'csrf'), csrfData(sessionId, nonce));
}

/** Every CSRF token a session may legitimately present (the current one first). */
export function csrfTokenCandidates(sessionId: string, nonce: string): string[] {
  return [...new Set(verificationKeys('csrf').map((k) => hmacHex(k, csrfData(sessionId, nonce))))];
}

/** AES keys for queued notification secrets: current first, then the previous secret's. */
export function notificationSecretKeys(): Buffer[] {
  return secrets().map((s) => purposeKey(s, 'notification-secrets'));
}
