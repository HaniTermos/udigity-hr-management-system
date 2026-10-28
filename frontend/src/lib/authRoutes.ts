/**
 * Route rules shared by `src/proxy.ts` (server, optimistic) and the AppShell guard (client).
 * Pure functions only: no React, no browser APIs, so the proxy can import this module.
 *
 * The backend (Express) stays the authority. These rules only decide where the UI sends a user.
 */

/** Session states returned by GET /api/auth/me (`user.sessionState`). */
export type SessionState = 'active' | 'pending_2fa_verification' | 'pending_2fa_enrollment';

/** Pages reachable without a session (SCR-AUTH-001, SCR-AUTH-004 and SCR-SHR-013 session ended). */
export const PUBLIC_PATHS = ['/login', '/reset-password', '/session-ended'] as const;

export const LOGIN_PATH = '/login';
/** SCR-AUTH-002 (challenge) and SCR-AUTH-003 (enrollment) live on the login route as steps. */
export const TWO_FACTOR_VERIFY_PATH = '/login?step=2fa';
export const TWO_FACTOR_ENROLL_PATH = '/login?step=enroll';
/** SCR-AUTH-003 "Recover lost factor": sign in with a recovery code (pending verification only). */
export const TWO_FACTOR_RECOVER_PATH = '/login?step=recover';

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function twoFactorPathFor(state: SessionState): string | null {
  if (state === 'pending_2fa_enrollment') return TWO_FACTOR_ENROLL_PATH;
  if (state === 'pending_2fa_verification') return TWO_FACTOR_VERIFY_PATH;
  return null;
}

/** C0 controls, DEL and backslash: the URL parser strips or rewrites them, so they can turn "/x" into "//host". */
function hasUnsafeChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f || c === 0x5c) return true;
  }
  return false;
}

/**
 * Accept only same-origin relative paths for post-login redirects (prevents open redirects, CR1-04).
 * Allowed: starts with a single "/" and not "//", no control characters or backslashes (also after one round of
 * percent-decoding, so "/%09/evil.example" and "/%5Cevil" are refused), and it resolves to the same origin.
 */
export function safeRedirectTarget(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (hasUnsafeChar(raw)) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (hasUnsafeChar(decoded) || decoded.startsWith('//')) return fallback;
  try {
    const base = 'http://redirect.invalid';
    if (new URL(raw, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  if (isPublicPath(raw.split(/[?#]/)[0])) return fallback;
  return raw;
}

export function loginRedirectFor(pathname: string, search = ''): string {
  const target = `${pathname}${search}`;
  if (!target || target === '/') return LOGIN_PATH;
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(target)}`;
}

/**
 * Where should a request for `pathname` go, given what we know about the session?
 * Returns null when the page may render.
 *
 * - No session: protected pages go to login. Public pages render.
 * - Pending 2FA (Owner): only the 2FA steps on /login may render (R-11 working default R11-a in the UI;
 *   R-11 itself is a Demonstration alternative, not approved — see docs/policy-defaults.md).
 * - Active: everything renders (role checks stay on the backend).
 */
export function resolveGuardRedirect(
  pathname: string,
  search: string,
  state: SessionState | null
): string | null {
  const isPublic = isPublicPath(pathname);

  if (state === null) {
    return isPublic ? null : loginRedirectFor(pathname, search);
  }

  const pending = twoFactorPathFor(state);
  if (pending) {
    if (pathname === LOGIN_PATH) {
      const step = new URLSearchParams(search).get('step');
      if (step === '2fa' || step === 'enroll' || step === 'recover') return null;
    }
    // Password reset stays reachable; everything else goes to the 2FA step.
    if (pathname === '/reset-password') return null;
    return pending;
  }

  return null;
}
