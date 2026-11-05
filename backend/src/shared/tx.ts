/**
 * Unit of work + audit-in-transaction pattern (ADR-008, arch-a §3.2 rule 3; plan.md §4.6).
 * Owner: Tech Lead.
 *
 * One user command = one transaction holding: the change, its audit row(s) and its outbox
 * event(s). External calls (email, HTTP) never run inside it. Post-commit steps (e.g. releasing a
 * reservation) run in a separate transaction after `runCommand` resolves.
 *
 *   router.patch('/:id', authenticate, requireAction('business.edit'), async (req, res, next) => {
 *     try {
 *       const body = UpdateBusinessSchema.parse(req.body);
 *       const result = await runCommand(req, (ctx) => businessService.update(ctx, id, body));
 *       res.json(result);
 *     } catch (e) { next(e); }
 *   });
 *
 *   // inside the service, with ctx.tx:
 *   await audit(ctx, { eventName: 'business.updated', entityType: 'business', entityId: id, before, after });
 *   await outbox.emit(ctx.tx, { name: 'data_correction_request.submitted', aggregateType: ..., aggregateId: ..., payload: { id } });
 */
import type { Request } from 'express';
import type pg from 'pg';
import { withTransaction } from '../db/pool.js';
import { recordAuditEvent, type AuditLogOptions } from '../modules/admin/audit.js';
import type { Role } from '../middleware/auth.js';
import type { SessionState } from '../modules/identity/security.js';

/** Who is acting. `kind: 'system'` is used by jobs and outbox consumers (audit actor = null). */
export type Actor =
  | {
      kind: 'employee';
      employeeId: string;
      role: Role;
      sessionId: string;
      sessionState: SessionState;
    }
  | { kind: 'system'; job: string };

export interface CommandContext {
  tx: pg.PoolClient;
  actor: Actor;
  requestId: string | null;
  clientIp: string | null;
  /** One clock reading per command, so every row in the transaction agrees on "now". */
  now: Date;
}

export function actorFromRequest(req: Request): Actor {
  const u = req.user;
  if (!u) throw new Error('actorFromRequest called on an unauthenticated request');
  return { kind: 'employee', employeeId: u.id, role: u.role, sessionId: u.sessionId, sessionState: u.sessionState };
}

/** Run one user command in one transaction. Commits on resolve, rolls back on throw. */
export function runCommand<T>(req: Request, fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  const actor = actorFromRequest(req);
  return withTransaction((tx) =>
    fn({ tx, actor, requestId: req.requestId ?? null, clientIp: req.ip ?? null, now: new Date() })
  );
}

/** Run a system command (job, outbox consumer) in one transaction. */
export function runSystemCommand<T>(job: string, fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  return withTransaction((tx) =>
    fn({ tx, actor: { kind: 'system', job }, requestId: null, clientIp: null, now: new Date() })
  );
}

/**
 * Append an audit row inside the command's transaction, filling actor/session/request from ctx.
 * Never put secrets in payload/before/after. Client IP is recorded for security events only (arch-a §5).
 */
export async function audit(
  ctx: CommandContext,
  event: Omit<AuditLogOptions, 'actorId' | 'actorRole' | 'sessionId' | 'requestId'> & { securityEvent?: boolean }
): Promise<void> {
  const { securityEvent, ...rest } = event;
  await recordAuditEvent(ctx.tx, {
    ...rest,
    actorId: ctx.actor.kind === 'employee' ? ctx.actor.employeeId : null,
    actorRole: ctx.actor.kind === 'employee' ? ctx.actor.role : null,
    sessionId: ctx.actor.kind === 'employee' ? ctx.actor.sessionId : null,
    requestId: ctx.requestId,
    clientIp: securityEvent ? ctx.clientIp : null,
    sourceWorkflow: rest.sourceWorkflow ?? (ctx.actor.kind === 'system' ? ctx.actor.job : null),
  });
}
