/**
 * MOD-admin — repository (raw parameterised SQL on this module's own tables only). Owner: BE1.
 * Owned tables: audit_events (INSERT/SELECT only), company_settings.
 */
import type { Queryable } from '../../db/pool.js';
import { SqlParams } from '../../shared/sql.js';
import { orderByClause, pageClause } from '../../shared/pagination.js';
import { PLACEHOLDER_AUDIT_NAMES, type AuditEventDto, type AuditQuery } from './schemas.js';

export interface CompanySettingsRow {
  values: Record<string, unknown>;
  version: number;
  updated_by: string | null;
  updated_at: Date;
}

export async function readCompanySettings(db: Queryable, forUpdate = false): Promise<CompanySettingsRow> {
  const { rows } = await db.query<CompanySettingsRow>(
    `SELECT "values", version, updated_by, updated_at FROM company_settings WHERE id = 1 ${forUpdate ? 'FOR UPDATE' : ''}`
  );
  // Migration 011 inserts the row; an empty object if somehow missing.
  return rows[0] ?? { values: {}, version: 1, updated_by: null, updated_at: new Date(0) };
}

export async function writeCompanySettings(
  db: Queryable,
  values: Record<string, unknown>,
  expectedVersion: number,
  updatedBy: string
): Promise<CompanySettingsRow | null> {
  const { rows } = await db.query<CompanySettingsRow>(
    `INSERT INTO company_settings (id, "values", version, updated_by) VALUES (1, $1, 2, $3)
     ON CONFLICT (id) DO UPDATE SET "values" = EXCLUDED."values", version = company_settings.version + 1,
       updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
     WHERE company_settings.version = $2
     RETURNING "values", version, updated_by, updated_at`,
    [JSON.stringify(values), expectedVersion, updatedBy]
  );
  return rows[0] ?? null;
}

const AUDIT_SORT = { createdAt: 'a.created_at', eventName: 'a.event_name' };

export async function listAuditEvents(db: Queryable, q: AuditQuery): Promise<{ items: AuditEventDto[]; total: number }> {
  const p = new SqlParams();
  const where: string[] = ['TRUE'];
  if (q.event) {
    // `session.*` style prefix match; otherwise exact.
    if (q.event.endsWith('.*')) where.push(`a.event_name LIKE ${p.add(q.event.slice(0, -1).replace(/[%_\\]/g, '\\$&') + '%')}`);
    else where.push(`a.event_name = ${p.add(q.event)}`);
  }
  if (q.actorId) where.push(`a.actor_id = ${p.add(q.actorId)}`);
  if (q.entityType) where.push(`a.entity_type = ${p.add(q.entityType)}`);
  const entityId = q.entityId ?? q.entityRef;
  if (entityId) where.push(`a.entity_id = ${p.add(entityId)}`);
  if (q.from) where.push(`a.created_at >= ${p.add(q.from.length === 10 ? `${q.from}T00:00:00Z` : q.from)}`);
  if (q.to) {
    const to = q.to.length === 10 ? new Date(Date.parse(`${q.to}T00:00:00Z`) + 86_400_000).toISOString() : q.to;
    where.push(`a.created_at < ${p.add(to)}`);
  }
  const whereSql = where.join(' AND ');

  const { rows: countRows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM audit_events a WHERE ${whereSql}`,
    p.values
  );
  const order = orderByClause(q, AUDIT_SORT, 'createdAt');
  const { rows } = await db.query<{
    id: string;
    event_name: string;
    actor_id: string | null;
    actor_name: string | null;
    actor_role: string | null;
    entity_type: string;
    entity_id: string | null;
    session_id: string | null;
    request_id: string | null;
    client_ip: string | null;
    payload: unknown;
    before_state: unknown;
    after_state: unknown;
    reason: string | null;
    source_workflow: string | null;
    created_at: Date;
  }>(
    `SELECT a.id, a.event_name, a.actor_id, e.full_name AS actor_name, a.actor_role, a.entity_type, a.entity_id,
            a.session_id, a.request_id, a.client_ip, a.payload, a.before_state, a.after_state, a.reason,
            a.source_workflow, a.created_at
     FROM audit_events a LEFT JOIN employees e ON e.id = a.actor_id
     WHERE ${whereSql} ${order}, a.id ${pageClause(q, p)}`,
    p.values
  );
  return {
    total: Number(countRows[0]?.n ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      occurredAt: new Date(r.created_at).toISOString(),
      eventName: r.event_name,
      placeholderName: PLACEHOLDER_AUDIT_NAMES.has(r.event_name),
      actorId: r.actor_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      entityType: r.entity_type,
      entityId: r.entity_id,
      sessionId: r.session_id,
      requestId: r.request_id,
      clientIp: r.client_ip,
      payload: r.payload,
      before: r.before_state,
      after: r.after_state,
      reason: r.reason,
      sourceWorkflow: r.source_workflow,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}
