/**
 * Shared API error contract (plan.md §4.3). Owner: Tech Lead. Change only through a board REQUEST.
 *
 * Every error response has this JSON shape:
 *   { error: string, code: ErrorCode, details?: unknown, requestId?: string }
 * - `error` is a short, generic, user-safe message. It never contains SQL, stack traces, secrets,
 *   or field values of records the caller may not see.
 * - `code` is stable and machine-readable; the UI chooses wording from it.
 * - `details` is optional structured data (Zod field errors, `currentVersion`, ...).
 *
 * Throw `HttpError` (or use the helpers below) from routes/services; `errorHandler` renders it.
 */

export type ErrorCode =
  // 400
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'INVALID_2FA_TOKEN' // step-up code wrong (R2-02)
  | '2FA_NOT_CONFIGURED' // step-up impossible: no enrolled factor (R2-02)
  // 401 (identity middleware)
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  // 403
  | 'CSRF_FAILED'
  | 'FORBIDDEN_ROLE' // route-level role/action denial (VT-3)
  | 'OWNER_2FA_REQUIRED'
  | 'PERMISSION_DENIED' // resource-level denial by the access engine
  | 'HIDDEN_BY_POLICY' // 15-day visibility denial (OI-10 wording "Record hidden by policy")
  | 'STEP_UP_REQUIRED' // export needs a current TOTP code (EX-2, R2-02)
  // 404
  | 'NOT_FOUND'
  // 405
  | 'METHOD_NOT_ALLOWED'
  // 409
  | 'VERSION_CONFLICT' // optimistic `version` mismatch (IC-16); details: { currentVersion }
  | 'CONFLICT_DUPLICATE' // unique violation (generic)
  | 'DUPLICATE_BLOCKED' // business duplicate block (DEC-003 shaping applies)
  | 'STATE_CONFLICT' // transition not allowed from the current state
  | 'RESERVATION_CONFLICT' // another holder has the Active reservation
  | 'RESERVATION_LOST' // lease expired / overridden / token mismatch
  | 'IDEMPOTENCY_KEY_REUSED' // same key, different request body
  | 'POLICY_NOT_CONFIGURED' // a NEEDS VALUE setting is not configured yet
  // 422
  | 'RULE_VIOLATION' // a business rule rejected an otherwise valid request
  // 429
  | 'RATE_LIMITED'
  | 'TOO_MANY_ATTEMPTS'
  // 5xx
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  error: string;
  code: ErrorCode | string;
  details?: unknown;
  requestId?: string;
}

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  /** Always true: the message is written for clients. Internal errors must not use HttpError. */
  readonly expose = true;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toBody(requestId?: string): ErrorBody {
    return {
      error: this.message,
      code: this.code,
      ...(this.details !== undefined ? { details: this.details } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export const badRequest = (message = 'Invalid request', details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
export const permissionDenied = () => new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
export const hiddenByPolicy = () => new HttpError(403, 'HIDDEN_BY_POLICY', 'Record hidden by policy');
export const notFound = () => new HttpError(404, 'NOT_FOUND', 'Not found');
/**
 * 409 VERSION_CONFLICT. `current` (BL-09, additive) is the record as the caller may see it now, so the
 * client can render the SHR-014 field diff. Pass only an access-checked DTO, never a raw row.
 */
export const versionConflict = (currentVersion?: number, current?: unknown) =>
  new HttpError(
    409,
    'VERSION_CONFLICT',
    'The record was changed by someone else',
    currentVersion === undefined ? undefined : current === undefined ? { currentVersion } : { currentVersion, current }
  );
export const stateConflict = (message = 'This action is not allowed in the current state', details?: unknown) =>
  new HttpError(409, 'STATE_CONFLICT', message, details);
export const ruleViolation = (message: string, details?: unknown) =>
  new HttpError(422, 'RULE_VIOLATION', message, details);
export const policyNotConfigured = (settingKey: string) =>
  new HttpError(409, 'POLICY_NOT_CONFIGURED', 'Not configured / policy pending', { setting: settingKey });
export const notImplemented = (what: string) =>
  new HttpError(501, 'NOT_IMPLEMENTED', `${what} is not implemented yet`);
