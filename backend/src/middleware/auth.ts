import { Request, Response, NextFunction } from 'express';
import { query, Queryable } from '../db/pool.js';
import { config } from '../config/index.js';
import { countAuthenticatedRead } from '../shared/rateLimit.js';
import {
  MUTATING_METHODS,
  SessionState,
  evaluateSession,
  isPendingRequestAllowed,
  nextIdleExpiry,
  safeEqual,
} from '../modules/identity/security.js';
import { csrfToken as issueCsrfToken, csrfTokenCandidates, tokenHash, tokenHashCandidates } from '../modules/identity/keys.js';

export type Role = 'owner' | 'data_entry' | 'call_center' | 'developer' | (string & {});

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department?: string;
  jobTitle?: string;
  isPending2FA: boolean;
  sessionId: string;
  sessionState: SessionState;
  csrfToken: string;
  /**
   * FX-ACCESS-R1: this session completed a second factor (TOTP verify rotated it out of
   * pending_2fa_verification) and the account has an enrolled factor. Owners: same rule.
   */
  secondFactorVerified?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

interface SessionRow {
  session_id: string;
  token_hash: string;
  state: SessionState;
  created_at: Date;
  expires_at: Date;
  idle_expires_at: Date | null;
  csrf_nonce: string | null;
  second_factor_verified: boolean;
  employee_id: string;
  email: string;
  full_name: string;
  role: Role;
  department: string;
  job_title: string;
  is_active: boolean;
}

/** Generic 401 body. Codes let the UI choose wording; messages reveal nothing about accounts. */
function unauthenticated(res: Response, code: 'UNAUTHENTICATED' | 'SESSION_EXPIRED' | 'SESSION_INVALID') {
  const error = code === 'SESSION_EXPIRED' ? 'Session expired. Please sign in again.' : 'Authentication required';
  return res.status(401).json({ error, code });
}

/** Dependencies are injectable so the pipeline can be unit-tested without a database. */
export interface AuthDeps {
  db: Queryable;
  now: () => Date;
}

export function createAuthenticate(deps: AuthDeps) {
  return async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      // Cookie only. The Bearer header path was removed (ADR-002/003: HttpOnly cookie transport).
      const token: string | undefined = req.cookies?.[config.session.cookieName];
      if (!token) return unauthenticated(res, 'UNAUTHENTICATED');

      // 1. Look up the session by token hash (raw tokens are never stored).
      const { rows } = await deps.db.query<SessionRow>(
        `
        SELECT s.id AS session_id, s.token_hash, s.state, s.created_at, s.expires_at, s.idle_expires_at, s.csrf_nonce,
               (s.rotated_from IS NOT NULL AND EXISTS (
                  SELECT 1 FROM two_factor_factors f
                   WHERE f.employee_id = e.id AND f.factor_type = 'totp' AND f.is_enrolled = true)) AS second_factor_verified,
               e.id AS employee_id, e.email, e.full_name, e.role, e.department, e.job_title, e.is_active
        FROM sessions s
        JOIN employees e ON s.employee_id = e.id
        WHERE s.token_hash = ANY($1::text[])
        LIMIT 1;
        `,
        // Per-purpose key first, then the legacy and previous-secret hashes (identity/keys.ts).
        [tokenHashCandidates('session-token', token)]
      );
      if (rows.length === 0) return unauthenticated(res, 'SESSION_INVALID');
      const session = rows[0];
      const now = deps.now();

      // 2. Idle and absolute expiry (and the short pending-2FA window).
      const evaluation = evaluateSession(
        {
          state: session.state,
          createdAt: new Date(session.created_at),
          expiresAt: new Date(session.expires_at),
          idleExpiresAt: session.idle_expires_at ? new Date(session.idle_expires_at) : null,
        },
        now,
        config.session
      );
      if (!evaluation.ok) {
        if (evaluation.reason !== 'ended') {
          await deps.db.query(
            `UPDATE sessions SET state = 'ended', end_reason = $2, ended_at = CURRENT_TIMESTAMP,
               revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), is_pending_2fa = false
             WHERE id = $1 AND state <> 'ended'`,
            [session.session_id, evaluation.reason]
          );
          return unauthenticated(res, 'SESSION_EXPIRED');
        }
        return unauthenticated(res, 'SESSION_INVALID');
      }

      // 3. Re-read account status on every request (never cached in the session).
      if (!session.is_active) {
        await deps.db.query(
          `UPDATE sessions SET state = 'ended', end_reason = 'account_deactivated', ended_at = CURRENT_TIMESTAMP,
             revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), is_pending_2fa = false
           WHERE id = $1 AND state <> 'ended'`,
          [session.session_id]
        );
        return unauthenticated(res, 'SESSION_INVALID');
      }

      // A session found by a legacy or previous-secret hash is re-keyed now (identity/keys.ts rotation).
      const currentHash = tokenHash('session-token', token);
      if (session.token_hash !== currentHash) {
        await deps.db.query('UPDATE sessions SET token_hash = $2 WHERE id = $1 AND token_hash = $3', [
          session.session_id,
          currentHash,
          session.token_hash,
        ]);
      }
      const csrfToken = issueCsrfToken(session.session_id, session.csrf_nonce || '');
      req.user = {
        id: session.employee_id,
        email: session.email,
        fullName: session.full_name,
        role: session.role,
        department: session.department,
        jobTitle: session.job_title,
        isPending2FA: session.state !== 'active',
        sessionId: session.session_id,
        sessionState: session.state,
        csrfToken,
        secondFactorVerified: Boolean(session.second_factor_verified),
      };

      // 4. Owner Pending-2FA restriction.
      // R-11 working default R11-a — Demonstration alternative — not approved (docs/policy-defaults.md).
      // Configurable via OWNER_PENDING_2FA_SCOPE (R11-a | R11-b). Admin routes are always denied
      // while pending (Confirmed); requireRole enforces that for R11-b.
      const path = `${req.baseUrl}${req.path}`;
      if (!isPendingRequestAllowed(session.state, req.method, path, config.owner2faPendingScope, false)) {
        return res.status(403).json({
          error: 'Two-factor authentication must be completed first',
          code: 'OWNER_2FA_REQUIRED',
        });
      }

      // 5. CSRF token on every authenticated mutation (the Origin check runs earlier, globally).
      if (MUTATING_METHODS.has(req.method.toUpperCase())) {
        const sent = req.get('x-csrf-token') || '';
        // A CSRF token issued before a key change stays valid for the session's life (identity/keys.ts).
        const accepted = session.csrf_nonce ? csrfTokenCandidates(session.session_id, session.csrf_nonce) : [];
        if (accepted.length === 0 || !accepted.some((t) => safeEqual(sent, t))) {
          return res.status(403).json({ error: 'Request could not be verified', code: 'CSRF_FAILED' });
        }
      }

      // Slide the idle window.
      await deps.db.query(
        'UPDATE sessions SET last_active_at = $2, idle_expires_at = $3 WHERE id = $1',
        [session.session_id, now, nextIdleExpiry(now, config.session)]
      );

      // F-07: the read budget is per employee, charged now that the session is known.
      return countAuthenticatedRead(req, res, next, path);
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticate = createAuthenticate({ db: { query }, now: () => new Date() });

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied', code: 'FORBIDDEN_ROLE' });
    }

    // Owner-only routes are admin routes: never reachable before 2FA completes (Confirmed, arch-b §6 2b).
    if (allowedRoles.length === 1 && allowedRoles[0] === 'owner' && req.user.sessionState !== 'active') {
      return res.status(403).json({
        error: 'Two-factor authentication must be completed first',
        code: 'OWNER_2FA_REQUIRED',
      });
    }

    return next();
  };
}
