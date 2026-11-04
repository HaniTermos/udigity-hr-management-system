import { describe, it, expect } from 'vitest';
import { loadConfig, resolveEnv } from '../config/index.js';

const STRONG = 'x'.repeat(48);
const DB = { DB_HOST: 'db', DB_NAME: 'app', DB_USER: 'app', DB_PASSWORD: 'pw' };
const KEY = 'ab'.repeat(32); // 32 bytes hex, test value only

describe('fail-closed configuration', () => {
  it('treats an unset or unknown NODE_ENV as production', () => {
    expect(resolveEnv(undefined)).toBe('production');
    expect(resolveEnv('')).toBe('production');
    expect(resolveEnv('staging')).toBe('production');
    expect(resolveEnv('development')).toBe('development');
  });

  it('refuses to start with NODE_ENV unset and no secret', () => {
    expect(() => loadConfig({ ...DB, APP_ORIGIN: 'https://app.example' })).toThrow(/SESSION_SECRET/);
  });

  it('rejects the example placeholder secret in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        ...DB,
        APP_ORIGIN: 'https://app.example',
        SESSION_SECRET: 'udigity_dev_session_secret_change_me_in_production_32chars',
      })
    ).toThrow(/SESSION_SECRET/);
  });

  it('requires DB configuration and an app origin in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: STRONG, APP_ORIGIN: 'https://a.example' })).toThrow(
      /Database/
    );
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: STRONG, ...DB })).toThrow(/APP_ORIGIN/);
  });

  it('production config is strict: Secure host-only cookies, missing Origin rejected', () => {
    const c = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: STRONG, ...DB, APP_ORIGIN: 'https://a.example', TOTP_ENC_KEY: KEY });
    expect(c.session.secureCookie).toBe(true);
    expect(c.session.cookieName.startsWith('__Host-')).toBe(true);
    expect(c.allowMissingOrigin).toBe(false);
  });

  it('FX-MAIL: PUBLIC_APP_URL (email link base) is a trusted https origin in production, else start-up fails', () => {
    const prod = { NODE_ENV: 'production', SESSION_SECRET: STRONG, ...DB, APP_ORIGIN: 'https://a.example', TOTP_ENC_KEY: KEY };
    expect(loadConfig(prod).publicAppUrl).toBe('https://a.example'); // falls back to the first APP_ORIGIN
    expect(loadConfig({ ...prod, APP_ORIGIN: 'https://app.example:8443', PUBLIC_APP_URL: 'https://app.example:8443/' }).publicAppUrl).toBe('https://app.example:8443');
    for (const bad of [
      'http://app.example',
      'app.example',
      '//app.example',
      'javascript:alert(1)',
      'https://app.example/reset',
      'https://app.example?next=https://evil.test',
      'https://app.example#x',
      'https://user:pw@app.example',
      'https://evil.test\\@app.example',
    ]) {
      expect(() => loadConfig({ ...prod, PUBLIC_APP_URL: bad }), bad).toThrow(/PUBLIC_APP_URL/);
    }
    expect(() => loadConfig({ ...prod, APP_ORIGIN: 'http://a.example' })).toThrow(/https/);
    // Development keeps http for localhost, but not paths or other schemes.
    expect(loadConfig({ NODE_ENV: 'development', PUBLIC_APP_URL: 'http://localhost:3000' }).publicAppUrl).toBe('http://localhost:3000');
    expect(() => loadConfig({ NODE_ENV: 'development', PUBLIC_APP_URL: 'http://localhost:3000/app' })).toThrow(/origin only/);
    expect(() => loadConfig({ NODE_ENV: 'development', PUBLIC_APP_URL: 'ftp://localhost' })).toThrow(/http/);
  });

  it('uses the policy working defaults (Demonstration alternatives — not approved)', () => {
    const c = loadConfig({ NODE_ENV: 'development' });
    expect(c.session).toMatchObject({ idleMinutes: 120, absoluteHours: 12, pending2faMinutes: 10 });
    expect(c.lockout).toEqual({ maxFailures: 5, windowMinutes: 15, lockMinutes: 15 });
    expect(c.password).toEqual({ minLength: 12, resetTtlMinutes: 30, bcryptRounds: 12, recoveryCodeBcryptRounds: 10 });
    expect(c.owner2faPendingScope).toBe('R11-a');
    expect(loadConfig({ NODE_ENV: 'development', OWNER_PENDING_2FA_SCOPE: 'R11-b' }).owner2faPendingScope).toBe('R11-b');
    expect(() => loadConfig({ NODE_ENV: 'development', OWNER_PENDING_2FA_SCOPE: 'x' })).toThrow();
  });

  it('in tests, only TEST_DATABASE_URL is used (never DATABASE_URL or DB_*)', () => {
    const c = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://dev/db', ...DB });
    expect(c.db.url).toBe('');
    expect(loadConfig({ NODE_ENV: 'test', TEST_DATABASE_URL: 'postgres://t/db' }).db.url).toBe('postgres://t/db');
  });

  it('production requires TOTP_ENC_KEY; dev/test use the public fallback keys (BE1-R1, AU-13)', () => {
    const prod = { NODE_ENV: 'production', SESSION_SECRET: STRONG, ...DB, APP_ORIGIN: 'https://a.example' };
    expect(() => loadConfig(prod)).toThrow(/TOTP_ENC_KEY is required/);
    const c = loadConfig({ ...prod, TOTP_ENC_KEY: KEY });
    expect(c.totp.encryption.devFallback).toBe(false);
    expect(c.totp.encryption.keyring.has('dev-only')).toBe(false);
    expect(loadConfig({ NODE_ENV: 'test' }).totp.encryption.current.id).toBe('test-only');
  });

  it('DEV-R4 aliases are validated', () => {
    const c = loadConfig({ NODE_ENV: 'test', COMPANY_TIMEZONE: 'Asia/Beirut', OFFICE_IP_ALLOWLIST: '10.0.0.1, 10.0.0.2', ATTENDANCE_OFFICE_MODE: 'ip' });
    expect(c.policyAliases).toEqual({ companyTimezone: 'Asia/Beirut', officeIps: ['10.0.0.1', '10.0.0.2'], verificationMode: 'ip' });
    expect(() => loadConfig({ NODE_ENV: 'test', COMPANY_TIMEZONE: 'Mars/Base' })).toThrow(/IANA/);
  });

  it('DEV-R5: MIGRATION_DATABASE_URL is separate outside tests, ignored in tests', () => {
    const dev = loadConfig({ NODE_ENV: 'development', DATABASE_URL: 'postgres://app/db', MIGRATION_DATABASE_URL: 'postgres://owner/db' });
    expect(dev.db.migrationUrl).toBe('postgres://owner/db');
    const t = loadConfig({ NODE_ENV: 'test', TEST_DATABASE_URL: 'postgres://t/db', MIGRATION_DATABASE_URL: 'postgres://owner/db' });
    expect(t.db.migrationUrl).toBe('postgres://t/db');
  });

  it('V-02: bcrypt cost can be lowered only under NODE_ENV=test; production ignores the override', () => {
    const lowered = { PASSWORD_BCRYPT_ROUNDS: '4', RECOVERY_CODE_BCRYPT_ROUNDS: '4' };
    const prod = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: STRONG, ...DB, APP_ORIGIN: 'https://a.example', TOTP_ENC_KEY: KEY, ...lowered });
    expect(prod.password.bcryptRounds).toBe(12);
    expect(prod.password.recoveryCodeBcryptRounds).toBe(10);
    const dev = loadConfig({ NODE_ENV: 'development', ...lowered });
    expect(dev.password.bcryptRounds).toBe(12);
    const test = loadConfig({ NODE_ENV: 'test', ...lowered });
    expect(test.password.bcryptRounds).toBe(4);
    expect(test.password.recoveryCodeBcryptRounds).toBe(4);
    expect(() => loadConfig({ NODE_ENV: 'test', PASSWORD_BCRYPT_ROUNDS: '3' })).toThrow(/between 4 and 15/);
  });

  it('C-14: production APP_ORIGIN / CORS_ORIGIN must be canonical https origins, else start-up fails', () => {
    const prod = { NODE_ENV: 'production', SESSION_SECRET: STRONG, ...DB, TOTP_ENC_KEY: KEY };
    const ok = loadConfig({ ...prod, APP_ORIGIN: 'https://hrsystem.udigity.com' });
    expect(ok.appOrigins).toEqual(['https://hrsystem.udigity.com']);
    expect(ok.corsOrigin).toBe('https://hrsystem.udigity.com');
    expect(ok.publicAppUrl).toBe('https://hrsystem.udigity.com');
    for (const bad of [
      'https://hrsystem.udigity.com/', // trailing slash: every POST would be 403 ORIGIN_REJECTED
      'https://HRSystem.udigity.com',
      'http://hrsystem.udigity.com',
      'hrsystem.udigity.com',
      '*',
      'https://hrsystem.udigity.com/app',
      'https://localhost:3000',
      'https://127.0.0.1',
    ]) {
      expect(() => loadConfig({ ...prod, APP_ORIGIN: bad }), bad).toThrow(/APP_ORIGIN/);
    }
    expect(() => loadConfig({ ...prod, APP_ORIGIN: 'https://hrsystem.udigity.com', CORS_ORIGIN: 'https://other.example' })).toThrow(/CORS_ORIGIN/);
    expect(() => loadConfig({ ...prod, APP_ORIGIN: 'https://hrsystem.udigity.com', CORS_ORIGIN: 'https://hrsystem.udigity.com/' })).toThrow(/CORS_ORIGIN/);
    expect(loadConfig({ ...prod, APP_ORIGIN: 'https://hrsystem.udigity.com', CORS_ORIGIN: 'https://hrsystem.udigity.com' }).corsOrigin).toBe('https://hrsystem.udigity.com');
    // PUBLIC_APP_URL must be the same public origin as APP_ORIGIN, and not a local address.
    expect(() => loadConfig({ ...prod, APP_ORIGIN: 'https://hrsystem.udigity.com', PUBLIC_APP_URL: 'https://other.example' })).toThrow(/PUBLIC_APP_URL/);
    expect(() => loadConfig({ ...prod, APP_ORIGIN: 'https://hrsystem.udigity.com', PUBLIC_APP_URL: 'https://localhost:3000' })).toThrow(/PUBLIC_APP_URL/);
    // Development and test normalise instead of failing.
    expect(loadConfig({ NODE_ENV: 'development', APP_ORIGIN: 'http://localhost:3000/' }).appOrigins).toEqual(['http://localhost:3000']);
  });

  it('C-14: numeric settings reject trailing garbage and out-of-range ports', () => {
    expect(() => loadConfig({ NODE_ENV: 'development', PORT: '99999' })).toThrow(/PORT/);
    expect(() => loadConfig({ NODE_ENV: 'development', DB_PORT: '70000' })).toThrow(/DB_PORT/);
    expect(() => loadConfig({ NODE_ENV: 'development', SESSION_IDLE_MINUTES: '1.5abc' })).toThrow(/SESSION_IDLE_MINUTES/);
    expect(() => loadConfig({ NODE_ENV: 'development', SESSION_IDLE_MINUTES: '0' })).toThrow(/SESSION_IDLE_MINUTES/);
    expect(loadConfig({ NODE_ENV: 'development', PORT: '5000', SESSION_IDLE_MINUTES: '90' }).session.idleMinutes).toBe(90);
  });
});
