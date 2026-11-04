/**
 * Typed API client for domain modules (plan.md §9). Owner: Tech Lead.
 *
 * - Same-origin through the Next rewrite `/api/* -> Express`; cookie session; CSRF header on every
 *   mutation (via `apiFetch` in ./http.ts, the Increment 1 transport, kept as-is for auth).
 * - THROWS `ApiError` on non-2xx so it composes with SWR (`useSWR(key, swrFetcher)`).
 * - Never put personal or sensitive data in query strings (ids, filters and paging only).
 *
 *   const page = await api.get<Page<BusinessRow>>('/api/businesses', { query: { page: 1, q: 'cafe' } });
 *   const saved = await api.patch<Business>(`/api/businesses/${id}`, { ...changes, version });
 */
import { apiFetch } from './http';
import type { ErrorBody, ErrorCode } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;
  readonly details?: unknown;
  readonly requestId?: string;
  /** 429 only: seconds to wait (`Retry-After`), when the server said. */
  readonly retryAfterSeconds?: number;

  constructor(status: number, body: Partial<ErrorBody> | null) {
    super(body?.error || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code || (status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`);
    this.details = body?.details;
    this.requestId = body?.requestId;
    this.retryAfterSeconds = body?.retryAfterSeconds;
  }

  /** 401: the session is gone (expired, revoked, deactivated) → SCR-SHR-013. */
  get isUnauthenticated() {
    return this.status === 401;
  }
  /** 403 role/resource denial → SCR-SHR-011. */
  get isPermissionDenied() {
    return this.code === 'PERMISSION_DENIED' || this.code === 'FORBIDDEN_ROLE';
  }
  /** 403 15-day visibility denial → SCR-SHR-012 "Record hidden by policy". */
  get isHiddenByPolicy() {
    return this.code === 'HIDDEN_BY_POLICY';
  }
  get isNotFound() {
    return this.status === 404;
  }
  /** 409 optimistic-lock mismatch → SCR-SHR-014 save conflict. */
  get isVersionConflict() {
    return this.code === 'VERSION_CONFLICT';
  }
  /** Zod field errors, for inline form messages. */
  get fieldErrors(): Record<string, string[]> {
    return this.code === 'VALIDATION_ERROR' && this.details && typeof this.details === 'object'
      ? (this.details as Record<string, string[]>)
      : {};
  }
}

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

export function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  /** Sent as `Idempotency-Key` (required by calling saves; plan.md §4.7). */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function request<T>(method: string, path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  const result = await apiFetch<T>(`${path}${buildQuery(options.query)}`, {
    method,
    body,
    headers,
    signal: options.signal,
  });
  if (!result.ok) throw new ApiError(result.status, result.error as Partial<ErrorBody> | null);
  return result.data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body ?? {}, options),
  put: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, options),
  del: <T = void>(path: string, body?: unknown, options?: RequestOptions) => request<T>('DELETE', path, body, options),
};

/** SWR fetcher: the key is the full path (with query). */
export const swrFetcher = <T>(path: string) => api.get<T>(path);

/** A fresh idempotency key per user action (keep it across retries of the same action). */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
