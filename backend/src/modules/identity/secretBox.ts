/**
 * AES-256-GCM encryption of TOTP secrets at rest (threat model AU-13). Pure; unit-tested.
 *
 * Format stored in `two_factor_factors.secret_ciphertext`: `v1.<iv>.<tag>.<ciphertext>` (base64url),
 * with the key id in `secret_key_id`. The employee id is bound as additional authenticated data, so
 * a ciphertext copied onto another employee's row does not decrypt.
 */
import crypto from 'crypto';
import type { EncryptionKey } from './env.js';

export interface SealedSecret {
  ciphertext: string;
  keyId: string;
}

const b64 = (b: Buffer) => b.toString('base64url');

export function sealSecret(plaintext: string, aad: string, key: EncryptionKey): SealedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key.key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext: `v1.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(ct)}`, keyId: key.id };
}

export class SecretBoxError extends Error {}

export function openSecret(sealed: SealedSecret, aad: string, keyring: Map<string, EncryptionKey>): string {
  const key = keyring.get(sealed.keyId);
  if (!key) throw new SecretBoxError('Unknown encryption key id');
  const parts = sealed.ciphertext.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new SecretBoxError('Unsupported ciphertext format');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key.key, Buffer.from(parts[1], 'base64url'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new SecretBoxError('Ciphertext could not be authenticated');
  }
}
