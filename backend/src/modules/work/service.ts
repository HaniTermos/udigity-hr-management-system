/**
 * MOD-work — service. Owner: BE1.
 * Business rules, public operations and audit for targets and work items.
 */
import type { Request } from 'express';
import { type Queryable } from '../../db/pool.js';
import { notFound, versionConflict } from '../../shared/errors.js';
import { access, type Action, type Principal } from '../../shared/access.js';
import { runCommand, audit } from '../../shared/tx.js';
import * as repo from './repo.js';
import type { CreateTargetInput, CreateWorkItemInput, TargetDto, UpdateTargetInput, UpdateWorkItemInput, WorkItemDto } from './schemas.js';

export async function listTargets(
  db: Queryable,
  principal: Principal,
  options: { employeeId?: string; limit?: number; offset?: number } = {}
): Promise<{ items: TargetDto[]; total: number }> {
  const targetEmployeeId = principal.role === 'owner' ? options.employeeId : principal.employeeId;
  return repo.listTargets(db, { ...options, employeeId: targetEmployeeId });
}

export async function getTarget(db: Queryable, principal: Principal, id: string): Promise<TargetDto> {
  const item = await repo.getTargetById(db, id);
  if (!item) throw notFound();
  if (principal.role !== 'owner' && item.employeeId !== principal.employeeId) {
    throw notFound();
  }
  return item;
}

export async function createTarget(req: Request, input: CreateTargetInput): Promise<TargetDto> {
  return runCommand(req, async (ctx) => {
    const target = await repo.insertTarget(ctx.tx, input);
    await audit(ctx, {
      eventName: 'target.assigned',
      entityType: 'target',
      entityId: target.id,
      after: {
        employeeId: target.employeeId,
        metric: target.metric,
        period: target.period,
        targetValue: target.targetValue,
        startDate: target.startDate,
        endDate: target.endDate,
        territory: target.territory,
      },
    });
    return target;
  });
}

export async function updateTarget(req: Request, id: string, input: UpdateTargetInput): Promise<TargetDto> {
  return runCommand(req, async (ctx) => {
    const before = await repo.getTargetById(ctx.tx, id);
    if (!before) throw notFound();

    const res = await repo.updateTarget(ctx.tx, id, input);
    if (res.conflict) {
      // BL-09: details.current is the record as it is now (was a message string).
      const current = (await repo.getTargetById(ctx.tx, id)) ?? before;
      throw versionConflict(res.currentVersion ?? current.version, current);
    }
    if (!res.target) throw notFound();

    await audit(ctx, {
      eventName: 'target.updated',
      entityType: 'target',
      entityId: id,
      before: {
        targetValue: before.targetValue,
        currentValue: before.currentValue,
        period: before.period,
        territory: before.territory,
        version: before.version,
      },
      after: {
        targetValue: res.target.targetValue,
        currentValue: res.target.currentValue,
        period: res.target.period,
        territory: res.target.territory,
        version: res.target.version,
      },
    });

    return res.target;
  });
}

export async function listWorkItems(
  db: Queryable,
  principal: Principal,
  options: { status?: string; openOnly?: boolean; limit?: number; offset?: number } = {}
): Promise<{ items: WorkItemDto[]; total: number }> {
  const assigneeId = principal.role === 'owner' ? undefined : principal.employeeId;
  const page = await repo.listWorkItems(db, { ...options, assigneeId });
  return { items: await withMyDayFields(db, principal, page.items), total: page.total };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function kindOf(sourceType: string | null): NonNullable<WorkItemDto['kind']> {
  if (sourceType === 'follow_up') return 'follow_up';
  if (sourceType === 'business' || sourceType === 'calling_assignment') return 'new_assignment';
  if (sourceType === 'retry' || sourceType === 'call_attempt') return 'retry';
  return 'next';
}

/**
 * FX-BE-C4: the My Day row shape (SCR-SHR-001) added to every work item. A business name is shown
 * only when the caller may read that business (access.checkMany); otherwise the item title is used.
 */
async function withMyDayFields(db: Queryable, principal: Principal, items: WorkItemDto[]): Promise<WorkItemDto[]> {
  const bizIds = [
    ...new Set(items.filter((w) => w.sourceType === 'business' && w.sourceId && UUID_RE.test(w.sourceId)).map((w) => w.sourceId as string)),
  ];
  const names = new Map<string, string>();
  if (bizIds.length > 0) {
    const decisions = await access.checkMany(db, principal, 'business.read' as Action, bizIds.map((id) => ({ type: 'business', id })));
    const readable = bizIds.filter((id) => decisions.get(id)?.allowed);
    if (readable.length > 0) {
      const { rows } = await db.query<{ id: string; name: string }>('SELECT id, name FROM businesses WHERE id = ANY($1::uuid[])', [readable]);
      for (const r of rows) names.set(r.id, r.name);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  return items.map((w) => {
    const due = w.dueDate ? w.dueDate.slice(0, 10) : null;
    const bizName = w.sourceId ? names.get(w.sourceId) : undefined;
    let statusLabel: string;
    if (w.status === 'completed') statusLabel = 'Done';
    else if (w.status === 'cancelled') statusLabel = 'Cancelled';
    else if (due && due < today) statusLabel = 'Overdue';
    else if (due && due === today) statusLabel = 'Due today';
    else if (w.status === 'in_progress') statusLabel = 'In progress';
    else statusLabel = 'To do';
    const excerpt = (w.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const detail = [due ? `Due ${due}` : null, bizName ? w.title : null, excerpt || null].filter(Boolean).join(' · ');
    return {
      ...w,
      businessId: bizName ? w.sourceId : null,
      businessName: bizName ?? w.title,
      kind: kindOf(w.sourceType),
      detail,
      statusLabel,
      dueAt: due,
    };
  });
}

const workItemAuditFields = (w: WorkItemDto) => ({
  assigneeId: w.assigneeId,
  title: w.title,
  status: w.status,
  dueDate: w.dueDate,
  version: w.version,
});

export async function createWorkItem(req: Request, input: CreateWorkItemInput): Promise<WorkItemDto> {
  return runCommand(req, async (ctx) => {
    const item = await repo.insertWorkItem(ctx.tx, input);
    // R2-03: audit in the same transaction (placeholder name, G2).
    await audit(ctx, { eventName: 'work_item.created', entityType: 'work_item', entityId: item.id, after: workItemAuditFields(item) });
    return item;
  });
}

/**
 * PATCH /api/work-items/:id (R2-03). Owner: any item. Other roles: only items assigned to them;
 * anything else is 404 NOT_FOUND with no data (authz §4.2), so ids cannot be probed.
 */
export async function updateWorkItem(req: Request, id: string, input: UpdateWorkItemInput): Promise<WorkItemDto> {
  return runCommand(req, async (ctx) => {
    const locked = await repo.lockWorkItem(ctx.tx, id);
    if (!locked) throw notFound();
    if (ctx.actor.kind !== 'employee') throw notFound();
    if (ctx.actor.role !== 'owner' && locked.assigneeId !== ctx.actor.employeeId) throw notFound();
    const before = await repo.getWorkItemById(ctx.tx, id);
    if (!before) throw notFound();

    const res = await repo.updateWorkItem(ctx.tx, id, input);
    if (res.conflict) {
      // BL-09: details.current is the record as it is now.
      const current = (await repo.getWorkItemById(ctx.tx, id)) ?? before;
      throw versionConflict(res.currentVersion ?? current.version, current);
    }
    if (!res.workItem) throw notFound();
    await audit(ctx, {
      eventName: 'work_item.updated',
      entityType: 'work_item',
      entityId: id,
      before: workItemAuditFields(before),
      after: workItemAuditFields(res.workItem),
    });
    return res.workItem;
  });
}
