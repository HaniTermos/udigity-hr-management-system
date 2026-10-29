/**
 * MOD-projects — service (SM-PROJECT-001 / SM-TASK-001, E-14 provisioning + J-07 retry, P7 open-task
 * warning). Owner: BE4. Design: docs/implementation/delivery-design.md §4, §5, §7.
 *
 * Every pending policy here is "Demonstration alternative — not approved (docs/policy-defaults.md)":
 * DEC-019 statuses, OQ-06/07/08 developers, OQ-10 open tasks warn, OQ-11 no Cancelled, OQ-15 reopen,
 * F2 `projects.autoProvision`.
 *
 * Closure commits first (F3): MOD-deals only emits `deal.closed` (E-14). The `projects.provision`
 * consumer creates the project in its own transaction; a failure is recorded in
 * `project_provisioning_states`, emits `project.provisioning_failed` (E-15) and enqueues
 * `projects.provision_retry` (J-07) with backoff 1 m, 5 m, 30 m, 2 h, then stops (dead, Owner retries).
 */
import type { Queryable } from '../../db/pool.js';
import { access, type Principal } from '../../shared/access.js';
import { HttpError, notFound, permissionDenied, ruleViolation, stateConflict, versionConflict } from '../../shared/errors.js';
import { outbox, type DeliveredEvent } from '../../shared/outbox.js';
import { orderByClause, pageClause, toPage } from '../../shared/pagination.js';
import { jobs } from '../../shared/platform.js';
import { SqlParams } from '../../shared/sql.js';
import { audit, type CommandContext } from '../../shared/tx.js';
import { config } from '../../config/index.js';
import {
  actorIdOf,
  assertActiveEmployee,
  authorize,
  businessNames,
  deliveryPolicy,
  DEMO_LABEL,
  employeeNames,
  getDealSummaries,
  getDealSummary,
  inSequence,
  iso,
  listClosedDealSummaries,
  principalOf,
  requireOwner,
  type DealProjectInfo,
} from '../deals/service.js';
import * as repo from './repo.js';
import type { ProjectRow, TaskRow } from './repo.js';
import {
  FINAL_PROJECT_STATUSES,
  NOTE_REQUIRED_STATUSES,
  OPEN_TASK_STATUSES,
  OPEN_TASK_WARNING_TARGETS,
  PROJECT_TRANSITIONS,
  TASK_TRANSITIONS,
  type OpenTasksWarningDetails,
  type ProjectDetailDto,
  type ProjectDto,
  type ProjectListResponse,
  type ProjectStatus,
  type TaskDto,
  type TaskStatus,
  type UnprovisionedDealDto,
} from './schemas.js';

/** J-07 backoff (delivery-design §4): after the 4th scheduled retry fails, no more jobs ("dead"). */
export const PROVISION_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000] as const;

// ---------------------------------------------------------------------------
// Resolvers and the deal-side "project info" provider
// ---------------------------------------------------------------------------
export async function resolveProjectBusiness(db: Queryable, id: string): Promise<string | null> {
  const p = await repo.findById(db, id);
  return p ? p.business_id : null;
}

export async function resolveTaskBusiness(db: Queryable, id: string): Promise<string | null> {
  const t = await repo.findTask(db, id);
  if (!t) return null;
  return resolveProjectBusiness(db, t.project_id);
}

/** Registered with MOD-deals at init: `projectProvisioning` + project id/status on deal DTOs. */
export async function projectInfoForDeals(db: Queryable, dealIds: string[]): Promise<Map<string, DealProjectInfo>> {
  const out = new Map<string, DealProjectInfo>();
  const [projects, states] = await inSequence([() => repo.findByDeals(db, dealIds), () => repo.provisioningStates(db, dealIds)]);
  for (const p of projects) out.set(p.deal_id, { projectId: p.id, projectStatus: p.status, provisioning: 'provisioned' });
  for (const id of dealIds) {
    if (out.has(id)) continue;
    const s = states.get(id);
    out.set(id, { projectId: null, projectStatus: null, provisioning: s && !s.resolved_at && s.attempts > 0 ? 'failed' : 'pending' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const today = () => new Date().toISOString().slice(0, 10);

/** Completed or Cancelled: read-only (D17). */
const isFinal = (s: ProjectStatus) => FINAL_PROJECT_STATUSES.includes(s);
const READ_ONLY = 'A completed or cancelled project is read-only';

async function developersOf(db: Queryable, projectId: string): Promise<string[]> {
  return (await repo.currentDevelopers(db, [projectId])).get(projectId) ?? [];
}

/** OQ-06: Owner, or a Developer currently assigned to the project. */
function mayWork(p: Principal, developerIds: string[]): boolean {
  return p.role === 'owner' || (p.role === 'developer' && developerIds.includes(p.employeeId));
}

function assertVersion(row: { version: number }, version: number, current?: unknown): void {
  if (row.version !== version) throw versionConflict(row.version, current);
}

/** BL-09: stale project version → 409 with `details.current` = the project detail for this caller. */
async function assertProjectVersion(ctx: CommandContext, p: ProjectRow, version: number): Promise<void> {
  if (p.version !== version) assertVersion(p, version, await detailFor(ctx, p));
}

async function saveProject(ctx: CommandContext, p: ProjectRow, set: Partial<Record<repo.ProjectColumn, unknown>>): Promise<ProjectRow> {
  const next = await repo.updateProject(ctx.tx, p.id, p.version, set, ctx.now);
  if (!next) {
    const cur = await repo.findById(ctx.tx, p.id);
    if (!cur) throw notFound();
    throw versionConflict(cur.version, await detailFor(ctx, cur));
  }
  return next;
}

async function lockProject(ctx: CommandContext, id: string, action: string): Promise<{ project: ProjectRow; developerIds: string[] }> {
  const project = await repo.findById(ctx.tx, id, true);
  if (!project) throw notFound();
  await authorize(ctx, action, { type: 'project', id });
  const developerIds = await developersOf(ctx.tx, id);
  if (!mayWork(principalOf(ctx), developerIds)) throw permissionDenied();
  return { project, developerIds };
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------
function taskDto(t: TaskRow, names: Map<string, string>, editable: boolean): TaskDto {
  return {
    id: t.id,
    projectId: t.project_id,
    version: t.version,
    title: t.title,
    description: t.description,
    status: t.status,
    ownerId: t.owner_id,
    ownerName: t.owner_id ? names.get(t.owner_id) ?? null : null,
    dueDate: t.due_date,
    startDate: t.start_date,
    isMilestone: t.is_milestone,
    clientDependency: t.client_dependency,
    clientDependencyNote: t.client_dependency_note,
    sortOrder: t.sort_order,
    completedAt: iso(t.completed_at),
    cancelReason: t.cancel_reason,
    allowedNextStatuses: editable ? [...TASK_TRANSITIONS[t.status]] : [],
    createdAt: iso(t.created_at)!,
    updatedAt: iso(t.updated_at)!,
  };
}

async function toProjectDtos(db: Queryable, viewer: Principal, rows: ProjectRow[]): Promise<ProjectDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [devs, counts, deals, biz] = await inSequence([
    () => repo.currentDevelopers(db, ids),
    () => repo.taskCounts(db, ids),
    () => getDealSummaries(db, rows.map((r) => r.deal_id)),
    () => businessNames(db, rows.map((r) => r.business_id)),
  ]);
  const names = await employeeNames(db, [...devs.values()].flat());
  const now = today();
  return rows.map((r) => {
    const developerIds = devs.get(r.id) ?? [];
    const work = mayWork(viewer, developerIds);
    const owner = viewer.role === 'owner';
    const completed = r.status === 'completed';
    const final = isFinal(r.status);
    return {
      id: r.id,
      code: r.code,
      version: r.version,
      dealId: r.deal_id,
      dealCode: deals.get(r.deal_id)?.code ?? null,
      businessId: r.business_id,
      businessName: biz.get(r.business_id) ?? null,
      name: r.name,
      status: r.status,
      statusNote: r.status_note,
      startDate: r.start_date,
      targetDate: r.target_date,
      deliveredAt: iso(r.delivered_at),
      completedAt: iso(r.completed_at),
      cancelReason: r.cancel_reason,
      cancelledAt: iso(r.cancelled_at),
      provisionedBy: r.provisioned_by,
      developers: developerIds.map((id) => ({ id, fullName: names.get(id) ?? '' })),
      assignedToMe: developerIds.includes(viewer.employeeId),
      deliveryOverdue: Boolean(r.target_date && r.target_date < now && r.status !== 'delivered' && !final),
      readOnly: final,
      taskCounts: counts.get(r.id) ?? { total: 0, open: 0, done: 0, cancelled: 0 },
      allowedNextStatuses: work && !final ? [...PROJECT_TRANSITIONS[r.status]] : [],
      allowed: {
        changeStatus: work && !final,
        editSchedule: work && !final,
        assignDevelopers: owner && !final,
        reopen: owner && completed,
        cancel: owner && !final,
        createTask: work && !final,
      },
      createdAt: iso(r.created_at)!,
      updatedAt: iso(r.updated_at)!,
    };
  });
}

async function toDetail(db: Queryable, viewer: Principal, r: ProjectRow): Promise<ProjectDetailDto> {
  const [dto] = await toProjectDtos(db, viewer, [r]);
  const [tasks, changes] = await inSequence([() => repo.tasksForProject(db, r.id), () => repo.listChanges(db, r.id)]);
  const names = await employeeNames(db, tasks.map((t) => t.owner_id));
  return {
    ...dto,
    tasks: tasks.map((t) => taskDto(t, names, dto.allowed.createTask)),
    history: changes.map((c) => ({
      id: c.id,
      type: c.change_type,
      before: c.before_value,
      after: c.after_value,
      note: c.note,
      openTaskCount: c.open_task_count,
      actorId: c.actor_id,
      at: iso(c.created_at)!,
    })),
  };
}

async function detailFor(ctx: CommandContext, r: ProjectRow): Promise<ProjectDetailDto> {
  return toDetail(ctx.tx, principalOf(ctx), r);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export interface ProjectListQuery {
  page: number;
  pageSize: number;
  sort?: string;
  order: 'asc' | 'desc';
  status?: ProjectStatus;
  developerId?: string;
  scope?: 'assigned_to_me' | 'all';
  overdueOnly?: boolean;
  dealId?: string;
}

const PROJECT_SORT: Record<string, string> = {
  createdAt: 'p.created_at',
  updatedAt: 'p.updated_at',
  targetDate: 'p.target_date',
  code: 'p.code',
  name: 'p.name',
  status: 'p.status',
};

const assignedTo = (params: SqlParams, employeeId: string) =>
  `EXISTS (SELECT 1 FROM project_developer_assignments pda WHERE pda.project_id = p.id AND pda.unassigned_at IS NULL AND pda.developer_id = ${params.add(employeeId)}::uuid)`;

/** GET /api/projects — scopeFilter + Developer confinement (assigned only, matrix rows 3–4) before COUNT/LIMIT. */
export async function listProjects(db: Queryable, viewer: Principal, q: ProjectListQuery): Promise<ProjectListResponse> {
  const params = new SqlParams();
  const where: string[] = [];
  if (q.status) where.push(`p.status = ${params.add(q.status)}`);
  if (q.dealId) where.push(`p.deal_id = ${params.add(q.dealId)}::uuid`);
  if (q.developerId) where.push(assignedTo(params, q.developerId));
  if (q.scope === 'assigned_to_me') where.push(assignedTo(params, viewer.employeeId));
  if (q.overdueOnly) where.push(`p.status NOT IN ('delivered','completed','cancelled') AND p.target_date < ${params.add(today())}::date`);
  if (viewer.role === 'developer') where.push(assignedTo(params, viewer.employeeId));
  where.push(access.scopeFilter(viewer, 'project.read', 'project', { alias: 'p', params }));
  const listParams = new SqlParams();
  listParams.values.push(...params.values);
  const order = orderByClause(q, PROJECT_SORT, 'createdAt');
  const page = pageClause(q, listParams);
  const [{ rows, total }, load] = await inSequence([
    () => repo.listProjects(db, where, listParams, order, page),
    () => repo.workload(db, where, params, `${today().slice(0, 8)}01`, today()),
  ]);
  const items = await toProjectDtos(db, viewer, rows);
  return {
    ...toPage(items, total, q),
    workload: load,
    unprovisioned: await unprovisionedDeals(db, viewer),
    policy: { autoProvision: deliveryPolicy().autoProvision, label: DEMO_LABEL },
  };
}

/** "Closed deal without project" (derived): closed deals the viewer may read, with no project row. */
export async function unprovisionedDeals(db: Queryable, viewer: Principal): Promise<UnprovisionedDealDto[]> {
  const closed = await listClosedDealSummaries(db, viewer, 200);
  if (closed.length === 0) return [];
  const ids = closed.map((d) => d.id);
  const have = new Set((await repo.findByDeals(db, ids)).map((p) => p.deal_id));
  const missing = closed.filter((d) => !have.has(d.id));
  if (missing.length === 0) return [];
  const [states, biz] = await inSequence([
    () => repo.provisioningStates(db, missing.map((d) => d.id)),
    () => businessNames(db, missing.map((d) => d.businessId)),
  ]);
  return missing.map((d) => {
    const s = states.get(d.id);
    return {
      dealId: d.id,
      dealCode: d.code,
      businessId: d.businessId,
      businessName: biz.get(d.businessId) ?? null,
      closedAt: iso(d.closedAt),
      provisioning: s && !s.resolved_at && s.attempts > 0 ? 'failed' : 'pending',
      attempts: s?.attempts ?? 0,
      lastErrorCode: s?.last_error_code ?? null,
      nextAttemptAt: iso(s?.next_attempt_at ?? null),
    };
  });
}

/** GET /api/projects/:id after `access.check` passed in the route. Developers: currently assigned only. */
export async function getProjectForReader(db: Queryable, viewer: Principal, id: string): Promise<ProjectDetailDto> {
  const r = await repo.findById(db, id);
  if (!r) throw notFound();
  if (viewer.role === 'developer' && !(await developersOf(db, id)).includes(viewer.employeeId)) throw permissionDenied();
  return toDetail(db, viewer, r);
}

/** GET /api/tasks?projectId= after the project check. */
export async function listTasks(db: Queryable, viewer: Principal, projectId: string, status?: TaskStatus): Promise<{ items: TaskDto[] }> {
  const r = await repo.findById(db, projectId);
  if (!r) throw notFound();
  const developerIds = await developersOf(db, projectId);
  if (viewer.role === 'developer' && !developerIds.includes(viewer.employeeId)) throw permissionDenied();
  const tasks = await repo.tasksForProject(db, projectId, status);
  const names = await employeeNames(db, tasks.map((t) => t.owner_id));
  const editable = mayWork(viewer, developerIds) && !isFinal(r.status);
  return { items: tasks.map((t) => taskDto(t, names, editable)) };
}

export async function getTaskForReader(db: Queryable, viewer: Principal, id: string): Promise<TaskDto> {
  const t = await repo.findTask(db, id);
  if (!t) throw notFound();
  const { items } = await listTasks(db, viewer, t.project_id);
  const found = items.find((x) => x.id === id);
  if (!found) throw notFound();
  return found;
}

/** BE1 open-items op (employee deactivation dialog): current project assignments + open tasks owned. */
export async function openItemsFor(db: Queryable, employeeId: string): Promise<{ projects: number; openTasks: number }> {
  const { rows } = await db.query<{ projects: string; tasks: string }>(
    `SELECT
       (SELECT COUNT(*) FROM project_developer_assignments pda JOIN projects p ON p.id = pda.project_id
         WHERE pda.developer_id = $1 AND pda.unassigned_at IS NULL AND p.status NOT IN ('completed','cancelled'))::text AS projects,
       (SELECT COUNT(*) FROM tasks t WHERE t.owner_id = $1 AND t.status IN ('todo','in_progress'))::text AS tasks`,
    [employeeId]
  );
  return { projects: Number(rows[0].projects), openTasks: Number(rows[0].tasks) };
}

/** Batched `openItemsFor` (BE-LEAD V-02): two grouped queries for a page of employees. */
export async function openItemsForMany(
  db: Queryable,
  employeeIds: string[]
): Promise<Map<string, { projects: number; openTasks: number }>> {
  const out = new Map(employeeIds.map((id) => [id, { projects: 0, openTasks: 0 }]));
  if (employeeIds.length === 0) return out;
  const projects = await db.query<{ id: string; n: string }>(
    `SELECT pda.developer_id AS id, COUNT(*)::text AS n
     FROM project_developer_assignments pda JOIN projects p ON p.id = pda.project_id
     WHERE pda.developer_id = ANY($1::uuid[]) AND pda.unassigned_at IS NULL AND p.status NOT IN ('completed','cancelled')
     GROUP BY pda.developer_id`,
    [employeeIds]
  );
  for (const r of projects.rows) {
    const e = out.get(r.id);
    if (e) e.projects = Number(r.n);
  }
  const tasks = await db.query<{ id: string; n: string }>(
    `SELECT owner_id AS id, COUNT(*)::text AS n FROM tasks
     WHERE owner_id = ANY($1::uuid[]) AND status IN ('todo','in_progress') GROUP BY owner_id`,
    [employeeIds]
  );
  for (const r of tasks.rows) {
    const e = out.get(r.id);
    if (e) e.openTasks = Number(r.n);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Provisioning (E-14 consumer, J-07 retry, manual F2 create, Owner retry)
// ---------------------------------------------------------------------------
let provisioningFault: ((dealId: string) => void) | null = null;

/** Test hook (NODE_ENV=test only): throw inside the provisioning savepoint to exercise E-15/J-07. */
export function setProvisioningFaultForTests(fn: ((dealId: string) => void) | null): void {
  if (config.env !== 'test') throw new Error('setProvisioningFaultForTests is available only in tests');
  provisioningFault = fn;
}

function errorCodeOf(err: unknown): string {
  if (err instanceof HttpError) return err.code;
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' ? `PG_${code}` : 'PROVISIONING_ERROR';
}

/** Create the project for a closed deal. Idempotent through the unique `projects.deal_id`. */
async function provisionForDeal(
  ctx: CommandContext,
  dealId: string,
  mode: 'auto' | 'manual',
  input: { name?: string; startDate?: string; targetDate?: string } = {}
): Promise<{ project: ProjectRow; created: boolean }> {
  const deal = await getDealSummary(ctx.tx, dealId);
  if (!deal) throw notFound();
  if (deal.stage !== 'closed') throw stateConflict('A project is created only for a closed deal');
  provisioningFault?.(dealId);
  const existing = await repo.findByDeal(ctx.tx, dealId);
  if (existing) {
    await repo.resolveProvisioning(ctx.tx, dealId, ctx.now);
    return { project: existing, created: false };
  }
  const bizName = (await businessNames(ctx.tx, [deal.businessId])).get(deal.businessId) ?? 'Project';
  const name = (input.name ?? `${bizName} (${deal.code})`).slice(0, 200);
  const inserted = await repo.insertProject(ctx.tx, {
    dealId,
    businessId: deal.businessId,
    name,
    startDate: input.startDate ?? null,
    targetDate: input.targetDate ?? null,
    provisionedBy: mode,
    provisionedById: mode === 'manual' ? actorIdOf(ctx) : null,
    now: ctx.now,
  });
  if (!inserted) {
    const again = await repo.findByDeal(ctx.tx, dealId);
    if (!again) throw stateConflict('The project could not be created');
    return { project: again, created: false };
  }
  await repo.insertChange(ctx.tx, { projectId: inserted.id, type: 'provisioned', after: { status: inserted.status, provisionedBy: mode }, actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, {
    eventName: 'project.provisioned',
    entityType: 'project',
    entityId: inserted.id,
    after: { dealId, status: inserted.status, provisionedBy: mode },
  });
  await repo.resolveProvisioning(ctx.tx, dealId, ctx.now);
  return { project: inserted, created: true };
}

/**
 * One automatic attempt inside a SAVEPOINT, so a failure is recorded (state row, E-15, J-07) in the
 * same transaction without the consumer/job itself failing (which would roll the bookkeeping back).
 */
export async function provisionAttempt(ctx: CommandContext, dealId: string): Promise<ProjectRow | null> {
  await ctx.tx.query('SAVEPOINT project_provision');
  try {
    const { project } = await provisionForDeal(ctx, dealId, 'auto');
    await ctx.tx.query('RELEASE SAVEPOINT project_provision');
    return project;
  } catch (err) {
    await ctx.tx.query('ROLLBACK TO SAVEPOINT project_provision');
    const code = errorCodeOf(err);
    const previous = (await repo.provisioningStates(ctx.tx, [dealId])).get(dealId);
    const attempt = (previous && !previous.resolved_at ? previous.attempts : 0) + 1;
    const delay = PROVISION_RETRY_DELAYS_MS[attempt - 1];
    const nextAt = delay === undefined ? null : new Date(ctx.now.getTime() + delay);
    const attempts = await repo.recordProvisioningFailure(ctx.tx, dealId, code, nextAt, ctx.now);
    await audit(ctx, { eventName: 'project.provisioning_failed', entityType: 'deal', entityId: dealId, payload: { attempts, errorCode: code, dead: nextAt === null } });
    await outbox.emit(ctx.tx, {
      name: 'project.provisioning_failed',
      aggregateType: 'deal',
      aggregateId: dealId,
      payload: { dealId, attempts, errorCode: code, dead: nextAt === null },
    });
    if (nextAt) {
      await jobs.enqueue(ctx.tx, 'projects.provision_retry', { dedupeKey: `${dealId}:${attempts}`, runAt: nextAt, payload: { dealId } });
    }
    return null;
  }
}

/** E-14 consumer `projects.provision` (system actor, own transaction). Manual mode: does nothing. */
export async function handleDealClosed(ctx: CommandContext, event: Pick<DeliveredEvent, 'payload'>): Promise<void> {
  if (!deliveryPolicy().autoProvision) return;
  const dealId = typeof event.payload.dealId === 'string' ? event.payload.dealId : null;
  if (!dealId) return;
  await provisionAttempt(ctx, dealId);
}

/** J-07 `projects.provision_retry` handler. */
export async function runProvisionRetry(ctx: CommandContext, payload: Record<string, unknown>): Promise<void> {
  if (!deliveryPolicy().autoProvision) return;
  const dealId = typeof payload.dealId === 'string' ? payload.dealId : null;
  if (!dealId) return;
  if (await repo.findByDeal(ctx.tx, dealId)) {
    await repo.resolveProvisioning(ctx.tx, dealId, ctx.now);
    return;
  }
  await provisionAttempt(ctx, dealId);
}

/** POST /api/projects — manual provisioning (F2 false). Owner or the deal's assigned Developer. */
export async function createManualProject(
  ctx: CommandContext,
  body: { dealId: string; name?: string; startDate?: string; targetDate?: string }
): Promise<ProjectDetailDto> {
  if (deliveryPolicy().autoProvision) throw stateConflict('Projects are created automatically');
  const deal = await getDealSummary(ctx.tx, body.dealId);
  if (!deal) throw notFound();
  await authorize(ctx, 'deal.update_stage', { type: 'deal', id: deal.id });
  const p = principalOf(ctx);
  if (p.role !== 'owner' && !(p.role === 'developer' && deal.assignedDeveloperId === p.employeeId)) throw permissionDenied();
  if (deal.stage !== 'closed') throw stateConflict('A project is created only for a closed deal');
  if (await repo.findByDeal(ctx.tx, deal.id)) throw new HttpError(409, 'CONFLICT_DUPLICATE', 'This deal already has a project');
  if (body.startDate && body.targetDate && body.targetDate < body.startDate) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { targetDate: ['Must be on or after the start date'] });
  }
  const { project, created } = await provisionForDeal(ctx, deal.id, 'manual', body);
  if (!created) throw new HttpError(409, 'CONFLICT_DUPLICATE', 'This deal already has a project');
  return detailFor(ctx, project);
}

/** POST /api/projects/:id/provision-retry — `:id` is the deal id. Owner; auto mode only; one inline attempt. */
export async function retryProvisioning(
  ctx: CommandContext,
  dealId: string
): Promise<{ project: ProjectDetailDto | null; provisioning: { state: 'provisioned' | 'failed'; attempts: number; lastErrorCode: string | null } }> {
  requireOwner(ctx);
  if (!deliveryPolicy().autoProvision) throw stateConflict('Automatic provisioning is off: create the project manually');
  const deal = await getDealSummary(ctx.tx, dealId);
  if (!deal) throw notFound();
  await authorize(ctx, 'project.provision_retry', { type: 'deal', id: deal.id });
  if (deal.stage !== 'closed') throw stateConflict('A project is created only for a closed deal');
  const existing = await repo.findByDeal(ctx.tx, dealId);
  if (existing) return { project: await detailFor(ctx, existing), provisioning: { state: 'provisioned', attempts: 0, lastErrorCode: null } };
  await repo.resetNextAttempt(ctx.tx, dealId, ctx.now);
  await audit(ctx, { eventName: 'project.provision_retry_requested', entityType: 'deal', entityId: dealId });
  const project = await provisionAttempt(ctx, dealId);
  if (project) return { project: await detailFor(ctx, project), provisioning: { state: 'provisioned', attempts: 0, lastErrorCode: null } };
  const s = (await repo.provisioningStates(ctx.tx, [dealId])).get(dealId);
  return { project: null, provisioning: { state: 'failed', attempts: s?.attempts ?? 0, lastErrorCode: s?.last_error_code ?? null } };
}

// ---------------------------------------------------------------------------
// Project commands
// ---------------------------------------------------------------------------
/** PATCH /api/projects/:id — name and schedule. */
export async function updateProject(
  ctx: CommandContext,
  id: string,
  body: { version: number; name?: string; startDate?: string | null; targetDate?: string | null }
): Promise<ProjectDetailDto> {
  const { project } = await lockProject(ctx, id, 'project.update_status');
  if (isFinal(project.status)) throw stateConflict(READ_ONLY);
  const set: Partial<Record<repo.ProjectColumn, unknown>> = {};
  if (body.name !== undefined && body.name !== project.name) set.name = body.name;
  if (body.startDate !== undefined && body.startDate !== project.start_date) set.start_date = body.startDate;
  if (body.targetDate !== undefined && body.targetDate !== project.target_date) set.target_date = body.targetDate;
  if (Object.keys(set).length === 0) return detailFor(ctx, project);
  await assertProjectVersion(ctx, project, body.version);
  const start = (set.start_date as string | null | undefined) ?? (body.startDate === undefined ? project.start_date : null);
  const target = (set.target_date as string | null | undefined) ?? (body.targetDate === undefined ? project.target_date : null);
  if (start && target && target < start) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { targetDate: ['Must be on or after the start date'] });
  }
  const before = { name: project.name, startDate: project.start_date, targetDate: project.target_date };
  const next = await saveProject(ctx, project, set);
  const after = { name: next.name, startDate: next.start_date, targetDate: next.target_date };
  await repo.insertChange(ctx.tx, { projectId: id, type: 'schedule_changed', before, after, actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, { eventName: 'project.schedule_changed', entityType: 'project', entityId: id, before, after });
  return detailFor(ctx, next);
}

/**
 * POST /api/projects/:id/status (delivery-design §5, §7). Delivered/Completed with open tasks and no
 * `acknowledgeOpenTasks` → 422 RULE_VIOLATION `details.code = OPEN_TASKS_WARNING`, nothing changes.
 * Acknowledged: only the project row and its history change; tasks, the deal and closure are untouched.
 */
export async function changeProjectStatus(
  ctx: CommandContext,
  id: string,
  body: { version: number; to: ProjectStatus; note?: string; acknowledgeOpenTasks?: boolean }
): Promise<ProjectDetailDto> {
  const { project } = await lockProject(ctx, id, 'project.update_status');
  const from = project.status;
  const noteRequired = NOTE_REQUIRED_STATUSES.includes(body.to);
  if (from === body.to && (!noteRequired || body.note === project.status_note)) return detailFor(ctx, project); // no-op
  if (from === 'completed') throw stateConflict('A completed project is read-only; the Owner can reopen it');
  if (from === 'cancelled') throw stateConflict('A cancelled project is final');
  if (body.to === 'cancelled') throw stateConflict('Only the Owner cancels a project, with a reason');
  const allowed = from === body.to ? [from] : PROJECT_TRANSITIONS[from];
  if (!allowed.includes(body.to)) throw stateConflict(`Cannot move from ${from} to ${body.to}`, { from, to: body.to, allowed: PROJECT_TRANSITIONS[from] });
  await assertProjectVersion(ctx, project, body.version);
  let openCount: number | null = null;
  if (OPEN_TASK_WARNING_TARGETS.includes(body.to)) {
    const open = await repo.openTasks(ctx.tx, id);
    openCount = open.length;
    if (open.length > 0 && body.acknowledgeOpenTasks !== true) {
      const details: OpenTasksWarningDetails = {
        code: 'OPEN_TASKS_WARNING',
        from,
        to: body.to,
        openTaskCount: open.length,
        openTasks: open.map((t) => ({ id: t.id, title: t.title, status: t.status, clientDependency: t.client_dependency })),
      };
      throw ruleViolation(`Record ${body.to} with open tasks?`, details);
    }
  }
  const set: Partial<Record<repo.ProjectColumn, unknown>> = {
    status: body.to,
    status_note: noteRequired ? body.note : null,
  };
  if (body.to === 'delivered') set.delivered_at = ctx.now;
  if (from === 'delivered' && body.to === 'in_progress') set.delivered_at = null; // rework
  if (body.to === 'completed') set.completed_at = ctx.now;
  const next = await saveProject(ctx, project, set);
  await repo.insertChange(ctx.tx, {
    projectId: id,
    type: 'status_changed',
    before: { status: from, note: project.status_note },
    after: { status: body.to, note: next.status_note },
    note: body.note ?? null,
    openTaskCount: openCount,
    actorId: actorIdOf(ctx),
    now: ctx.now,
  });
  await audit(ctx, {
    eventName: 'project.status_changed',
    entityType: 'project',
    entityId: id,
    before: { status: from },
    after: { status: body.to },
    reason: body.note ?? null,
    payload: openCount !== null ? { openTaskCount: openCount, acknowledgedOpenTasks: openCount > 0 } : undefined,
  });
  return detailFor(ctx, next);
}

/** POST /api/projects/:id/reopen — Owner, Completed -> In progress, reason (OQ-15, demonstration). */
export async function reopenProject(ctx: CommandContext, id: string, body: { version: number; reason: string }): Promise<ProjectDetailDto> {
  requireOwner(ctx);
  const { project } = await lockProject(ctx, id, 'project.reopen_completed');
  if (project.status !== 'completed') {
    if (project.status === 'in_progress') return detailFor(ctx, project); // already reopened: no-op
    throw stateConflict('Only a completed project can be reopened');
  }
  await assertProjectVersion(ctx, project, body.version);
  const next = await saveProject(ctx, project, { status: 'in_progress', completed_at: null, delivered_at: null, status_note: null });
  await repo.insertChange(ctx.tx, { projectId: id, type: 'status_changed', before: { status: 'completed' }, after: { status: 'in_progress', reopened: true }, note: body.reason, actorId: actorIdOf(ctx), now: ctx.now });
  await audit(ctx, { eventName: 'project.reopened', entityType: 'project', entityId: id, before: { status: 'completed' }, after: { status: 'in_progress' }, reason: body.reason });
  return detailFor(ctx, next);
}

/**
 * POST /api/projects/:id/cancel — Owner, reason required (D17). Any non-final status → Cancelled (final).
 * History is preserved: the project row, its tasks and the deal are kept; one `status_changed` change
 * (after.cancelled = true) and the `project.cancelled` audit event record it.
 */
export async function cancelProject(ctx: CommandContext, id: string, body: { version: number; reason: string }): Promise<ProjectDetailDto> {
  requireOwner(ctx);
  const { project } = await lockProject(ctx, id, 'project.reopen_completed');
  if (project.status === 'cancelled') return detailFor(ctx, project); // already cancelled: no-op
  if (project.status === 'completed') throw stateConflict('A completed project cannot be cancelled');
  await assertProjectVersion(ctx, project, body.version);
  const next = await saveProject(ctx, project, {
    status: 'cancelled',
    status_note: null,
    cancel_reason: body.reason,
    cancelled_at: ctx.now,
    cancelled_by_id: actorIdOf(ctx),
  });
  await repo.insertChange(ctx.tx, {
    projectId: id,
    type: 'status_changed',
    before: { status: project.status, note: project.status_note },
    after: { status: 'cancelled', cancelled: true },
    note: body.reason,
    actorId: actorIdOf(ctx),
    now: ctx.now,
  });
  await audit(ctx, { eventName: 'project.cancelled', entityType: 'project', entityId: id, before: { status: project.status }, after: { status: 'cancelled' }, reason: body.reason });
  return detailFor(ctx, next);
}

/** POST /api/projects/:id/developers — Owner sets the current Developer set (OQ-07/08). */
export async function setProjectDevelopers(ctx: CommandContext, id: string, body: { version: number; developerIds: string[] }): Promise<ProjectDetailDto> {
  requireOwner(ctx);
  const { project, developerIds } = await lockProject(ctx, id, 'project.assign_developers');
  if (isFinal(project.status)) throw stateConflict(READ_ONLY);
  const wanted = [...new Set(body.developerIds)];
  const add = wanted.filter((d) => !developerIds.includes(d));
  const remove = developerIds.filter((d) => !wanted.includes(d));
  if (add.length === 0 && remove.length === 0) return detailFor(ctx, project);
  await assertProjectVersion(ctx, project, body.version);
  for (const [i, d] of wanted.entries()) if (add.includes(d)) await assertActiveEmployee(ctx.tx, d, `developerIds.${i}`, 'developer');
  for (const d of remove) {
    await repo.unassignDeveloper(ctx.tx, id, d, ctx.now);
    await repo.insertChange(ctx.tx, { projectId: id, type: 'developer_unassigned', before: { developerId: d }, actorId: actorIdOf(ctx), now: ctx.now });
  }
  for (const d of add) {
    await repo.assignDeveloper(ctx.tx, id, d, actorIdOf(ctx)!, ctx.now);
    await repo.insertChange(ctx.tx, { projectId: id, type: 'developer_assigned', after: { developerId: d }, actorId: actorIdOf(ctx), now: ctx.now });
  }
  const next = await saveProject(ctx, project, {});
  await audit(ctx, { eventName: 'project.developers_changed', entityType: 'project', entityId: id, before: { developerIds }, after: { developerIds: wanted } });
  return detailFor(ctx, next);
}

// ---------------------------------------------------------------------------
// Task commands
// ---------------------------------------------------------------------------
export async function createTask(
  ctx: CommandContext,
  body: {
    projectId: string;
    title: string;
    description?: string;
    ownerId?: string;
    dueDate?: string;
    startDate?: string;
    isMilestone?: boolean;
    clientDependency?: boolean;
    clientDependencyNote?: string;
  }
): Promise<TaskDto> {
  const { project } = await lockProject(ctx, body.projectId, 'task.create');
  if (isFinal(project.status)) throw stateConflict(READ_ONLY);
  if (body.ownerId) await assertActiveEmployee(ctx.tx, body.ownerId, 'ownerId');
  const t = await repo.insertTask(ctx.tx, {
    projectId: project.id,
    title: body.title,
    description: body.description ?? null,
    ownerId: body.ownerId ?? null,
    dueDate: body.dueDate ?? null,
    startDate: body.startDate ?? null,
    isMilestone: body.isMilestone ?? false,
    clientDependency: body.clientDependency ?? false,
    clientDependencyNote: body.clientDependency ? body.clientDependencyNote ?? null : null,
    createdById: actorIdOf(ctx)!,
    now: ctx.now,
  });
  await audit(ctx, { eventName: 'task.created', entityType: 'task', entityId: t.id, after: { projectId: project.id, status: t.status, isMilestone: t.is_milestone } });
  const names = await employeeNames(ctx.tx, [t.owner_id]);
  return taskDto(t, names, true);
}

/** PATCH /api/tasks/:id — fields and/or a status move. The project status never changes here. */
export async function updateTask(
  ctx: CommandContext,
  id: string,
  body: {
    version: number;
    title?: string;
    description?: string | null;
    ownerId?: string | null;
    dueDate?: string | null;
    startDate?: string | null;
    isMilestone?: boolean;
    clientDependency?: boolean;
    clientDependencyNote?: string | null;
    sortOrder?: number;
    status?: TaskStatus;
    cancelReason?: string;
  }
): Promise<TaskDto> {
  const t = await repo.findTask(ctx.tx, id, true);
  if (!t) throw notFound();
  await authorize(ctx, body.status === 'done' ? 'task.complete' : 'task.update', { type: 'task', id });
  const { project } = await lockProject(ctx, t.project_id, 'task.update');
  if (isFinal(project.status)) throw stateConflict(READ_ONLY);
  const set: Partial<Record<repo.TaskColumn, unknown>> = {};
  const fields: [keyof typeof body, repo.TaskColumn, unknown][] = [
    ['title', 'title', t.title],
    ['description', 'description', t.description],
    ['ownerId', 'owner_id', t.owner_id],
    ['dueDate', 'due_date', t.due_date],
    ['startDate', 'start_date', t.start_date],
    ['isMilestone', 'is_milestone', t.is_milestone],
    ['clientDependency', 'client_dependency', t.client_dependency],
    ['clientDependencyNote', 'client_dependency_note', t.client_dependency_note],
    ['sortOrder', 'sort_order', t.sort_order],
  ];
  for (const [key, col, current] of fields) {
    const v = body[key];
    if (v !== undefined && v !== current) set[col] = v;
  }
  if (set.client_dependency === false) set.client_dependency_note = null;
  {
    const start = (set.start_date !== undefined ? set.start_date : t.start_date) as string | null;
    const due = (set.due_date !== undefined ? set.due_date : t.due_date) as string | null;
    if (start && due && start > due) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', { startDate: ['The start date must be on or before the due date'] });
    }
  }
  const statusChange = body.status !== undefined && body.status !== t.status;
  if (statusChange) {
    const to = body.status!;
    if (!TASK_TRANSITIONS[t.status].includes(to)) throw stateConflict(`Cannot move a task from ${t.status} to ${to}`, { from: t.status, to, allowed: TASK_TRANSITIONS[t.status] });
    set.status = to;
    if (to === 'done') {
      set.completed_at = ctx.now;
      set.completed_by_id = actorIdOf(ctx);
    } else if (t.status === 'done') {
      set.completed_at = null;
      set.completed_by_id = null;
    }
    if (to === 'cancelled') set.cancel_reason = body.cancelReason;
  }
  if (Object.keys(set).length === 0) return taskDto(t, await employeeNames(ctx.tx, [t.owner_id]), true); // no-op
  // BL-09: details.current = the task as it is now.
  if (t.version !== body.version) assertVersion(t, body.version, taskDto(t, await employeeNames(ctx.tx, [t.owner_id]), true));
  if (typeof set.owner_id === 'string') await assertActiveEmployee(ctx.tx, set.owner_id, 'ownerId');
  const next = await repo.updateTask(ctx.tx, id, t.version, set, ctx.now);
  if (!next) {
    const cur = await repo.findTask(ctx.tx, id);
    if (!cur) throw notFound();
    throw versionConflict(cur.version, taskDto(cur, await employeeNames(ctx.tx, [cur.owner_id]), true));
  }
  await audit(ctx, {
    eventName: statusChange ? (t.status === 'done' && next.status === 'in_progress' ? 'task.reopened' : 'task.status_changed') : 'task.updated',
    entityType: 'task',
    entityId: id,
    before: statusChange ? { status: t.status } : { fields: Object.keys(set) },
    after: statusChange ? { status: next.status } : undefined,
    reason: next.status === 'cancelled' && statusChange ? body.cancelReason ?? null : null,
  });
  return taskDto(next, await employeeNames(ctx.tx, [next.owner_id]), true);
}

export { OPEN_TASK_STATUSES };
