/**
 * MOD-projects — repository (raw parameterised SQL on this module's own tables only). Owner: BE4.
 * Owned tables: projects, project_developer_assignments, project_changes, tasks, project_provisioning_states.
 * Every function takes a Queryable (pool or ctx.tx) as its first argument.
 */
import type { Queryable } from '../../db/pool.js';
import { SqlParams } from '../../shared/sql.js';
import type { ProjectStatus, TaskStatus } from './schemas.js';

export interface ProjectRow {
  id: string;
  code: string;
  deal_id: string;
  business_id: string;
  name: string;
  status: ProjectStatus;
  status_note: string | null;
  start_date: string | null;
  target_date: string | null;
  delivered_at: Date | null;
  completed_at: Date | null;
  cancel_reason: string | null;
  cancelled_at: Date | null;
  cancelled_by_id: string | null;
  provisioned_by: 'auto' | 'manual';
  provisioned_by_id: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/** DATE columns as text so no timezone shift happens in the driver. */
const PROJECT_COLUMNS = `p.id, p.code, p.deal_id, p.business_id, p.name, p.status, p.status_note,
  p.start_date::text AS start_date, p.target_date::text AS target_date, p.delivered_at, p.completed_at,
  p.cancel_reason, p.cancelled_at, p.cancelled_by_id,
  p.provisioned_by, p.provisioned_by_id, p.version, p.created_at, p.updated_at`;

export async function findById(db: Queryable, id: string, forUpdate = false): Promise<ProjectRow | null> {
  const { rows } = await db.query<ProjectRow>(`SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function findByDeal(db: Queryable, dealId: string): Promise<ProjectRow | null> {
  const { rows } = await db.query<ProjectRow>(`SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.deal_id = $1`, [dealId]);
  return rows[0] ?? null;
}

export async function findByDeals(db: Queryable, dealIds: string[]): Promise<ProjectRow[]> {
  if (dealIds.length === 0) return [];
  const { rows } = await db.query<ProjectRow>(`SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.deal_id = ANY($1::uuid[])`, [dealIds]);
  return rows;
}

/** Idempotent per deal (unique deal_id): returns null when the project already exists. */
export async function insertProject(
  db: Queryable,
  v: { dealId: string; businessId: string; name: string; startDate: string | null; targetDate: string | null; provisionedBy: 'auto' | 'manual'; provisionedById: string | null; now: Date }
): Promise<ProjectRow | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO projects (deal_id, business_id, name, start_date, target_date, provisioned_by, provisioned_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT (deal_id) DO NOTHING RETURNING id`,
    [v.dealId, v.businessId, v.name, v.startDate, v.targetDate, v.provisionedBy, v.provisionedById, v.now]
  );
  return rows[0] ? findById(db, rows[0].id) : null;
}

export type ProjectColumn =
  | 'name'
  | 'status'
  | 'status_note'
  | 'start_date'
  | 'target_date'
  | 'delivered_at'
  | 'completed_at'
  | 'cancel_reason'
  | 'cancelled_at'
  | 'cancelled_by_id';
const PROJECT_SETTABLE: ReadonlySet<ProjectColumn> = new Set<ProjectColumn>([
  'name',
  'status',
  'status_note',
  'start_date',
  'target_date',
  'delivered_at',
  'completed_at',
  'cancel_reason',
  'cancelled_at',
  'cancelled_by_id',
]);

export async function updateProject(
  db: Queryable,
  id: string,
  expectedVersion: number,
  set: Partial<Record<ProjectColumn, unknown>>,
  now: Date
): Promise<ProjectRow | null> {
  const p = new SqlParams();
  const parts: string[] = [];
  for (const [col, value] of Object.entries(set) as [ProjectColumn, unknown][]) {
    if (!PROJECT_SETTABLE.has(col)) throw new Error(`projects.updateProject: column not settable: ${col}`);
    parts.push(`${col} = ${p.add(value)}`);
  }
  const nowPh = p.add(now);
  const idPh = p.add(id);
  const vPh = p.add(expectedVersion);
  const { rows } = await db.query<{ id: string }>(
    `UPDATE projects SET ${parts.join(', ')}${parts.length ? ', ' : ''}version = version + 1, updated_at = ${nowPh}
      WHERE id = ${idPh} AND version = ${vPh} RETURNING id`,
    p.values
  );
  return rows[0] ? findById(db, rows[0].id) : null;
}

// ----- developers -----
export async function currentDevelopers(db: Queryable, projectIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (projectIds.length === 0) return out;
  const { rows } = await db.query<{ project_id: string; developer_id: string }>(
    `SELECT project_id, developer_id FROM project_developer_assignments
      WHERE project_id = ANY($1::uuid[]) AND unassigned_at IS NULL ORDER BY assigned_at, developer_id`,
    [projectIds]
  );
  for (const r of rows) out.set(r.project_id, [...(out.get(r.project_id) ?? []), r.developer_id]);
  return out;
}

export async function assignDeveloper(db: Queryable, projectId: string, developerId: string, byId: string, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO project_developer_assignments (project_id, developer_id, assigned_by_id, assigned_at) VALUES ($1, $2, $3, $4)`,
    [projectId, developerId, byId, now]
  );
}

export async function unassignDeveloper(db: Queryable, projectId: string, developerId: string, now: Date): Promise<void> {
  await db.query(
    `UPDATE project_developer_assignments SET unassigned_at = $3 WHERE project_id = $1 AND developer_id = $2 AND unassigned_at IS NULL`,
    [projectId, developerId, now]
  );
}

// ----- history -----
export type ProjectChangeType = 'provisioned' | 'status_changed' | 'schedule_changed' | 'developer_assigned' | 'developer_unassigned';

export async function insertChange(
  db: Queryable,
  v: { projectId: string; type: ProjectChangeType; before?: unknown; after?: unknown; note?: string | null; openTaskCount?: number | null; actorId: string | null; now: Date }
): Promise<void> {
  await db.query(
    `INSERT INTO project_changes (project_id, change_type, before_value, after_value, note, open_task_count, actor_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      v.projectId,
      v.type,
      v.before === undefined ? null : JSON.stringify(v.before),
      v.after === undefined ? null : JSON.stringify(v.after),
      v.note ?? null,
      v.openTaskCount ?? null,
      v.actorId,
      v.now,
    ]
  );
}

export async function listChanges(db: Queryable, projectId: string) {
  const { rows } = await db.query<{
    id: string;
    change_type: ProjectChangeType;
    before_value: unknown;
    after_value: unknown;
    note: string | null;
    open_task_count: number | null;
    actor_id: string | null;
    created_at: Date;
  }>(
    `SELECT id, change_type, before_value, after_value, note, open_task_count, actor_id, created_at
       FROM project_changes WHERE project_id = $1 ORDER BY created_at, id`,
    [projectId]
  );
  return rows;
}

// ----- lists -----
export interface ProjectListRow extends ProjectRow {
  total: string;
}

/** List with a caller-built WHERE (filters + access scopeFilter on alias `p`). */
export async function listProjects(db: Queryable, where: string[], params: SqlParams, orderBy: string, page: string): Promise<{ rows: ProjectListRow[]; total: number }> {
  const { rows } = await db.query<ProjectListRow>(
    `SELECT ${PROJECT_COLUMNS}, COUNT(*) OVER()::text AS total
       FROM projects p
      WHERE ${where.length ? where.join(' AND ') : 'TRUE'}
      ${orderBy} ${page}`,
    params.values
  );
  return { rows, total: rows[0] ? Number(rows[0].total) : 0 };
}

/** Workload counters over the same WHERE as the list (scope already applied). */
export async function workload(db: Queryable, where: string[], params: SqlParams, monthStart: string, today: string) {
  const p2 = new SqlParams();
  p2.values.push(...params.values);
  const ms = p2.add(monthStart);
  const td = p2.add(today);
  const { rows } = await db.query<{ active: string; overdue: string; open_tasks: string; completed_month: string }>(
    `SELECT
        COUNT(*) FILTER (WHERE p.status NOT IN ('delivered','completed','cancelled'))::text AS active,
        COUNT(*) FILTER (WHERE p.status NOT IN ('delivered','completed','cancelled') AND p.target_date < ${td}::date)::text AS overdue,
        COALESCE(SUM(ot.n) FILTER (WHERE p.status <> 'cancelled'), 0)::text AS open_tasks,
        COUNT(*) FILTER (WHERE p.status = 'completed' AND p.completed_at >= ${ms}::date)::text AS completed_month
       FROM projects p
       LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM tasks t WHERE t.project_id = p.id AND t.status IN ('todo','in_progress')) ot ON TRUE
      WHERE ${where.length ? where.join(' AND ') : 'TRUE'}`,
    p2.values
  );
  const r = rows[0];
  return {
    activeProjects: Number(r?.active ?? 0),
    deliveryOverdue: Number(r?.overdue ?? 0),
    openTasks: Number(r?.open_tasks ?? 0),
    completedThisMonth: Number(r?.completed_month ?? 0),
  };
}

// ----- tasks -----
export interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  owner_id: string | null;
  due_date: string | null;
  start_date: string | null;
  is_milestone: boolean;
  client_dependency: boolean;
  client_dependency_note: string | null;
  sort_order: number;
  completed_at: Date | null;
  completed_by_id: string | null;
  cancel_reason: string | null;
  created_by_id: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const TASK_COLUMNS = `t.id, t.project_id, t.title, t.description, t.status, t.owner_id, t.due_date::text AS due_date, t.start_date::text AS start_date,
  t.is_milestone, t.client_dependency, t.client_dependency_note, t.sort_order, t.completed_at, t.completed_by_id,
  t.cancel_reason, t.created_by_id, t.version, t.created_at, t.updated_at`;

export async function findTask(db: Queryable, id: string, forUpdate = false): Promise<TaskRow | null> {
  const { rows } = await db.query<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks t WHERE t.id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function tasksForProject(db: Queryable, projectId: string, status?: TaskStatus): Promise<TaskRow[]> {
  const { rows } = await db.query<TaskRow>(
    `SELECT ${TASK_COLUMNS} FROM tasks t WHERE t.project_id = $1 AND ($2::text IS NULL OR t.status = $2)
      ORDER BY t.status, t.sort_order, t.created_at, t.id`,
    [projectId, status ?? null]
  );
  return rows;
}

export async function taskCounts(db: Queryable, projectIds: string[]): Promise<Map<string, { total: number; open: number; done: number; cancelled: number }>> {
  const out = new Map<string, { total: number; open: number; done: number; cancelled: number }>();
  if (projectIds.length === 0) return out;
  const { rows } = await db.query<{ project_id: string; total: string; open: string; done: string; cancelled: string }>(
    `SELECT project_id, COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status IN ('todo','in_progress'))::text AS open,
            COUNT(*) FILTER (WHERE status = 'done')::text AS done,
            COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled
       FROM tasks WHERE project_id = ANY($1::uuid[]) GROUP BY project_id`,
    [projectIds]
  );
  for (const r of rows) out.set(r.project_id, { total: Number(r.total), open: Number(r.open), done: Number(r.done), cancelled: Number(r.cancelled) });
  return out;
}

export async function openTasks(db: Queryable, projectId: string): Promise<TaskRow[]> {
  const { rows } = await db.query<TaskRow>(
    `SELECT ${TASK_COLUMNS} FROM tasks t WHERE t.project_id = $1 AND t.status IN ('todo','in_progress') ORDER BY t.sort_order, t.created_at, t.id`,
    [projectId]
  );
  return rows;
}

export async function insertTask(
  db: Queryable,
  v: {
    projectId: string;
    title: string;
    description: string | null;
    ownerId: string | null;
    dueDate: string | null;
    startDate: string | null;
    isMilestone: boolean;
    clientDependency: boolean;
    clientDependencyNote: string | null;
    createdById: string;
    now: Date;
  }
): Promise<TaskRow> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tasks (project_id, title, description, owner_id, due_date, is_milestone, client_dependency, client_dependency_note,
                        sort_order, created_by_id, created_at, updated_at, start_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $1 AND status = 'todo'), 0), $9, $10, $10, $11)
     RETURNING id`,
    [v.projectId, v.title, v.description, v.ownerId, v.dueDate, v.isMilestone, v.clientDependency, v.clientDependencyNote, v.createdById, v.now, v.startDate]
  );
  return (await findTask(db, rows[0].id))!;
}

export type TaskColumn =
  | 'title'
  | 'description'
  | 'status'
  | 'owner_id'
  | 'due_date'
  | 'start_date'
  | 'is_milestone'
  | 'client_dependency'
  | 'client_dependency_note'
  | 'sort_order'
  | 'completed_at'
  | 'completed_by_id'
  | 'cancel_reason';
const TASK_SETTABLE: ReadonlySet<TaskColumn> = new Set<TaskColumn>([
  'title',
  'description',
  'status',
  'owner_id',
  'due_date',
  'start_date',
  'is_milestone',
  'client_dependency',
  'client_dependency_note',
  'sort_order',
  'completed_at',
  'completed_by_id',
  'cancel_reason',
]);

export async function updateTask(db: Queryable, id: string, expectedVersion: number, set: Partial<Record<TaskColumn, unknown>>, now: Date): Promise<TaskRow | null> {
  const p = new SqlParams();
  const parts: string[] = [];
  for (const [col, value] of Object.entries(set) as [TaskColumn, unknown][]) {
    if (!TASK_SETTABLE.has(col)) throw new Error(`projects.updateTask: column not settable: ${col}`);
    parts.push(`${col} = ${p.add(value)}`);
  }
  const nowPh = p.add(now);
  const idPh = p.add(id);
  const vPh = p.add(expectedVersion);
  const { rows } = await db.query<{ id: string }>(
    `UPDATE tasks SET ${parts.join(', ')}${parts.length ? ', ' : ''}version = version + 1, updated_at = ${nowPh}
      WHERE id = ${idPh} AND version = ${vPh} RETURNING id`,
    p.values
  );
  return rows[0] ? findTask(db, rows[0].id) : null;
}

// ----- provisioning bookkeeping (F3 / J-07) -----
export interface ProvisioningStateRow {
  deal_id: string;
  attempts: number;
  last_error_code: string | null;
  last_attempt_at: Date | null;
  next_attempt_at: Date | null;
  resolved_at: Date | null;
}

export async function provisioningStates(db: Queryable, dealIds: string[]): Promise<Map<string, ProvisioningStateRow>> {
  if (dealIds.length === 0) return new Map();
  const { rows } = await db.query<ProvisioningStateRow>(
    `SELECT deal_id, attempts, last_error_code, last_attempt_at, next_attempt_at, resolved_at
       FROM project_provisioning_states WHERE deal_id = ANY($1::uuid[])`,
    [dealIds]
  );
  return new Map(rows.map((r) => [r.deal_id, r]));
}

export async function recordProvisioningFailure(db: Queryable, dealId: string, errorCode: string, nextAttemptAt: Date | null, now: Date): Promise<number> {
  const { rows } = await db.query<{ attempts: number }>(
    `INSERT INTO project_provisioning_states (deal_id, attempts, last_error_code, last_attempt_at, next_attempt_at, created_at, updated_at)
     VALUES ($1, 1, $2, $4, $3, $4, $4)
     ON CONFLICT (deal_id) DO UPDATE SET attempts = project_provisioning_states.attempts + 1, last_error_code = EXCLUDED.last_error_code,
       last_attempt_at = EXCLUDED.last_attempt_at, next_attempt_at = EXCLUDED.next_attempt_at, resolved_at = NULL, updated_at = EXCLUDED.updated_at
     RETURNING attempts`,
    [dealId, errorCode.slice(0, 60), nextAttemptAt, now]
  );
  return rows[0].attempts;
}

export async function resolveProvisioning(db: Queryable, dealId: string, now: Date): Promise<void> {
  await db.query(
    `UPDATE project_provisioning_states SET resolved_at = $2, next_attempt_at = NULL, updated_at = $2 WHERE deal_id = $1 AND resolved_at IS NULL`,
    [dealId, now]
  );
}

export async function resetNextAttempt(db: Queryable, dealId: string, now: Date): Promise<void> {
  await db.query(`UPDATE project_provisioning_states SET next_attempt_at = $2, updated_at = $2 WHERE deal_id = $1 AND resolved_at IS NULL`, [dealId, now]);
}
