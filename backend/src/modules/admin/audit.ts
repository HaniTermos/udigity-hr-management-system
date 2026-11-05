import type { Queryable } from '../../db/pool.js';

/**
 * Audit event names follow architecture-b SEQ-01/02/03 where a name exists there.
 * Names without a source in the architecture are marked "placeholder" and need approval (G2):
 *   two_factor.enrolled (placeholder), account.activated (placeholder).
 */
export interface AuditLogOptions {
  eventName: string;
  actorId?: string | null;
  actorRole?: string | null;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  clientIp?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  sourceWorkflow?: string | null;
}

/**
 * Write one append-only audit row using the caller's transaction client (ADR-008).
 * Failures are NOT swallowed: they propagate so the surrounding transaction rolls back,
 * which means no change is committed without its audit row.
 * Never pass secrets (passwords, tokens, 2FA secrets, recovery codes) in payload/before/after.
 */
export async function recordAuditEvent(client: Queryable, options: AuditLogOptions): Promise<void> {
  await client.query(
    `
    INSERT INTO audit_events (
      event_name, actor_id, actor_role, entity_type, entity_id, payload, client_ip,
      session_id, request_id, before_state, after_state, reason, source_workflow
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
    `,
    [
      options.eventName,
      options.actorId || null,
      options.actorRole || null,
      options.entityType,
      options.entityId || null,
      JSON.stringify(options.payload || {}),
      options.clientIp || null,
      options.sessionId || null,
      options.requestId || null,
      options.before ? JSON.stringify(options.before) : null,
      options.after ? JSON.stringify(options.after) : null,
      options.reason || null,
      options.sourceWorkflow || null,
    ]
  );
}
