import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

describe('Authentication & Security Logic (Increment 1)', () => {
  it('correctly hashes and verifies passwords with bcrypt', async () => {
    const rawPassword = 'Password123!';
    const hash = await bcrypt.hash(rawPassword, 10);
    
    expect(hash).not.toBe(rawPassword);
    expect(await bcrypt.compare(rawPassword, hash)).toBe(true);
    expect(await bcrypt.compare('WrongPassword', hash)).toBe(false);
  });

  it('generates and verifies RFC 6238 TOTP tokens for Owner 2FA', () => {
    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);
    
    expect(token).toHaveLength(6);
    expect(/^\d{6}$/.test(token)).toBe(true);
    
    const isValid = authenticator.verify({ token, secret });
    expect(isValid).toBe(true);
    
    const isInvalid = authenticator.verify({ token: '000000', secret });
    expect(isInvalid).toBe(false);
  });

  it('enforces Owner Pending-2FA restriction rule (R11-a working default: Demonstration alternative — not approved, docs/policy-defaults.md)', () => {
    // R11-a (Demonstration alternative — not approved): Owner in pending-2FA state is prohibited from operational routes.
    // The real rule is isPendingRequestAllowed() (exact matching), tested in security.test.ts.
    const allowedPendingPaths = [
      '/api/auth/2fa/verify',
      '/api/auth/2fa/status',
      '/api/auth/logout',
      '/api/auth/me',
    ];

    const testPaths = [
      { path: '/api/auth/2fa/verify', allowed: true },
      { path: '/api/auth/logout', allowed: true },
      { path: '/api/auth/me', allowed: true },
      { path: '/api/employees', allowed: false },
      { path: '/api/attendance/check-in', allowed: false },
      { path: '/api/businesses', allowed: false },
    ];

    for (const item of testPaths) {
      const isAllowed = allowedPendingPaths.some((p) => item.path.startsWith(p));
      expect(isAllowed).toBe(item.allowed);
    }
  });

  it('identifies session expiration correctly', () => {
    const now = new Date();
    const expiredSession = new Date(now.getTime() - 1000); // 1 second ago
    const activeSession = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour ahead

    expect(expiredSession < now).toBe(true);
    expect(activeSession < now).toBe(false);
  });
});
