/**
 * BE1 SEC-3 unit tests (no DB): AES-GCM secret box, env loader (AU-13 key + DEV-R4 aliases),
 * recovery codes (AU-9), seed and demo-seed production guard (SE-4), bootstrap CLI args, capability map.
 */
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { loadBe1Env } from './env.js';
import { SecretBoxError, openSecret, sealSecret } from './secretBox.js';
import { generateRecoveryCode, hashEnrollmentToken, normalizeRecoveryCode } from './twoFactor.js';
import { assertSeedAllowed, SeedRefusedError } from '../../db/seed.js';
import { seedDemo } from '../../db/seed-demo.js';
import { parseArgs } from './bootstrap.js';
import { capabilitiesFor } from './schemas.js';
import '../admin/schemas.js';
import '../employees/schemas.js';
import { isPendingRequestAllowed } from './security.js';

const key = (id: string) => ({ id, key: crypto.randomBytes(32) });

describe('AU-13 secret box (AES-256-GCM)', () => {
  it('round-trips and never stores the plaintext', () => {
    const k = key('k1');
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', 'emp-1', k);
    expect(sealed.keyId).toBe('k1');
    expect(sealed.ciphertext).not.toContain('JBSWY3DPEHPK3PXP');
    expect(sealed.ciphertext.startsWith('v1.')).toBe(true);
    expect(openSecret(sealed, 'emp-1', new Map([['k1', k]]))).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV each time', () => {
    const k = key('k1');
    expect(sealSecret('same', 'a', k).ciphertext).not.toBe(sealSecret('same', 'a', k).ciphertext);
  });

  it('binds the ciphertext to the employee id (AAD) and detects tampering', () => {
    const k = key('k1');
    const ring = new Map([['k1', k]]);
    const sealed = sealSecret('secret', 'emp-1', k);
    expect(() => openSecret(sealed, 'emp-2', ring)).toThrow(SecretBoxError);
    const parts = sealed.ciphertext.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => openSecret({ ...sealed, ciphertext: parts.join('.') }, 'emp-1', ring)).toThrow(SecretBoxError);
    expect(() => openSecret({ ...sealed, keyId: 'other' }, 'emp-1', ring)).toThrow(/Unknown encryption key/);
  });
});

describe('BE1 env loader', () => {
  const hex = crypto.randomBytes(32).toString('hex');
  const b64 = crypto.randomBytes(32).toString('base64');

  it('production refuses to start without TOTP_ENC_KEY (unset NODE_ENV = production)', () => {
    expect(() => loadBe1Env({ NODE_ENV: 'production' })).toThrow(/TOTP_ENC_KEY is required/);
    expect(() => loadBe1Env({})).toThrow(/TOTP_ENC_KEY is required/);
    expect(loadBe1Env({ NODE_ENV: 'production', TOTP_ENC_KEY: hex }).totp.devFallback).toBe(false);
  });

  it('accepts hex or base64 32-byte keys, rejects short ones', () => {
    expect(loadBe1Env({ NODE_ENV: 'test', TOTP_ENC_KEY: b64 }).totp.current.key.length).toBe(32);
    expect(() => loadBe1Env({ NODE_ENV: 'test', TOTP_ENC_KEY: 'short' })).toThrow(/32 random bytes/);
  });

  it('dev/test fallback key is used only outside production', () => {
    const e = loadBe1Env({ NODE_ENV: 'development' });
    expect(e.totp.devFallback).toBe(true);
    expect(e.totp.current.id).toBe('dev-only');
    expect(loadBe1Env({ NODE_ENV: 'test' }).totp.current.id).toBe('test-only');
    expect(loadBe1Env({ NODE_ENV: 'production', TOTP_ENC_KEY: hex }).totp.keyring.has('dev-only')).toBe(false);
  });

  it('keyring with previous keys for rotation', () => {
    const e = loadBe1Env({ NODE_ENV: 'test', TOTP_ENC_KEY: hex, TOTP_ENC_KEY_ID: 'k2', TOTP_ENC_PREVIOUS_KEYS: `k1:${b64}` });
    expect([...e.totp.keyring.keys()]).toEqual(expect.arrayContaining(['k1', 'k2']));
    expect(e.totp.current.id).toBe('k2');
    expect(() => loadBe1Env({ NODE_ENV: 'test', TOTP_ENC_KEY: hex, TOTP_ENC_PREVIOUS_KEYS: 'nokey' })).toThrow();
  });

  it('DEV-R4 aliases: COMPANY_TIMEZONE, OFFICE_IP_ALLOWLIST, ATTENDANCE_OFFICE_MODE are validated', () => {
    const e = loadBe1Env({ NODE_ENV: 'test', COMPANY_TIMEZONE: 'Asia/Beirut', OFFICE_IP_ALLOWLIST: '10.0.0.1, 10.0.0.2', ATTENDANCE_OFFICE_MODE: 'ip' });
    expect(e.aliases).toEqual({ companyTimezone: 'Asia/Beirut', officeIps: ['10.0.0.1', '10.0.0.2'], verificationMode: 'ip' });
    expect(() => loadBe1Env({ NODE_ENV: 'test', COMPANY_TIMEZONE: 'Mars/Base' })).toThrow(/IANA/);
    expect(() => loadBe1Env({ NODE_ENV: 'test', ATTENDANCE_OFFICE_MODE: 'wifi' })).toThrow(/ATTENDANCE_OFFICE_MODE/);
  });
});

describe('AU-9 recovery codes / AU-8 enrollment token hash', () => {
  it('codes are 10 unambiguous characters, grouped, and normalise case/dash/space', () => {
    const codes = new Set(Array.from({ length: 200 }, generateRecoveryCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[a-hj-km-np-z2-9]{5}-[a-hj-km-np-z2-9]{5}$/);
    const c = [...codes][0];
    expect(normalizeRecoveryCode(` ${c.toUpperCase()} `)).toBe(c.replace('-', ''));
    expect(normalizeRecoveryCode('short')).toBeNull();
    expect(normalizeRecoveryCode('abcde-0000l')).toBeNull(); // ambiguous chars are not in the alphabet
  });

  it('enrollment token hash is deterministic and not the token', () => {
    expect(hashEnrollmentToken('abc')).toBe(hashEnrollmentToken('abc'));
    expect(hashEnrollmentToken('abc')).not.toContain('abc');
  });
});

describe('SE-4 seed production guard', () => {
  it('refuses production and unset/unknown NODE_ENV; allows development and test', () => {
    expect(() => assertSeedAllowed('production')).toThrow(SeedRefusedError);
    expect(() => assertSeedAllowed(undefined)).toThrow(SeedRefusedError);
    expect(() => assertSeedAllowed('staging')).toThrow(SeedRefusedError);
    expect(() => assertSeedAllowed('development')).not.toThrow();
    expect(() => assertSeedAllowed('test')).not.toThrow();
  });

  it('the demo-data seed refuses outside development/test before it opens a DB connection', async () => {
    const previous = process.env.NODE_ENV;
    try {
      for (const env of ['production', 'staging', '']) {
        process.env.NODE_ENV = env;
        await expect(seedDemo()).rejects.toThrow(SeedRefusedError);
      }
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe('Owner bootstrap CLI args', () => {
  it('parses the three modes and rejects unknown flags', () => {
    expect(parseArgs(['--email', 'a@b.co', '--name', 'A B'])).toMatchObject({ email: 'a@b.co', name: 'A B', reset2fa: false });
    expect(parseArgs(['--email', 'a@b.co', '--reset-2fa', '--reason', 'lost phone']).reset2fa).toBe(true);
    expect(parseArgs(['--encrypt-existing']).encryptExisting).toBe(true);
    expect(() => parseArgs(['--password', 'x'])).toThrow(/Unknown argument/);
  });
});

describe('capabilities in /me', () => {
  it('per role, and empty for an Owner with pending 2FA', () => {
    const owner = capabilitiesFor({ employeeId: 'x', role: 'owner', sessionState: 'active' });
    expect(owner).toEqual(expect.arrayContaining(['employee.create', 'settings.update', 'audit.read', 'settings.read']));
    const cc = capabilitiesFor({ employeeId: 'x', role: 'call_center', sessionState: 'active' });
    expect(cc).toContain('settings.read_public');
    expect(cc).not.toContain('settings.read');
    expect(cc).not.toContain('employee.create');
    expect(cc).not.toContain('audit.read');
    expect(capabilitiesFor({ employeeId: 'x', role: 'owner', sessionState: 'pending_2fa_verification' })).toEqual([]);
  });
});

describe('pending-2FA allow-list', () => {
  it('allows recover only while verification is pending', () => {
    expect(isPendingRequestAllowed('pending_2fa_verification', 'POST', '/api/auth/2fa/recover', 'R11-a', false)).toBe(true);
    expect(isPendingRequestAllowed('pending_2fa_enrollment', 'POST', '/api/auth/2fa/recover', 'R11-a', false)).toBe(false);
    expect(isPendingRequestAllowed('pending_2fa_verification', 'POST', '/api/auth/2fa/recovery-codes', 'R11-a', false)).toBe(false);
  });
});
