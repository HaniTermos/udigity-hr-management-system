/**
 * Encryption for one-time secrets needed at send time (raw reset / setup tokens). Owner: BE5.
 * AES-256-GCM; key = HKDF-SHA256(SESSION_SECRET, info "udigity:notification-secrets") (identity/keys.ts). The
 * API and the worker must share SESSION_SECRET (required in production). During a rotation a value sealed
 * with SESSION_SECRET_PREVIOUS still opens. Never log plaintext or ciphertext.
 */
import crypto from 'crypto';
import { notificationSecretKeys } from '../identity/keys.js';

/** T-01: 16-byte GCM tags only. */
const TAG_BYTES = 16;

const key = (): Buffer => notificationSecretKeys()[0];

/** Returns `v1.<iv>.<tag>.<ciphertext>` (base64url). `aad` binds the ciphertext to its row id. */
export function encryptSecret(plaintext: string, aad: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

/** Returns null when the value cannot be decrypted (wrong key, tampered, other row). */
export function decryptSecret(value: string, aad: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const tag = Buffer.from(parts[2], 'base64url');
  if (tag.length !== TAG_BYTES) return null; // T-01: a truncated tag is never accepted
  for (const k of notificationSecretKeys()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(parts[1], 'base64url'), { authTagLength: TAG_BYTES });
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      // next key (rotation), else null
    }
  }
  return null;
}
