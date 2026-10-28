/**
 * MOD-identity — service (public operations for other modules). Owner: BE1.
 * Increment 1 HTTP logic lives in routes.ts, sessions.ts and security.ts.
 */
import type { Queryable } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { recordAuditEvent } from '../admin/audit.js';
import type { DeliveredEvent, OutboxConsumer } from '../../shared/outbox.js';
import type { CommandContext } from '../../shared/tx.js';
import { stashSecuritySecret } from '../notifications/service.js';
import { generateToken, hashToken } from './security.js';
import { endAllSessions } from './sessions.js';

/** Credential-setup link lifetime (E-01). Same working default as a reset: IMPL-PASSWORD. */
const CREDENTIAL_SETUP_TTL_HOURS = 72;

/**
 * E-01 (account.created): issue the single-use credential-setup token in the create transaction and
 * hand the raw token to MOD-notifications (encrypted, keyed by the token id). The new employee sets a
 * password through /reset-password?token=… (same page and endpoint as a reset). Returns the token id
 * for the outbox payload; the raw token never enters the outbox, audit or logs.
 */
export async function issueCredentialSetup(
  tx: Queryable,
  employeeId: string,
  now: Date,
  issuedBy: string | null
): Promise<{ securityTokenId: string; expiresAt: Date }> {
  await tx.query(
    `UPDATE security_tokens SET superseded_at = CURRENT_TIMESTAMP
     WHERE employee_id = $1 AND purpose = 'credential_setup' AND used_at IS NULL AND superseded_at IS NULL`,
    [employeeId]
  );
  const raw = generateToken();
  const expiresAt = new Date(now.getTime() + CREDENTIAL_SETUP_TTL_HOURS * 3_600_000);
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO security_tokens (employee_id, purpose, token_hash, expires_at, issued_by, issued_via)
     VALUES ($1, 'credential_setup', $2, $3, $4, 'system') RETURNING id`,
    [employeeId, hashToken(config.session.secret, raw), expiresAt, issuedBy]
  );
  await stashSecuritySecret(tx, rows[0].id, raw, expiresAt);
  return { securityTokenId: rows[0].id, expiresAt };
}

/** Ends every live session of an employee and writes `session.revoked` (System actor) when any ended. */
export async function revokeAllSessions(
  tx: Queryable,
  employeeId: string,
  reason: 'account_deactivated' | 'revoked',
  meta: { requestId?: string | null; cause: string; sourceWorkflow: string }
): Promise<string[]> {
  const ended = await endAllSessions(tx, employeeId, reason);
  if (ended.length > 0) {
    await recordAuditEvent(tx, {
      eventName: 'session.revoked',
      actorId: null, // System
      entityType: 'employee',
      entityId: employeeId,
      requestId: meta.requestId ?? null,
      payload: { reason: meta.cause, sessionIds: ended },
      sourceWorkflow: meta.sourceWorkflow,
    });
  }
  return ended;
}

export interface SecuritySummary {
  twoFactorEnrolled: boolean;
  sessions: { activeCount: number; activeSince: string | null; lastSignOutAt: string | null };
}

/** OWN-002/003 columns: 2FA enrolled + live-session summary per employee (no tokens, no IPs). */
export async function securitySummaries(db: Queryable, employeeIds: string[]): Promise<Map<string, SecuritySummary>> {
  const out = new Map<string, SecuritySummary>();
  for (const id of employeeIds) {
    out.set(id, { twoFactorEnrolled: false, sessions: { activeCount: 0, activeSince: null, lastSignOutAt: null } });
  }
  if (employeeIds.length === 0) return out;
  const { rows } = await db.query<{
    employee_id: string;
    enrolled: boolean;
    active_count: string;
    active_since: Date | null;
    last_sign_out: Date | null;
  }>(
    `SELECT e.id AS employee_id,
            COALESCE(f.is_enrolled, false) AS enrolled,
            (SELECT COUNT(*) FROM sessions s WHERE s.employee_id = e.id AND s.state = 'active'
               AND s.expires_at > now() AND (s.idle_expires_at IS NULL OR s.idle_expires_at > now()))::text AS active_count,
            (SELECT MIN(s.created_at) FROM sessions s WHERE s.employee_id = e.id AND s.state = 'active'
               AND s.expires_at > now() AND (s.idle_expires_at IS NULL OR s.idle_expires_at > now())) AS active_since,
            (SELECT MAX(s.ended_at) FROM sessions s WHERE s.employee_id = e.id AND s.end_reason = 'logout') AS last_sign_out
     FROM employees e
     LEFT JOIN two_factor_factors f ON f.employee_id = e.id AND f.factor_type = 'totp'
     WHERE e.id = ANY($1::uuid[])`,
    [employeeIds]
  );
  for (const r of rows) {
    out.set(r.employee_id, {
      twoFactorEnrolled: r.enrolled,
      sessions: {
        activeCount: Number(r.active_count),
        activeSince: r.active_since ? new Date(r.active_since).toISOString() : null,
        lastSignOutAt: r.last_sign_out ? new Date(r.last_sign_out).toISOString() : null,
      },
    });
  }
  return out;
}

/**
 * E-02 consumer: account.deactivated / account.role_changed → revoke all sessions (AR-04).
 * Idempotent: a repeat finds no live session and writes nothing. The employees route also revokes
 * inline right after commit, so access ends at once; this consumer is the guaranteed retry path.
 */
export const revokeSessionsConsumer: OutboxConsumer = {
  name: 'identity.revoke_sessions',
  events: ['account.deactivated', 'account.role_changed'],
  async handle(ctx: CommandContext, event: DeliveredEvent) {
    await revokeAllSessions(ctx.tx, event.aggregateId, event.name === 'account.deactivated' ? 'account_deactivated' : 'revoked', {
      cause: event.name === 'account.deactivated' ? 'account_deactivated' : 'role_changed',
      sourceWorkflow: 'E-02',
    });
  },
};
