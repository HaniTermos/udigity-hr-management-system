import { describe, expect, it } from 'vitest';
import { TWO_FACTOR_ENROLL_PATH, resolveGuardRedirect } from './authRoutes';

describe('2FA setup lives in Settings (Owner 2026-11-05)', () => {
  it('a session without a second factor may open only Settings → Two-factor authentication', () => {
    expect(TWO_FACTOR_ENROLL_PATH).toBe('/settings/two-factor');
    expect(resolveGuardRedirect('/settings/two-factor', '', 'pending_2fa_enrollment')).toBeNull();
    for (const p of ['/settings', '/employees', '/my-day', '/businesses', '/settings/roles']) {
      expect(resolveGuardRedirect(p, '', 'pending_2fa_enrollment')).toBe('/settings/two-factor');
    }
  });

  it('an enrolled-but-unverified session still goes to the code step, never to setup', () => {
    expect(resolveGuardRedirect('/settings/two-factor', '', 'pending_2fa_verification')).toBe('/login?step=2fa');
  });

  it('an active session opens the page normally; no session is sent to sign in', () => {
    expect(resolveGuardRedirect('/settings/two-factor', '', 'active')).toBeNull();
    expect(resolveGuardRedirect('/settings/two-factor', '', null)).toBe('/login?redirect=%2Fsettings%2Ftwo-factor');
  });
});
