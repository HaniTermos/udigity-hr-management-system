/**
 * Browser-side API client for the Express backend (reached through the Next rewrite `/api/* -> :5000`).
 *
 * - The session lives only in the httpOnly session cookie; the UI never sees or stores the session token.
 * - Every mutation (POST/PUT/PATCH/DELETE) sends the CSRF token in `X-CSRF-Token`
 *   (backend: `middleware/auth.ts`, double-submit cookie + server-derived token).
 *   Token source, in order: the readable CSRF cookie (`udigity_csrf` in dev, `__Host-udigity_csrf` in
 *   production, override with NEXT_PUBLIC_CSRF_COOKIE_NAME), then the last `csrfToken` returned by
 *   GET /api/auth/me or a login/2FA response.
 */

import { browserIsOffline, networkFailure, offlineBlock } from './offline';

export const CSRF_HEADER = 'X-CSRF-Token';

const CSRF_COOKIE_NAMES = [
  process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME,
  '__Host-udigity_csrf',
  'udigity_csrf',
].filter((n): n is string => Boolean(n));

let memoryCsrfToken: string | null = null;

export function rememberCsrfToken(token: unknown): void {
  if (typeof token === 'string' && token.length > 0) memoryCsrfToken = token;
}

export function forgetCsrfToken(): void {
  memoryCsrfToken = null;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function getCsrfToken(): string | null {
  for (const name of CSRF_COOKIE_NAMES) {
    const value = readCookie(name);
    if (value) return value;
  }
  return memoryCsrfToken;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiErrorPayload {
  error?: string;
  code?: string;
  [key: string]: unknown;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: ApiErrorPayload | null;
}

/**
 * Fetch JSON from the backend. Never throws for HTTP errors; network failures return status 0.
 * Offline (SHR-015): a mutation is not sent while the browser is offline (status 0, code `OFFLINE`);
 * reads still go out (./offline.ts).
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {}
): Promise<ApiResult<T>> {
  const method = (init.method || 'GET').toUpperCase();
  const blocked = offlineBlock(method, browserIsOffline());
  if (blocked) return { ok: false, status: 0, data: null, error: blocked };
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.body);
  }

  if (MUTATING.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers.set(CSRF_HEADER, csrf);
  }

  let res: Response;
  try {
    res = await fetch(path, { ...init, method, headers, body, credentials: 'same-origin' });
  } catch {
    return { ok: false, status: 0, data: null, error: networkFailure(method) };
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (json && typeof json === 'object' && 'csrfToken' in json) {
    rememberCsrfToken((json as { csrfToken?: unknown }).csrfToken);
  }

  if (!res.ok) {
    return { ok: false, status: res.status, data: null, error: (json as ApiErrorPayload) || { code: `HTTP_${res.status}` } };
  }
  return { ok: true, status: res.status, data: json as T, error: null };
}
