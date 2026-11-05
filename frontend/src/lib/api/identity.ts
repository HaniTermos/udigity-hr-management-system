/**
 * identity API — backend MOD-identity (BE1). Owner: FE1.
 * Screens: SCR-AUTH-001..004, SCR-SHR-006 password change. Login, 2FA and enrollment calls live in
 * `lib/auth.tsx` (they change the session); this file holds the paths and the DTOs of the BE1-C1 contract
 * (backend `modules/identity/schemas.ts`).
 */
import { api } from './client';

export const identityPaths = {
  passwordResetRequest: '/api/auth/password-reset/request',
  recoveryCodes: '/api/auth/2fa/recovery-codes',
  recover: '/api/auth/2fa/recover',
  enrollStart: '/api/auth/2fa/enroll/start',
  enrollConfirm: '/api/auth/2fa/enroll/confirm',
  enrollmentTokens: '/api/auth/2fa/enrollment-tokens',
  twoFactorStatus: '/api/auth/2fa/status',
  changePassword: '/api/auth/password/change',
} as const;

/** `POST /2fa/enroll/start` body. The token is 43 base64url characters, issued out of band (operator CLI or another Owner). */
export interface EnrollStartInput {
  /** Omitted for the Owner's own setup from Settings (Owner 2026-11-05); required for custom-role holders. */
  enrollmentToken?: string;
  currentPassword: string;
}

/** `POST /2fa/enroll/start` response. */
export interface EnrollStartDto {
  method: string;
  secret: string;
  otpauthUrl: string;
}

/** `POST /2fa/enroll/confirm` response: the recovery codes are returned once and never again. */
export interface EnrollConfirmDto {
  recoveryCodes: string[];
}

/** `POST /2fa/recover` response (like verify, plus the remaining count). */
export interface RecoverDto {
  recoveryCodesRemaining: number;
}

/** `GET /2fa/status`. */
export interface TwoFactorStatusDto {
  enrolled: boolean;
  enrollmentTokenRequired: boolean;
  recoveryCodesRemaining: number;
}

/** Shape check for the enrollment token before it is sent (the server decides). */
export const ENROLLMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** `GET /api/employees/me`: the signed-in employee's own record (own profile, any role). */
export const ownProfilePath = '/api/employees/me';

/**
 * Self-service endpoints (CR1-03). While a flag is false the screen disables the action and says "Not available
 * yet": it never reports success without a 2xx. Only `revokeAllSessions` exists in BE1-C2
 * (`POST /api/auth/sessions/revoke-all`). `PATCH /api/employees/me` and a password change are NOT shipped (the
 * backend has `GET /me`, `PATCH /:id` Owner-only, and password reset by email), so those stay false.
 */
export const identityAvailability: { profileUpdate: boolean; passwordChange: boolean; revokeAllSessions: boolean } = {
  profileUpdate: true,
  passwordChange: true,
  revokeAllSessions: true,
};

/** `revokeAllSessions` is confirmed; the other two are proposed paths only (not shipped). */
export const selfServicePaths = {
  profileUpdate: '/api/employees/me',
  passwordChange: identityPaths.changePassword,
  revokeAllSessions: '/api/auth/sessions/revoke-all',
} as const;

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(identityPaths.passwordResetRequest, { email });
}


/** `POST /2fa/enrollment-tokens` (AU-8): an Owner issues a one-time enrollment token for another Owner. */
export interface IssueEnrollmentTokenInput {
  employeeId: string;
  /** The issuing Owner's own current password (fresh re-authentication). */
  currentPassword: string;
  /** A current 6-digit code from the issuing Owner's authenticator. */
  token: string;
}

export interface IssuedEnrollmentToken {
  /** Shown once. Hand it over out of band; it cannot be read again. */
  enrollmentToken: string;
  expiresAt: string;
}

export async function issueEnrollmentToken(input: IssueEnrollmentTokenInput): Promise<IssuedEnrollmentToken> {
  return api.post<IssuedEnrollmentToken>(identityPaths.enrollmentTokens, input);
}
