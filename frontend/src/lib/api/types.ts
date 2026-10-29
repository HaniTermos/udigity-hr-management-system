/**
 * Shared API types (mirror of the backend contract in docs/implementation/plan.md §4).
 * Owner: Tech Lead. Backend `schemas.ts` files are the source of truth for module DTOs; module DTO
 * types live in the matching `lib/api/<domain>.ts` file, not here.
 *
 * Conventions: ids are UUID strings; timestamps are ISO-8601 UTC strings (render in the company
 * timezone); money is not modelled until DEC-018 fields exist.
 */

export type Id = string;
export type IsoDateTime = string;
/** `YYYY-MM-DD` in the company timezone. */
export type IsoDate = string;

export type Role = 'owner' | 'data_entry' | 'call_center' | 'developer' | (string & {});

export type SessionState = 'pending_2fa_enrollment' | 'pending_2fa_verification' | 'active' | 'ended';

/** Every mutable aggregate carries `version`; send it back on update (409 VERSION_CONFLICT on mismatch). */
export interface Versioned {
  id: Id;
  version: number;
}

export interface PageQuery {
  page?: number;
  /** 1–100, default 25. */
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  /** Counted after access filtering: hidden records are never included. */
  total: number;
}

/** Stable error codes (backend `src/shared/errors.ts`). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  | 'CSRF_FAILED'
  | 'FORBIDDEN_ROLE'
  | 'OWNER_2FA_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'HIDDEN_BY_POLICY'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'CONFLICT_DUPLICATE'
  | 'DUPLICATE_BLOCKED'
  | 'STATE_CONFLICT'
  | 'RESERVATION_CONFLICT'
  | 'RESERVATION_LOST'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'POLICY_NOT_CONFIGURED'
  | 'RULE_VIOLATION'
  | 'RATE_LIMITED'
  | 'TOO_MANY_ATTEMPTS'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  /** Client-side only: a mutation was not sent because the browser is offline (lib/api/offline.ts). */
  | 'OFFLINE';

export interface ErrorBody {
  error: string;
  code: ErrorCode | string;
  /** VALIDATION_ERROR: `Record<field, string[]>`; VERSION_CONFLICT: `{ currentVersion }`. */
  details?: unknown;
  requestId?: string;
}

/** Access outcome attached to detail responses (plan.md §5). */
export type AccessLevel = 'full' | 'context_limited' | 'owner';

