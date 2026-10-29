/**
 * MOD-work — repository (raw parameterised SQL). Owner: BE1.
 * Owned tables: targets, work_items.
 */
import type { Queryable } from '../../db/pool.js';
import type { CreateTargetInput, CreateWorkItemInput, TargetDto, UpdateTargetInput, UpdateWorkItemInput, WorkItemDto } from './schemas.js';

interface TargetDbRow {
  id: string;
  employee_id: string;
  employee_name?: string;
  metric: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  target_value: string;
  current_value: string;
  start_date: string;
  end_date: string;
  territory: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface WorkItemDbRow {
  id: string;
  assignee_id: string;
  assignee_name?: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  due_date: Date | null;
  source_type: string | null;
  source_id: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * YYYY-MM-DD of a DATE column. node-pg parses DATE as local midnight, so the local calendar fields
 * are the stored date (toISOString() would shift it a day on a server east of UTC).
 */
function dateKey(v: string | Date): string {
  if (typeof v === 'string') return v.slice(0, 10);
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapTarget(r: TargetDbRow): TargetDto {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    metric: r.metric,
    period: r.period,
    targetValue: Number(r.target_value),
    // D7: filled by the service from the actor columns (the stored column is no longer written).
    currentValue: null,
    startDate: dateKey(r.start_date),
    endDate: dateKey(r.end_date),
    territory: r.territory,
    version: r.version,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function mapWorkItem(r: WorkItemDbRow): WorkItemDto {
  return {
    id: r.id,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    title: r.title,
    description: r.description,
    status: r.status,
    dueDate: r.due_date ? r.due_date.toISOString() : null,
    sourceType: r.source_type,
    sourceId: r.source_id,
    version: r.version,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function insertTarget(db: Queryable, input: CreateTargetInput & { endDate: string }): Promise<TargetDto> {
  const { rows } = await db.query<TargetDbRow>(
    `INSERT INTO targets
       (employee_id, metric, period, target_value, current_value, start_date, end_date, territory)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.employeeId,
      input.metric,
      input.period,
      input.targetValue,
      0, // D7: legacy column kept (additive-only schema); progress is computed, never stored.
      input.startDate,
      input.endDate,
      input.territory ?? null,
    ]
  );
  return mapTarget(rows[0]);
}

export async function getTargetById(db: Queryable, id: string): Promise<TargetDto | null> {
  const { rows } = await db.query<TargetDbRow>(
    `SELECT t.*, e.full_name AS employee_name
       FROM targets t
       LEFT JOIN employees e ON e.id = t.employee_id
      WHERE t.id = $1`,
    [id]
  );
  return rows[0] ? mapTarget(rows[0]) : null;
}

export async function updateTarget(
  db: Queryable,
  id: string,
  input: UpdateTargetInput
): Promise<{ target: TargetDto | null; conflict: boolean; currentVersion?: number }> {
  const current = await getTargetById(db, id);
  if (!current) return { target: null, conflict: false };
  if (current.version !== input.version) {
    return { target: null, conflict: true, currentVersion: current.version };
  }

  const { rows } = await db.query<TargetDbRow>(
    `UPDATE targets
        SET target_value = COALESCE($3, target_value),
            territory = COALESCE($4, territory),
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND version = $2
      RETURNING *`,
    [
      id,
      input.version,
      input.targetValue ?? null,
      input.territory ?? null,
    ]
  );

  if (rows.length === 0) {
    const fresh = await getTargetById(db, id);
    return { target: null, conflict: true, currentVersion: fresh?.version };
  }
  return { target: mapTarget(rows[0]), conflict: false };
}

export async function listTargets(
  db: Queryable,
  options: { employeeId?: string; limit?: number; offset?: number } = {}
): Promise<{ items: TargetDto[]; total: number }> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.employeeId) {
    params.push(options.employeeId);
    conditions.push(`t.employee_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM targets t ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  params.push(limit, offset);

  const { rows } = await db.query<TargetDbRow>(
    `SELECT t.*, e.full_name AS employee_name
       FROM targets t
       LEFT JOIN employees e ON e.id = t.employee_id
      ${whereClause}
      ORDER BY t.start_date DESC, t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { items: rows.map(mapTarget), total };
}

/** Targets whose period contains `date` (YYYY-MM-DD, company timezone); dashboard summary. */
export async function listActiveTargets(db: Queryable, date: string, limit = 20): Promise<TargetDto[]> {
  const { rows } = await db.query<TargetDbRow>(
    `SELECT t.*, e.full_name AS employee_name
       FROM targets t
       LEFT JOIN employees e ON e.id = t.employee_id
      WHERE t.start_date <= $1::date AND t.end_date >= $1::date
      ORDER BY t.end_date, t.created_at
      LIMIT $2`,
    [date, limit]
  );
  return rows.map(mapTarget);
}

export async function insertWorkItem(db: Queryable, input: CreateWorkItemInput): Promise<WorkItemDto> {
  const { rows } = await db.query<WorkItemDbRow>(
    `INSERT INTO work_items
       (assignee_id, title, description, due_date, source_type, source_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.assigneeId,
      input.title,
      input.description ?? null,
      input.dueDate ?? null,
      input.sourceType ?? null,
      input.sourceId ?? null,
    ]
  );
  return mapWorkItem(rows[0]);
}

export async function getWorkItemById(db: Queryable, id: string): Promise<WorkItemDto | null> {
  const { rows } = await db.query<WorkItemDbRow>(
    `SELECT w.*, e.full_name AS assignee_name
       FROM work_items w
       LEFT JOIN employees e ON e.id = w.assignee_id
      WHERE w.id = $1`,
    [id]
  );
  return rows[0] ? mapWorkItem(rows[0]) : null;
}

/** Row lock for a work-item command (R2-03): load, authorize, then update in one transaction. */
export async function lockWorkItem(db: Queryable, id: string): Promise<{ id: string; assigneeId: string } | null> {
  const { rows } = await db.query<{ id: string; assignee_id: string }>(
    'SELECT id, assignee_id FROM work_items WHERE id = $1 FOR UPDATE',
    [id]
  );
  return rows[0] ? { id: rows[0].id, assigneeId: rows[0].assignee_id } : null;
}

export async function updateWorkItem(
  db: Queryable,
  id: string,
  input: UpdateWorkItemInput
): Promise<{ workItem: WorkItemDto | null; conflict: boolean; currentVersion?: number }> {
  const current = await getWorkItemById(db, id);
  if (!current) return { workItem: null, conflict: false };
  if (current.version !== input.version) {
    return { workItem: null, conflict: true, currentVersion: current.version };
  }

  const { rows } = await db.query<WorkItemDbRow>(
    `UPDATE work_items
        SET title = COALESCE($3, title),
            description = COALESCE($4, description),
            status = COALESCE($5, status),
            due_date = CASE WHEN $6::boolean THEN $7::timestamptz ELSE due_date END,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND version = $2
      RETURNING *`,
    [
      id,
      input.version,
      input.title ?? null,
      input.description ?? null,
      input.status ?? null,
      input.dueDate !== undefined,
      input.dueDate ?? null,
    ]
  );

  if (rows.length === 0) {
    const fresh = await getWorkItemById(db, id);
    return { workItem: null, conflict: true, currentVersion: fresh?.version };
  }
  return { workItem: mapWorkItem(rows[0]), conflict: false };
}

export async function listWorkItems(
  db: Queryable,
  options: { assigneeId?: string; status?: string; openOnly?: boolean; limit?: number; offset?: number } = {}
): Promise<{ items: WorkItemDto[]; total: number }> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.assigneeId) {
    params.push(options.assigneeId);
    conditions.push(`w.assignee_id = $${params.length}`);
  }
  if (options.status) {
    params.push(options.status);
    conditions.push(`w.status = $${params.length}`);
  }
  if (options.openOnly) conditions.push(`w.status IN ('open', 'in_progress')`);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM work_items w ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  params.push(limit, offset);

  const { rows } = await db.query<WorkItemDbRow>(
    `SELECT w.*, e.full_name AS assignee_name
       FROM work_items w
       LEFT JOIN employees e ON e.id = w.assignee_id
      ${whereClause}
      ORDER BY w.due_date ASC NULLS LAST, w.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { items: rows.map(mapWorkItem), total };
}
