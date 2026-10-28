/**
 * Session persistence (MOD-identity). All functions take the caller's client so they run
 * inside the caller's transaction together with the audit row.
 */
import type { Response } from 'express';
import type { Queryable } from '../../db/pool.js';
import { config } from '../../config/index.js';
import {
  SessionEndReason,
  SessionState,
  absoluteExpiry,
  deriveCsrfToken,
  generateToken,
  hashToken,
  nextIdleExpiry,
} from './security.js';

export interface NewSession {
  id: string;
  token: string; // raw token: goes into the HttpOnly cookie only, never into a response body
  csrfToken: string;
  expiresAt: Date;
  state: SessionState;
}

export interface CreateSessionInput {
  employeeId: string;
  role: string;
  state: SessionState;
  clientIp?: string | null;
  userAgent?: string | null;
  rotatedFrom?: string | null;
  now?: Date;
}

export async function createSession(client: Queryable, input: CreateSessionInput): Promise<NewSession> {
  const now = input.now ?? new Date();
  const token = generateToken();
  const nonce = generateToken(16);
  const expiresAt = absoluteExpiry(now, config.session, input.state);
  const idleExpiresAt = nextIdleExpiry(now, config.session);
  const { rows } = await client.query<{ id: string }>(
    `
    INSERT INTO sessions (
      token, token_hash, csrf_nonce, employee_id, role, state, is_pending_2fa,
      client_ip, user_agent, expires_at, idle_expires_at, rotated_from
    ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id;
    `,
    [
      hashToken(config.session.secret, token),
      nonce,
      input.employeeId,
      input.role,
      input.state,
      input.state !== 'active',
      input.clientIp ?? null,
      input.userAgent ?? null,
      expiresAt,
      idleExpiresAt,
      input.rotatedFrom ?? null,
    ]
  );
  const id = rows[0].id;
  return { id, token, csrfToken: deriveCsrfToken(config.session.secret, id, nonce), expiresAt, state: input.state };
}

export async function endSession(client: Queryable, sessionId: string, reason: SessionEndReason): Promise<void> {
  await client.query(
    `
    UPDATE sessions
    SET state = 'ended', end_reason = $2, ended_at = CURRENT_TIMESTAMP,
        revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), is_pending_2fa = false
    WHERE id = $1 AND state <> 'ended';
    `,
    [sessionId, reason]
  );
}

/** Ends every live session of an employee. Returns the ended session ids. */
export async function endAllSessions(
  client: Queryable,
  employeeId: string,
  reason: SessionEndReason
): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    `
    UPDATE sessions
    SET state = 'ended', end_reason = $2, ended_at = CURRENT_TIMESTAMP,
        revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), is_pending_2fa = false
    WHERE employee_id = $1 AND state <> 'ended'
    RETURNING id;
    `,
    [employeeId, reason]
  );
  return rows.map((r) => r.id);
}

/**
 * Session rotation after 2FA success (SEQ-01, prevents session fixation):
 * ends the old session (reason 'rotated') and creates a new active one with a new id and token.
 */
export async function rotateSession(
  client: Queryable,
  old: { id: string; employeeId: string; role: string },
  meta: { clientIp?: string | null; userAgent?: string | null; now?: Date }
): Promise<NewSession> {
  await endSession(client, old.id, 'rotated');
  return createSession(client, {
    employeeId: old.employeeId,
    role: old.role,
    state: 'active',
    clientIp: meta.clientIp,
    userAgent: meta.userAgent,
    rotatedFrom: old.id,
    now: meta.now,
  });
}

export function setSessionCookies(res: Response, session: Pick<NewSession, 'token' | 'csrfToken' | 'expiresAt'>): void {
  res.cookie(config.session.cookieName, session.token, {
    httpOnly: true,
    secure: config.session.secureCookie,
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
  // Readable by the UI so it can echo it in the X-CSRF-Token header (double-submit + server check).
  res.cookie(config.session.csrfCookieName, session.csrfToken, {
    httpOnly: false,
    secure: config.session.secureCookie,
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(config.session.cookieName, { path: '/', secure: config.session.secureCookie });
  res.clearCookie(config.session.csrfCookieName, { path: '/', secure: config.session.secureCookie });
}
