import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticator as baseAuthenticator } from 'otplib';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { authenticate } from '../../middleware/auth.js';
import { AuditLogOptions, recordAuditEvent } from '../admin/audit.js';
import {
  RESET_REQUESTS_PER_EMAIL_PER_HOUR,
  RESET_REQUEST_MIN_MS,
  accountDelayMs,
  createEmployeeAuthLimiter,
  createLoginIpLimiter,
  createLoginPairLimiter,
  createResetCompleteLimiter,
  createResetRequestLimiter,
  emailKey,
  loginAccountFailures,
  padTo,
  resetRequestsPerEmail,
  sendRateLimited,
  sleep,
} from './limits.js';
import { queuePasswordResetEmail } from '../notifications/service.js';
import {
  LockoutState,
  SessionState,
  generateToken,
  hashToken,
  isLocked,
  isReplayedStep,
  registerFailure,
  totpStep,
} from './security.js';
import { NewSession, clearSessionCookies, createSession, endAllSessions, endSession, rotateSession, setSessionCookies } from './sessions.js';
import {
  FactorSecretRow,
  consumeEnrollmentTokenById,
  countOpenRecoveryCodes,
  findOpenEnrollmentToken,
  issueEnrollmentToken,
  readFactorSecret,
  replaceRecoveryCodes,
  storePendingSecret,
  useRecoveryCode,
} from './twoFactor.js';
import { flags } from '../../shared/flags.js';
import { outbox } from '../../shared/outbox.js';
import { principalFromRequest, requireAction } from '../../shared/access.js';
import { capabilitiesFor } from './schemas.js';

const router = Router();

// IMPL-2FA: TOTP (±1 step clock tolerance). Method is a Demonstration alternative — not approved
// (docs/policy-defaults.md). Owner 2FA itself is Confirmed (architecture-b §6).
const authenticator = baseAuthenticator.clone({ window: 1 });

// Review 2026-11-04 F-01: one bucket per step (limits.ts), failed attempts only where a success is
// possible. In-memory: single API replica required (F-06, limits.ts header).
const loginPairLimiter = createLoginPairLimiter();
const loginIpLimiter = createLoginIpLimiter();
const twoFactorLimiter = createEmployeeAuthLimiter('auth-2fa');
const recoveryLimiter = createEmployeeAuthLimiter('auth-recovery');
const twoFactorAdminLimiter = createEmployeeAuthLimiter('auth-2fa-admin');
const passwordChangeLimiter = createEmployeeAuthLimiter('auth-password-change');
const resetRequestLimiter = createResetRequestLimiter();
const resetCompleteLimiter = createResetCompleteLimiter();

// Constant-work dummy hash so unknown accounts take as long as known ones.
// Same cost as real hashes, so a compare against it takes as long as a real one (timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', config.password.bcryptRounds);

const GENERIC_LOGIN_FAILURE = { error: 'Email or password is incorrect', code: 'INVALID_CREDENTIALS' } as const;

export const PasswordInputSchema = z
  .string()
  .min(1, 'Password is required')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password cannot exceed 72 bytes');

export const NewPasswordSchema = z
  .string()
  .min(config.password.minLength, `Password must be at least ${config.password.minLength} characters`)
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password cannot exceed 72 bytes');

const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: PasswordInputSchema,
});

const TotpCodeSchema = z.object({
  token: z.string().trim().regex(/^\d{6}$/, '2FA code must be exactly 6 digits'),
});

const EnrollStartSchema = z
  .object({
    // AU-8: one-time enrollment token from the operator CLI or another Owner (shown once there).
    enrollmentToken: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, 'Enrollment token is invalid'),
    // Fresh re-authentication at the moment of enrollment.
    currentPassword: PasswordInputSchema,
  })
  .strict();

const RecoverSchema = z.object({ code: z.string().trim().min(10).max(20) }).strict();

/** The four approved roles; anything else is a custom role (migration 014). */
const SYSTEM_ROLES: ReadonlySet<string> = new Set(['owner', 'data_entry', 'call_center', 'developer']);

const IssueEnrollmentTokenSchema = z
  .object({
    employeeId: z.string().uuid(),
    currentPassword: PasswordInputSchema,
    token: z.string().trim().regex(/^\d{6}$/, '2FA code must be exactly 6 digits'),
  })
  .strict();

const ResetRequestSchema = z.object({ email: z.string().email().max(255) });

const ResetCompleteSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  newPassword: NewPasswordSchema,
});

function clientIpOf(req: Request): string | null {
  return req.ip || req.socket.remoteAddress || null;
}

function lockoutFrom(row: { failed_count: number; failed_window_started_at: Date | null; locked_until: Date | null }): LockoutState {
  return {
    failedCount: row.failed_count,
    windowStartedAt: row.failed_window_started_at ? new Date(row.failed_window_started_at) : null,
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
  };
}

function publicUser(u: { id: string; email: string; full_name?: string; fullName?: string; role: string }) {
  return { id: u.id, email: u.email, fullName: u.fullName ?? u.full_name, role: u.role };
}

// ---------------------------------------------------------------------------
// POST /api/auth/login (SEQ-01)
// ---------------------------------------------------------------------------
router.post('/login', loginPairLimiter, loginIpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const clientIp = clientIpOf(req);
    // E-01/F-04: account-wide failures (all addresses) slow every attempt for this email, never refuse it.
    // Keyed by the submitted email, so unknown and known accounts behave the same.
    const accountKey = emailKey(email);
    const delay = accountDelayMs(loginAccountFailures.count(accountKey));
    if (delay > 0) await sleep(delay);
    const now = new Date();

    type Outcome =
      | { ok: false }
      | { ok: true; session: NewSession; user: ReturnType<typeof publicUser> };

    const outcome = await withTransaction<Outcome>(async (client) => {
      const audit = (eventName: string, extra: Partial<AuditLogOptions>) =>
        recordAuditEvent(client, {
          eventName,
          entityType: 'session',
          clientIp,
          requestId: req.requestId,
          sourceWorkflow: 'WF-AUTH-001',
          ...extra,
        });

      const { rows: empRows } = await client.query<{
        id: string;
        email: string;
        full_name: string;
        role: 'owner' | 'data_entry' | 'call_center' | 'developer';
        is_active: boolean;
      }>('SELECT id, email, full_name, role, is_active FROM employees WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
      const employee = empRows[0];

      const { rows: credRows } = employee
        ? await client.query<{
            password_hash: string;
            failed_count: number;
            failed_window_started_at: Date | null;
            locked_until: Date | null;
          }>(
            `SELECT password_hash, failed_count, failed_window_started_at, locked_until
             FROM credentials WHERE employee_id = $1 FOR UPDATE`,
            [employee.id]
          )
        : { rows: [] };
      const credential = credRows[0];

      if (!employee || !credential) {
        await bcrypt.compare(password, DUMMY_HASH);
        // AT-5: the submitted email is capped at 254 characters; the password is never stored.
        await audit('login.failed', { payload: { email: email.slice(0, 254), reason: 'unknown_account' } });
        return { ok: false };
      }

      // E-01: sign-in failures no longer set the account-wide DB lock (that lock let anyone who knew an
      // email keep the account, the Owner's included, locked). Guessing is bounded by the (email, IP) and
      // per-IP buckets plus the per-account delay above. `credentials.locked_until` now guards only the
      // in-session re-authentication steps (verifyCurrentPassword).
      const passwordOk = await bcrypt.compare(password, credential.password_hash);
      if (!passwordOk) {
        await audit('login.failed', {
          actorId: employee.id,
          actorRole: employee.role,
          entityType: 'employee',
          entityId: employee.id,
          payload: { reason: 'password_mismatch' },
        });
        return { ok: false };
      }

      // Deactivated: same generic message as a wrong password (SEQ-01/03), checked after the password.
      if (!employee.is_active) {
        await audit('login.failed', {
          actorId: employee.id,
          actorRole: employee.role,
          entityType: 'employee',
          entityId: employee.id,
          payload: { reason: 'account_deactivated' },
        });
        return { ok: false };
      }

      await client.query(
        'UPDATE credentials SET failed_count = 0, failed_window_started_at = NULL, locked_until = NULL WHERE employee_id = $1',
        [employee.id]
      );

      let state: SessionState = 'active';
      const { rows: f } = await client.query<{ is_enrolled: boolean }>(
        `SELECT is_enrolled FROM two_factor_factors WHERE employee_id = $1 AND factor_type = 'totp' LIMIT 1`,
        [employee.id]
      );
      if (employee.role === 'owner') {
        state = f[0]?.is_enrolled ? 'pending_2fa_verification' : 'pending_2fa_enrollment';
      } else if (f[0]?.is_enrolled) {
        // FX-ACCESS-R1: any account with an enrolled factor verifies it at sign-in, so its sessions
        // can run the grantable admin rows a custom role holds (registerSecondFactorVerifier).
        state = 'pending_2fa_verification';
      } else if (!SYSTEM_ROLES.has(employee.role)) {
        // A custom-role holder with an open enrollment token (issued by an Owner) enrols at sign-in.
        const { rows: t } = await client.query<{ id: string }>(
          `SELECT id FROM security_tokens WHERE employee_id = $1 AND purpose = 'two_factor_enrollment'
             AND used_at IS NULL AND superseded_at IS NULL AND expires_at > $2 LIMIT 1`,
          [employee.id, now]
        );
        if (t[0]) state = 'pending_2fa_enrollment';
      }

      const session = await createSession(client, {
        employeeId: employee.id,
        role: employee.role,
        state,
        clientIp,
        userAgent: req.get('user-agent') || null,
        now,
      });

      await audit('session.created', {
        actorId: employee.id,
        actorRole: employee.role,
        entityId: session.id,
        sessionId: session.id,
        payload: { state },
      });

      return { ok: true, session, user: publicUser(employee) };
    });

    if (!outcome.ok) {
      loginAccountFailures.add(accountKey);
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }
    loginAccountFailures.clear(accountKey);

    setSessionCookies(res, outcome.session);
    const requires2FA = outcome.session.state !== 'active';
    return res.status(200).json({
      message: requires2FA ? 'Two-factor authentication required' : 'Login successful',
      requires2FA,
      twoFactorStep:
        outcome.session.state === 'pending_2fa_enrollment'
          ? 'enroll'
          : outcome.session.state === 'pending_2fa_verification'
            ? 'verify'
            : null,
      csrfToken: outcome.session.csrfToken,
      user: outcome.user,
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------------------------------------
// TOTP check shared by verify, enrollment confirm and step-up actions
// ---------------------------------------------------------------------------
interface FactorRow extends FactorSecretRow {
  is_enrolled: boolean;
  last_used_step: string | null;
  failed_count: number;
  failed_window_started_at: Date | null;
  locked_until: Date | null;
  pending_enrollment_token_id: string | null;
}

const FACTOR_COLUMNS = `id, employee_id, secret, secret_ciphertext, secret_key_id, is_enrolled, last_used_step,
  failed_count, failed_window_started_at, locked_until, pending_enrollment_token_id`;

async function lockFactor(client: PoolClient, employeeId: string): Promise<FactorRow | undefined> {
  const { rows } = await client.query<FactorRow>(
    `SELECT ${FACTOR_COLUMNS} FROM two_factor_factors WHERE employee_id = $1 AND factor_type = 'totp' FOR UPDATE`,
    [employeeId]
  );
  return rows[0];
}

const hasSecret = (f: FactorRow) => Boolean(f.secret || f.secret_ciphertext);

type FactorCheck = { result: 'ok'; step: number } | { result: 'invalid'; lockedNow: boolean } | { result: 'locked' };

async function registerFactorFailure(client: PoolClient, factor: FactorRow, now: Date): Promise<boolean> {
  const nextState = registerFailure(lockoutFrom(factor), now, config.lockout);
  await client.query(
    'UPDATE two_factor_factors SET failed_count = $2, failed_window_started_at = $3, locked_until = $4 WHERE id = $1',
    [factor.id, nextState.failedCount, nextState.windowStartedAt, nextState.lockedUntil]
  );
  return isLocked(nextState, now);
}

async function clearFactorFailures(client: PoolClient, factorId: string, step: number | null): Promise<void> {
  await client.query(
    `UPDATE two_factor_factors SET last_used_step = COALESCE($2, last_used_step), failed_count = 0,
       failed_window_started_at = NULL, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [factorId, step]
  );
}

async function checkFactorCode(client: PoolClient, factor: FactorRow, code: string, now: Date): Promise<FactorCheck> {
  if (isLocked(lockoutFrom(factor), now)) return { result: 'locked' };

  // AU-13: the secret is stored encrypted; decrypt (and encrypt any legacy plaintext) here.
  const secret = await readFactorSecret(client, factor);
  const delta = authenticator.checkDelta(code, secret);
  const step = delta === null ? null : totpStep(now, delta);
  const lastUsed = factor.last_used_step === null ? null : Number(factor.last_used_step);
  if (step !== null && !isReplayedStep(step, lastUsed)) {
    await clearFactorFailures(client, factor.id, step);
    return { result: 'ok', step };
  }
  return { result: 'invalid', lockedNow: await registerFactorFailure(client, factor, now) };
}

// ---------------------------------------------------------------------------
// Step-up TOTP (R2-02 / EX-2, authz-matrix §3.10 `report.export`: "step-up TOTP ≤ 10 min").
// Run in its OWN transaction so a failed code still counts toward the factor lockout.
// ---------------------------------------------------------------------------
export type StepUpResult = 'ok' | 'invalid' | 'locked' | 'not_configured';

/** Check a current TOTP code for the session's employee and stamp `sessions.step_up_at` on success. */
export async function verifyStepUpTotp(
  client: PoolClient,
  employeeId: string,
  sessionId: string,
  code: string,
  now: Date
): Promise<StepUpResult> {
  const factor = await lockFactor(client, employeeId);
  if (!factor || !factor.is_enrolled || !hasSecret(factor)) return 'not_configured';
  const check = await checkFactorCode(client, factor, code, now);
  if (check.result === 'locked') return 'locked';
  if (check.result !== 'ok') return 'invalid';
  await client.query('UPDATE sessions SET step_up_at = $2 WHERE id = $1', [sessionId, now]);
  return 'ok';
}

/** True when this session completed a step-up within `maxAgeMinutes` of `now`. */
export async function hasRecentStepUp(sessionId: string, now: Date, maxAgeMinutes: number): Promise<boolean> {
  const { rows } = await query<{ step_up_at: Date | null }>('SELECT step_up_at FROM sessions WHERE id = $1', [sessionId]);
  const at = rows[0]?.step_up_at;
  if (!at) return false;
  const age = now.getTime() - new Date(at).getTime();
  return age >= 0 && age <= maxAgeMinutes * 60_000;
}

/** Fresh re-authentication with the account password (enrollment, token issuance). Counts toward the login lockout. */
async function verifyCurrentPassword(client: PoolClient, employeeId: string, password: string, now: Date): Promise<'ok' | 'invalid' | 'locked'> {
  const { rows } = await client.query<{
    password_hash: string;
    failed_count: number;
    failed_window_started_at: Date | null;
    locked_until: Date | null;
  }>(
    'SELECT password_hash, failed_count, failed_window_started_at, locked_until FROM credentials WHERE employee_id = $1 FOR UPDATE',
    [employeeId]
  );
  const cred = rows[0];
  if (!cred) {
    await bcrypt.compare(password, DUMMY_HASH);
    return 'invalid';
  }
  const lockout = lockoutFrom(cred);
  if (isLocked(lockout, now)) return 'locked';
  if (await bcrypt.compare(password, cred.password_hash)) {
    // A correct re-authentication starts the counter afresh (sign-in no longer touches it, E-01).
    if (cred.failed_count > 0 || cred.failed_window_started_at || cred.locked_until) {
      await client.query(
        'UPDATE credentials SET failed_count = 0, failed_window_started_at = NULL, locked_until = NULL WHERE employee_id = $1',
        [employeeId]
      );
    }
    return 'ok';
  }
  const nextState = registerFailure(lockout, now, config.lockout);
  await client.query(
    'UPDATE credentials SET failed_count = $2, failed_window_started_at = $3, locked_until = $4 WHERE employee_id = $1',
    [employeeId, nextState.failedCount, nextState.windowStartedAt, nextState.lockedUntil]
  );
  return isLocked(nextState, now) ? 'locked' : 'invalid';
}

type FactorOutcome =
  | { kind: 'ok'; session: NewSession; recoveryCodes?: string[]; recoveryCodesRemaining?: number }
  | { kind: 'invalid'; sessionEnded: boolean }
  | { kind: 'locked' }
  | { kind: 'not_configured' }
  | { kind: 'enrollment_token_invalid' };

type SecondFactorMode = 'verify' | 'enroll' | 'recover';

async function completeSecondFactor(req: Request, code: string, mode: SecondFactorMode): Promise<FactorOutcome> {
  const user = req.user!;
  const clientIp = clientIpOf(req);
  const now = new Date();

  return withTransaction<FactorOutcome>(async (client) => {
    const factor = await lockFactor(client, user.id);
    if (!factor || !hasSecret(factor) || factor.is_enrolled !== (mode !== 'enroll')) return { kind: 'not_configured' };

    const auditBase = {
      actorId: user.id,
      actorRole: user.role,
      entityType: 'session',
      clientIp,
      requestId: req.requestId,
      sourceWorkflow: 'WF-AUTH-001',
    };

    let check: FactorCheck;
    let recoveryCodeId: string | null = null;
    if (mode === 'recover') {
      // AU-9: a recovery code replaces the TOTP code for this sign-in. Same lockout as the TOTP factor.
      if (isLocked(lockoutFrom(factor), now)) check = { result: 'locked' };
      else {
        recoveryCodeId = await useRecoveryCode(client, user.id, code, user.sessionId);
        if (recoveryCodeId) {
          await clearFactorFailures(client, factor.id, null);
          check = { result: 'ok', step: 0 };
        } else check = { result: 'invalid', lockedNow: await registerFactorFailure(client, factor, now) };
      }
    } else {
      check = await checkFactorCode(client, factor, code, now);
    }

    if (check.result === 'locked') {
      await recordAuditEvent(client, {
        ...auditBase,
        eventName: 'session.second_factor_failed',
        entityId: user.sessionId,
        sessionId: user.sessionId,
        payload: { reason: 'locked', mode },
      });
      return { kind: 'locked' };
    }
    if (check.result === 'invalid') {
      await client.query('UPDATE sessions SET factor_fail_count = factor_fail_count + 1 WHERE id = $1', [user.sessionId]);
      await recordAuditEvent(client, {
        ...auditBase,
        eventName: 'session.second_factor_failed',
        entityId: user.sessionId,
        sessionId: user.sessionId,
        payload: { reason: mode === 'recover' ? 'invalid_recovery_code' : 'invalid_code', mode },
      });
      if (check.lockedNow) {
        // Threshold reached: the pending session ends (SEQ-01 failure path).
        await endSession(client, user.sessionId, 'factor_threshold');
        await recordAuditEvent(client, {
          ...auditBase,
          eventName: 'session.ended',
          entityId: user.sessionId,
          sessionId: user.sessionId,
          payload: { reason: 'factor_threshold' },
        });
      }
      return { kind: 'invalid', sessionEnded: check.lockedNow };
    }

    let recoveryCodes: string[] | undefined;
    if (mode === 'enroll') {
      // AU-8: the enrollment token bound at enroll/start must still be open; it is consumed here.
      const tokenId = factor.pending_enrollment_token_id;
      if (!tokenId || !(await consumeEnrollmentTokenById(client, tokenId, user.id))) {
        return { kind: 'enrollment_token_invalid' };
      }
      await client.query(
        `UPDATE two_factor_factors SET is_enrolled = true, enrolled_at = CURRENT_TIMESTAMP, pending_enrollment_token_id = NULL
         WHERE id = $1`,
        [factor.id]
      );
      await recordAuditEvent(client, {
        ...auditBase,
        eventName: 'two_factor.enrolled', // placeholder name (not in SEQ-01); needs approval (G2)
        entityType: 'employee',
        entityId: user.id,
        sessionId: user.sessionId,
        payload: { method: 'totp', enrollmentTokenId: tokenId },
      });
      // AU-9: first batch of recovery codes, shown once in this response.
      recoveryCodes = await replaceRecoveryCodes(client, user.id, flags['auth.recoveryCodeCount']);
      await recordAuditEvent(client, {
        ...auditBase,
        eventName: 'two_factor.recovery_codes_generated', // placeholder name; needs approval (G2)
        entityType: 'employee',
        entityId: user.id,
        sessionId: user.sessionId,
        payload: { count: recoveryCodes.length, reason: 'enrollment' },
      });
    }

    // Rotate the session id on success (SEQ-01; prevents session fixation).
    const session = await rotateSession(
      client,
      { id: user.sessionId, employeeId: user.id, role: user.role },
      { clientIp, userAgent: req.get('user-agent') || null, now }
    );
    await recordAuditEvent(client, {
      ...auditBase,
      eventName: 'session.second_factor_verified',
      entityId: session.id,
      sessionId: session.id,
      payload: { rotatedFrom: user.sessionId, mode },
    });

    let recoveryCodesRemaining: number | undefined;
    if (mode === 'recover') {
      recoveryCodesRemaining = await countOpenRecoveryCodes(client, user.id);
      await recordAuditEvent(client, {
        ...auditBase,
        eventName: 'two_factor.recovery_succeeded',
        entityType: 'employee',
        entityId: user.id,
        sessionId: session.id,
        payload: { recoveryCodeId, remaining: recoveryCodesRemaining },
      });
      // E-04: security notice to the Owner (BE5 consumer). Ids only.
      await outbox.emit(client, {
        name: 'two_factor.recovery_succeeded',
        aggregateType: 'employee',
        aggregateId: user.id,
        payload: { sessionId: session.id },
      });
    }
    return { kind: 'ok', session, recoveryCodes, recoveryCodesRemaining };
  });
}

function sendFactorOutcome(req: Request, res: Response, outcome: FactorOutcome) {
  switch (outcome.kind) {
    case 'not_configured':
      return res.status(400).json({ error: 'Two-factor authentication is not available for this step', code: '2FA_NOT_CONFIGURED' });
    case 'enrollment_token_invalid':
      return res.status(400).json({ error: 'The enrollment token has expired or was already used', code: 'ENROLLMENT_TOKEN_INVALID' });
    case 'locked':
      return res.status(429).json({ error: 'Too many attempts. Please wait and try again.', code: 'TOO_MANY_ATTEMPTS' });
    case 'invalid':
      if (outcome.sessionEnded) {
        clearSessionCookies(res);
        return res.status(401).json({ error: 'Too many attempts. Please sign in again later.', code: 'SESSION_ENDED' });
      }
      return res.status(400).json({ error: 'Invalid verification code', code: 'INVALID_2FA_TOKEN' });
    case 'ok': {
      setSessionCookies(res, outcome.session);
      const user = req.user!;
      return res.status(200).json({
        message: 'Two-factor authentication verified successfully',
        csrfToken: outcome.session.csrfToken,
        user: publicUser(user),
        // Shown once (enrollment). Never retrievable again.
        ...(outcome.recoveryCodes ? { recoveryCodes: outcome.recoveryCodes } : {}),
        ...(outcome.recoveryCodesRemaining !== undefined ? { recoveryCodesRemaining: outcome.recoveryCodesRemaining } : {}),
      });
    }
  }
}

// POST /api/auth/2fa/verify
router.post('/2fa/verify', authenticate, twoFactorLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.sessionState !== 'pending_2fa_verification') {
      return res.status(409).json({ error: 'No verification is pending for this session', code: '2FA_NOT_PENDING' });
    }
    const { token } = TotpCodeSchema.parse(req.body);
    return sendFactorOutcome(req, res, await completeSecondFactor(req, token, 'verify'));
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/2fa/recover — AU-9: sign in with a single-use recovery code instead of the TOTP code.
router.post('/2fa/recover', authenticate, recoveryLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.sessionState !== 'pending_2fa_verification') {
      return res.status(409).json({ error: 'No verification is pending for this session', code: '2FA_NOT_PENDING' });
    }
    const { code } = RecoverSchema.parse(req.body);
    return sendFactorOutcome(req, res, await completeSecondFactor(req, code, 'recover'));
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/2fa/enroll/start — AU-8: an Owner without a factor needs, besides the password used
// at login, (1) a one-time enrollment token issued out of band (operator CLI or another Owner) and
// (2) a fresh re-authentication with the current password. Returns a new TOTP secret (not yet active).
router.post('/2fa/enroll/start', authenticate, twoFactorLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (user.sessionState !== 'pending_2fa_enrollment') {
      return res.status(409).json({ error: 'Enrollment is not pending for this session', code: '2FA_NOT_PENDING' });
    }
    const { enrollmentToken, currentPassword } = EnrollStartSchema.parse(req.body);
    const now = new Date();
    const clientIp = clientIpOf(req);
    const secret = authenticator.generateSecret();

    type StartOutcome = 'ok' | 'password_invalid' | 'locked' | 'token_invalid' | 'already_enrolled';
    const outcome = await withTransaction<StartOutcome>(async (client) => {
      const auditBase = {
        actorId: user.id,
        actorRole: user.role,
        entityType: 'session',
        entityId: user.sessionId,
        sessionId: user.sessionId,
        clientIp,
        requestId: req.requestId,
        sourceWorkflow: 'WF-AUTH-001',
      };
      const pw = await verifyCurrentPassword(client, user.id, currentPassword, now);
      if (pw !== 'ok') {
        await recordAuditEvent(client, { ...auditBase, eventName: 'session.second_factor_failed', payload: { reason: `reauth_${pw}`, mode: 'enroll' } });
        return pw === 'locked' ? 'locked' : 'password_invalid';
      }
      const tokenId = await findOpenEnrollmentToken(client, user.id, enrollmentToken);
      if (!tokenId) {
        await recordAuditEvent(client, { ...auditBase, eventName: 'session.second_factor_failed', payload: { reason: 'enrollment_token_invalid', mode: 'enroll' } });
        return 'token_invalid';
      }
      // Encrypted at rest (AU-13). The token is bound to the pending factor and consumed at confirm.
      if (!(await storePendingSecret(client, user.id, secret, tokenId))) return 'already_enrolled';
      return 'ok';
    });

    switch (outcome) {
      case 'password_invalid':
        return res.status(400).json({ error: 'Password is incorrect', code: 'REAUTH_FAILED' });
      case 'locked':
        return res.status(429).json({ error: 'Too many attempts. Please wait and try again.', code: 'TOO_MANY_ATTEMPTS' });
      case 'token_invalid':
        return res.status(400).json({ error: 'The enrollment token has expired or was already used', code: 'ENROLLMENT_TOKEN_INVALID' });
      case 'already_enrolled':
        return res.status(409).json({ error: 'Two-factor authentication is already enrolled', code: '2FA_ALREADY_ENROLLED' });
      case 'ok':
        break;
    }
    // The secret is returned once so the authenticator app can be set up; it is never logged or audited.
    return res.status(200).json({
      method: 'totp',
      secret,
      otpauthUrl: authenticator.keyuri(user.email, config.totp.issuer, secret),
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/2fa/enroll/confirm — first valid code activates the factor and the session;
// consumes the enrollment token and returns the first recovery codes (shown once).
router.post('/2fa/enroll/confirm', authenticate, twoFactorLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.sessionState !== 'pending_2fa_enrollment') {
      return res.status(409).json({ error: 'Enrollment is not pending for this session', code: '2FA_NOT_PENDING' });
    }
    const { token } = TotpCodeSchema.parse(req.body);
    return sendFactorOutcome(req, res, await completeSecondFactor(req, token, 'enroll'));
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/2fa/recovery-codes — AU-9: an Owner with a completed 2FA session generates a new
// batch (the old batch stops working). Step-up: a current TOTP code is required.
router.post(
  '/2fa/recovery-codes',
  authenticate,
  requireAction('employee.manage_own_recovery_codes'),
  twoFactorAdminLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { token } = TotpCodeSchema.parse(req.body);
      const now = new Date();
      type Out = { kind: 'ok'; codes: string[] } | { kind: 'invalid' } | { kind: 'locked' } | { kind: 'not_configured' };
      const out = await withTransaction<Out>(async (client) => {
        const factor = await lockFactor(client, user.id);
        if (!factor || !factor.is_enrolled || !hasSecret(factor)) return { kind: 'not_configured' };
        const check = await checkFactorCode(client, factor, token, now);
        if (check.result !== 'ok') return { kind: check.result === 'locked' ? 'locked' : 'invalid' };
        const codes = await replaceRecoveryCodes(client, user.id, flags['auth.recoveryCodeCount']);
        await recordAuditEvent(client, {
          eventName: 'two_factor.recovery_codes_generated', // placeholder name; needs approval (G2)
          actorId: user.id,
          actorRole: user.role,
          entityType: 'employee',
          entityId: user.id,
          sessionId: user.sessionId,
          requestId: req.requestId,
          clientIp: clientIpOf(req),
          payload: { count: codes.length, reason: 'regenerated' },
          sourceWorkflow: 'WF-AUTH-001',
        });
        return { kind: 'ok', codes };
      });
      if (out.kind === 'not_configured') {
        return res.status(400).json({ error: 'Two-factor authentication is not available for this step', code: '2FA_NOT_CONFIGURED' });
      }
      if (out.kind === 'locked') return res.status(429).json({ error: 'Too many attempts. Please wait and try again.', code: 'TOO_MANY_ATTEMPTS' });
      if (out.kind === 'invalid') return res.status(400).json({ error: 'Invalid verification code', code: 'INVALID_2FA_TOKEN' });
      return res.status(200).json({ recoveryCodes: out.codes });
    } catch (error) {
      return next(error);
    }
  }
);

// POST /api/auth/2fa/enrollment-tokens — AU-8 option "token from an existing session": an Owner with a
// completed 2FA session issues a one-time enrollment token for ANOTHER active Owner who has no factor.
// Fresh re-auth: the issuing Owner's current password and a current TOTP code. The token is shown once
// and handed over out of band.
router.post(
  '/2fa/enrollment-tokens',
  authenticate,
  requireAction('employee.issue_2fa_enrollment_token'),
  twoFactorAdminLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const body = IssueEnrollmentTokenSchema.parse(req.body);
      const now = new Date();
      const clientIp = clientIpOf(req);
      type Out =
        | { kind: 'ok'; token: string; expiresAt: Date }
        | { kind: 'reauth_failed' }
        | { kind: 'locked' }
        | { kind: 'not_eligible' };
      const out = await withTransaction<Out>(async (client) => {
        const pw = await verifyCurrentPassword(client, user.id, body.currentPassword, now);
        if (pw === 'locked') return { kind: 'locked' };
        if (pw !== 'ok') return { kind: 'reauth_failed' };
        const factor = await lockFactor(client, user.id);
        if (!factor || !factor.is_enrolled || !hasSecret(factor)) return { kind: 'reauth_failed' };
        const check = await checkFactorCode(client, factor, body.token, now);
        if (check.result === 'locked') return { kind: 'locked' };
        if (check.result !== 'ok') return { kind: 'reauth_failed' };

        const { rows } = await client.query<{ role: string; is_active: boolean; is_enrolled: boolean | null }>(
          `SELECT e.role, e.is_active, f.is_enrolled FROM employees e
           LEFT JOIN two_factor_factors f ON f.employee_id = e.id AND f.factor_type = 'totp'
           WHERE e.id = $1 FOR UPDATE OF e`,
          [body.employeeId]
        );
        const target = rows[0];
        // FX-ACCESS-R1: Owners and custom-role holders (never the three other system roles).
        const eligibleRole = target && (target.role === 'owner' || !SYSTEM_ROLES.has(target.role));
        if (!target || body.employeeId === user.id || !eligibleRole || !target.is_active || target.is_enrolled) {
          return { kind: 'not_eligible' };
        }
        const issued = await issueEnrollmentToken(client, {
          employeeId: body.employeeId,
          issuedBy: user.id,
          issuedVia: 'owner_session',
          requestedIp: clientIp,
          now,
        });
        await recordAuditEvent(client, {
          eventName: 'two_factor.enrollment_token_issued', // placeholder name; needs approval (G2)
          actorId: user.id,
          actorRole: user.role,
          entityType: 'employee',
          entityId: body.employeeId,
          sessionId: user.sessionId,
          requestId: req.requestId,
          clientIp,
          payload: { securityTokenId: issued.id, via: 'owner_session' },
          sourceWorkflow: 'WF-AUTH-001',
        });
        return { kind: 'ok', token: issued.token, expiresAt: issued.expiresAt };
      });
      if (out.kind === 'locked') return res.status(429).json({ error: 'Too many attempts. Please wait and try again.', code: 'TOO_MANY_ATTEMPTS' });
      if (out.kind === 'reauth_failed') return res.status(400).json({ error: 'Password or verification code is incorrect', code: 'REAUTH_FAILED' });
      if (out.kind === 'not_eligible') {
        return res.status(409).json({ error: 'This employee cannot receive an enrollment token', code: 'STATE_CONFLICT' });
      }
      return res.status(201).json({ enrollmentToken: out.token, expiresAt: out.expiresAt.toISOString() });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/auth/2fa/status
router.get('/2fa/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { rows } = await query<{ is_enrolled: boolean }>(
      `SELECT is_enrolled FROM two_factor_factors WHERE employee_id = $1 AND factor_type = 'totp' LIMIT 1`,
      [user.id]
    );
    const enrolled = Boolean(rows[0]?.is_enrolled);
    return res.status(200).json({
      required: user.role === 'owner',
      method: 'totp',
      enrolled,
      sessionState: user.sessionState,
      pending: user.sessionState !== 'active',
      // Enrollment needs a one-time token (AU-8).
      enrollmentTokenRequired: user.role === 'owner' && !enrolled,
      recoveryCodesRemaining: enrolled ? await countOpenRecoveryCodes({ query }, user.id) : 0,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    await withTransaction(async (client) => {
      await endSession(client, user.sessionId, 'logout');
      await recordAuditEvent(client, {
        eventName: 'session.ended',
        actorId: user.id,
        actorRole: user.role,
        entityType: 'session',
        entityId: user.sessionId,
        sessionId: user.sessionId,
        requestId: req.requestId,
        clientIp: clientIpOf(req),
        payload: { reason: 'logout' },
        sourceWorkflow: 'WF-AUTH-001',
      });
    });
    clearSessionCookies(res);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/sessions/revoke-all — "Sign out everywhere" (SHR-006, CR1-03). Ends EVERY session of
// the caller, including this one, in one transaction with its audit row, then clears the cookies.
// `{ keepCurrent: true }` ends only the other sessions (the current one stays signed in).
const RevokeAllSchema = z.object({ keepCurrent: z.boolean().optional() }).strict();

router.post('/sessions/revoke-all', authenticate, requireAction('auth.session.revoke_all'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keepCurrent } = RevokeAllSchema.parse(req.body ?? {});
    const user = req.user!;
    const ended = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `UPDATE sessions
         SET state = 'ended', end_reason = 'revoked', ended_at = CURRENT_TIMESTAMP,
             revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), is_pending_2fa = false
         WHERE employee_id = $1 AND state <> 'ended' AND ($2::uuid IS NULL OR id <> $2::uuid)
         RETURNING id`,
        [user.id, keepCurrent ? user.sessionId : null]
      );
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        await recordAuditEvent(client, {
          eventName: 'session.revoked',
          actorId: user.id,
          actorRole: user.role,
          entityType: 'employee',
          entityId: user.id,
          sessionId: user.sessionId,
          requestId: req.requestId,
          clientIp: clientIpOf(req),
          payload: { reason: keepCurrent ? 'sign_out_other_devices' : 'sign_out_everywhere', sessionIds: ids },
          sourceWorkflow: 'SCR-SHR-006',
        });
      }
      return ids;
    });
    if (!keepCurrent) clearSessionCookies(res);
    return res.status(200).json({ revoked: ended.length, currentSessionEnded: !keepCurrent });
  } catch (error) {
    return next(error);
  }
});

const ChangePasswordSchema = z.object({
  currentPassword: PasswordInputSchema,
  newPassword: NewPasswordSchema,
});

router.post('/password/change', authenticate, requireAction('auth.password.change'), passwordChangeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
    const clientIp = clientIpOf(req);
    const now = new Date();

    // E-05: the current-password check counts toward the re-authentication lockout. Own transaction,
    // so a wrong guess is committed even though the change is refused.
    const pw = await withTransaction((client) => verifyCurrentPassword(client, user.id, currentPassword, now));
    if (pw === 'locked') return sendRateLimited(res, config.lockout.lockMinutes * 60);
    if (pw !== 'ok') {
      return res.status(401).json({ error: 'The current password is not correct.', code: 'INVALID_CREDENTIALS' });
    }

    const newHash = await bcrypt.hash(newPassword, config.password.bcryptRounds);
    const rotated = await withTransaction(async (client) => {
      await client.query(
        `UPDATE credentials SET password_hash = $1, failed_count = 0, failed_window_started_at = NULL, locked_until = NULL,
           updated_at = CURRENT_TIMESTAMP WHERE employee_id = $2`,
        [newHash, user.id]
      );
      const { rows: revokedRows } = await client.query<{ id: string }>(
        `UPDATE sessions
         SET state = 'ended', end_reason = 'revoked', ended_at = CURRENT_TIMESTAMP,
             revoked_at = CURRENT_TIMESTAMP
         WHERE employee_id = $1 AND state <> 'ended' AND id <> $2
         RETURNING id`,
        [user.id, user.sessionId]
      );
      // E-04: a reset or set-up link issued before the change must not overwrite the new password.
      const superseded = await client.query(
        `UPDATE security_tokens SET superseded_at = CURRENT_TIMESTAMP
         WHERE employee_id = $1 AND purpose IN ('password_reset', 'credential_setup')
           AND used_at IS NULL AND superseded_at IS NULL`,
        [user.id]
      );
      // E-09: new token for THIS session (same session id, so expiry, 2FA state and the CSRF token are
      // unchanged); a stolen copy of the old cookie stops working.
      const token = generateToken();
      const { rows: sessionRows } = await client.query<{ expires_at: Date }>(
        'UPDATE sessions SET token_hash = $2 WHERE id = $1 RETURNING expires_at',
        [user.sessionId, hashToken(config.session.secret, token)]
      );
      await recordAuditEvent(client, {
        eventName: 'password.changed',
        actorId: user.id,
        actorRole: user.role,
        entityType: 'employee',
        entityId: user.id,
        sessionId: user.sessionId,
        requestId: req.requestId,
        clientIp,
        payload: {
          otherSessionsRevoked: revokedRows.length,
          resetLinksRevoked: superseded.rowCount ?? 0,
          sessionTokenRotated: true,
        },
        sourceWorkflow: 'SCR-SHR-006',
      });
      return { token, expiresAt: new Date(sessionRows[0].expires_at) };
    });

    setSessionCookies(res, { token: rotated.token, csrfToken: user.csrfToken, expiresAt: rotated.expiresAt });
    return res.status(200).json({ message: 'Password changed successfully', csrfToken: user.csrfToken });
  } catch (error) {
    return next(error);
  }
});

// GET /api/auth/me — also returns the CSRF token the UI must echo in X-CSRF-Token on mutations.
router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = req.user!;
  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      jobTitle: user.jobTitle,
      isPending2FA: user.isPending2FA,
      sessionState: user.sessionState,
    },
    // Role-level capabilities for nav/buttons (plan §9). The server still decides on every request.
    // Empty for an Owner whose 2FA is pending.
    capabilities: capabilitiesFor(principalFromRequest(req)),
    csrfToken: user.csrfToken,
  });
});

// ---------------------------------------------------------------------------
// Password reset (SEQ-02). Email delivery: E-03 outbox → MOD-notifications (J-02).
// ---------------------------------------------------------------------------
const RESET_REQUEST_ACK = {
  message: 'If an active account exists for that email, a reset link has been sent.',
} as const;

router.post('/password-reset/request', resetRequestLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  try {
    const { email } = ResetRequestSchema.parse(req.body);
    const clientIp = clientIpOf(req);
    const now = new Date();

    // F-05: at most N links per email per hour; further requests are answered the same way and do
    // nothing (counted for unknown emails too, so the cap reveals nothing).
    const withinCap = resetRequestsPerEmail.add(emailKey(email)) <= RESET_REQUESTS_PER_EMAIL_PER_HOUR;

    if (withinCap) await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; email: string; role: string }>(
        `SELECT e.id, e.email, e.role FROM employees e
         JOIN credentials c ON c.employee_id = e.id
         WHERE LOWER(e.email) = LOWER($1) AND e.is_active = true LIMIT 1`,
        [email]
      );
      const employee = rows[0];
      if (!employee) return;

      await client.query(
        `UPDATE security_tokens SET superseded_at = CURRENT_TIMESTAMP
         WHERE employee_id = $1 AND purpose = 'password_reset' AND used_at IS NULL AND superseded_at IS NULL`,
        [employee.id]
      );
      const rawToken = generateToken();
      const expiresAt = new Date(now.getTime() + config.password.resetTtlMinutes * 60_000);
      const { rows: tokenRows } = await client.query<{ id: string }>(
        `INSERT INTO security_tokens (employee_id, purpose, token_hash, expires_at, requested_ip)
         VALUES ($1, 'password_reset', $2, $3, $4) RETURNING id`,
        [employee.id, hashToken(config.session.secret, rawToken), expiresAt, clientIp]
      );
      await recordAuditEvent(client, {
        eventName: 'password_reset.requested',
        entityType: 'employee',
        entityId: employee.id,
        clientIp,
        requestId: req.requestId,
        payload: { securityTokenId: tokenRows[0].id },
        sourceWorkflow: 'WF-AUTH-002',
      });
      // E-03 (BE5-R1): the raw token is stored encrypted by MOD-notifications and the outbox event
      // carries the token id only. The email is sent by J-02 after commit, never inside this tx.
      await queuePasswordResetEmail(client, {
        employeeId: employee.id,
        securityTokenId: tokenRows[0].id,
        rawToken,
        expiresAt,
      });
    });

    // E-06: known and unknown emails answer after the same minimum time (the known path does the DB
    // work above; without the floor its extra ~30 ms revealed that the account exists).
    await padTo(startedAt, RESET_REQUEST_MIN_MS);
    return res.status(202).json(RESET_REQUEST_ACK);
  } catch (error) {
    // Validation errors still get the generic acknowledgement shape, so nothing is revealed.
    return next(error);
  }
});

// 'credential_setup' (E-01, new employee) uses the same single-use link and page as a reset.
const OPEN_RESET_TOKEN_SQL = `SELECT st.id, st.employee_id, e.role, st.purpose
         FROM security_tokens st JOIN employees e ON e.id = st.employee_id
         WHERE st.token_hash = $1 AND st.purpose IN ('password_reset', 'credential_setup')
           AND st.used_at IS NULL AND st.superseded_at IS NULL AND st.expires_at > CURRENT_TIMESTAMP
           AND e.is_active = true`;

router.post('/password-reset/complete', resetCompleteLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = ResetCompleteSchema.parse(req.body);
    const clientIp = clientIpOf(req);
    const tokenHash = hashToken(config.session.secret, token);

    // F-08: no bcrypt work for an invalid link. Cheap pre-check, then hash, then the locked re-check
    // inside the transaction (the token can still be used or superseded in between).
    const pre = await query(OPEN_RESET_TOKEN_SQL, [tokenHash]);
    if (!pre.rows[0]) {
      return res.status(400).json({ error: 'This link has expired or was already used', code: 'RESET_LINK_INVALID' });
    }
    const newHash = await bcrypt.hash(newPassword, config.password.bcryptRounds);

    const ok = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; employee_id: string; role: string; purpose: string }>(
        `${OPEN_RESET_TOKEN_SQL}
         FOR UPDATE OF st`,
        [tokenHash]
      );
      const row = rows[0];
      if (!row) return false;

      await client.query('UPDATE security_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
      await client.query(
        `INSERT INTO credentials (employee_id, password_hash) VALUES ($1, $2)
         ON CONFLICT (employee_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_count = 0,
           failed_window_started_at = NULL, locked_until = NULL, updated_at = CURRENT_TIMESTAMP`,
        [row.employee_id, newHash]
      );
      const ended = await endAllSessions(client, row.employee_id, 'password_reset');
      const auditBase = {
        actorId: row.employee_id,
        actorRole: row.role,
        entityType: 'employee',
        entityId: row.employee_id,
        clientIp,
        requestId: req.requestId,
        sourceWorkflow: 'WF-AUTH-002',
      };
      await recordAuditEvent(client, {
        ...auditBase,
        // credential_setup.completed: placeholder name (E-01 follow-up); needs approval (G2).
        eventName: row.purpose === 'credential_setup' ? 'credential_setup.completed' : 'password_reset.completed',
        payload: { securityTokenId: row.id },
      });
      if (ended.length > 0) {
        await recordAuditEvent(client, {
          ...auditBase,
          eventName: 'session.revoked',
          payload: { reason: 'password_reset', sessionIds: ended },
        });
      }
      return true;
    });

    if (!ok) {
      return res.status(400).json({ error: 'This link has expired or was already used', code: 'RESET_LINK_INVALID' });
    }
    clearSessionCookies(res);
    return res.status(200).json({ message: 'Password updated. Please sign in.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
