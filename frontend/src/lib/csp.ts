/**
 * Content Security Policy for the Next app (SEC-4, checklist A5). Pure module, used by `src/proxy.ts`.
 *
 * - script-src: per-request nonce + 'strict-dynamic'. The nonce covers Next's framework scripts
 *   (Next reads it from the CSP request header) and the inline ThemeScript (layout passes it on).
 *   No 'unsafe-inline' for scripts. 'unsafe-eval' only in `next dev` (React debugging).
 * - style-src: 'unsafe-inline' is kept deliberately because components set `style={{...}}` (chart bar
 *   heights, progress widths); a nonce cannot cover style attributes and style injection is low risk
 *   next to script injection. Google Fonts stylesheet/font hosts are allowed until fonts are
 *   self-hosted (then drop both hosts).
 * - frame-ancestors 'none' (clickjacking), base-uri/form-action 'self', object-src 'none'.
 * - connect-src 'self': the browser only talks to the same origin (`/api` rewrite / nginx). Dev adds
 *   ws: for HMR.
 *
 * The edge (nginx `security-headers.inc`, DEV-3) sends its own CSP too. Browsers enforce every CSP
 * header they receive, so the effective policy is the intersection: keep the edge one equal or looser
 * on script-src and the nonce policy here stays the binding one.
 */

export interface CspOptions {
  nonce: string;
  isDev?: boolean;
}

export function buildCsp({ nonce, isDev = false }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': ["'self'", ...(isDev ? ['ws:', 'wss:'] : [])],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export function newNonce(): string {
  // 128 bits from the Web Crypto API (available in the proxy runtime), base64 encoded.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Headers set on every page response by the proxy (the edge adds HSTS, nosniff etc. as well). */
export function securityHeaders(pathname: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
  };
  // The reset link carries a one-time token in the URL: never leak it through Referer (checklist A5).
  headers['Referrer-Policy'] =
    pathname === '/reset-password' || pathname.startsWith('/reset-password/') ? 'no-referrer' : 'strict-origin-when-cross-origin';
  return headers;
}
