import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildCsp, newNonce, securityHeaders } from '@/lib/csp';
import { isPublicPath, loginRedirectFor, resolveGuardRedirect, type SessionState } from '@/lib/authRoutes';

/**
 * Next 16 Proxy (formerly Middleware): optimistic route guard.
 *
 * 1. No session cookie on a protected page -> /login?redirect=...
 * 2. With a cookie, asks the backend GET /api/auth/me (forwarding only the Cookie header) for the
 *    session state, then applies the shared rules in lib/authRoutes.ts
 *    (pending-2FA Owners may only reach the 2FA steps).
 * 3. Every page response gets the nonce CSP and security headers (lib/csp.ts, SEC-4).
 * 4. If the backend cannot be reached, the request passes; the AppShell guard and the backend's own
 *    `authenticate` middleware still apply. The backend is the authority for every API call.
 */

const SESSION_COOKIE_NAMES = [
  process.env.SESSION_COOKIE_NAME,
  '__Host-udigity_session',
  'udigity_session',
].filter((n): n is string => Boolean(n));

const API_ORIGIN = process.env.INTERNAL_API_URL || 'http://localhost:5000';

async function fetchSessionState(request: NextRequest): Promise<SessionState | null | 'unknown'> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
      headers: { cookie: request.headers.get('cookie') || '', accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (res.status === 401) return null;
    if (!res.ok) return 'unknown';
    const json = (await res.json()) as { user?: { sessionState?: SessionState; isPending2FA?: boolean } };
    const user = json.user;
    if (!user) return null;
    if (user.sessionState) return user.sessionState;
    return user.isPending2FA ? 'pending_2fa_verification' : 'active';
  } catch {
    return 'unknown';
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // CSP with a per-request nonce (SEC-4). Next reads the nonce from the *request* CSP header and applies
  // it to its own scripts; the layout reads `x-nonce` for the inline ThemeScript.
  const nonce = newNonce();
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === 'development' });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const finish = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp);
    for (const [k, v] of Object.entries(securityHeaders(pathname))) response.headers.set(k, v);
    return response;
  };
  const pass = () => finish(NextResponse.next({ request: { headers: requestHeaders } }));

  const hasCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));

  if (!hasCookie) {
    if (isPublicPath(pathname)) return pass();
    return finish(NextResponse.redirect(new URL(loginRedirectFor(pathname, search), request.url)));
  }

  const state = await fetchSessionState(request);
  if (state === 'unknown') return pass();

  const target = resolveGuardRedirect(pathname, search, state);
  if (!target) return pass();

  const response = finish(NextResponse.redirect(new URL(target, request.url)));
  if (state === null) {
    // Stale or ended session: drop the cookie so the next request skips the backend round-trip.
    for (const name of SESSION_COOKIE_NAMES) response.cookies.delete(name);
  }
  return response;
}

export const config = {
  matcher: [
    // Pages only: skip the API rewrite, Next internals and static files (anything with an extension),
    // and link prefetches (they carry no document, so no nonce is needed).
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
