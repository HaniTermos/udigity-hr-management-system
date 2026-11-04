'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardInset } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Checkbox, DateInput, Input, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/hooks/useApi';
import { useVersionedSave, type UseVersionedSaveResult } from '@/lib/hooks/useVersionedSave';
import { dealsPaths, type AssignableDeveloper, type DealResponse } from '@/lib/api/deals';
import {
  asOpenTasksWarning,
  changeProjectStatus,
  createTask,
  projectsPaths,
  reopenProject,
  cancelProject,
  assignProjectDevelopers,
  updateTask,
  type OpenTasksWarning,
  type Project,
  type ProjectDetail,
  type ProjectDetailResponse,
  type ProjectHistoryItem,
  type ProjectStatus,
  type Task,
  type TaskStatus } from '@/lib/api/projects';
import { RecordDeliveredDialog } from './RecordDeliveredDialog';
import { TaskDrawer } from './TaskDrawer';
import {
  ActionError,
  AssignedChip,
  ClientDependencyChip,
  type ConflictSnapshot,
  DeliveryConflict,
  fieldMessage,
  fmtDate,
  fmtDayMonth,
  InlineError,
  LoadError,
  ProjectStatusBadge,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_OPTION_LABEL,
  TASK_STATUS_LABEL,
  TaskStatusBadge,
  todayInput } from './shared';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

/** Statuses that need a typed explanation before the move (server: 400 without `note`). */
const NEEDS_NOTE: Partial<Record<ProjectStatus, { title: string; label: string }>> = {
  blocked: { title: 'Put project on hold (blocked)', label: 'Blocker reason' },
  waiting_for_client: { title: 'Put project on hold (waiting for client)', label: 'What are we waiting for?' },
};

const CONFLICT_LABELS = [
  { key: 'status', label: 'Project status' },
  { key: 'note', label: 'Status note' },
  { key: 'tasks', label: 'Tasks' },
];

function describeProject(p: Project): Record<string, string> {
  return {
    status: PROJECT_STATUS_LABEL[p.status],
    note: p.statusNote ?? '',
    tasks: `${p.taskCounts.done + p.taskCounts.cancelled} of ${p.taskCounts.total} closed · ${p.taskCounts.open} open`,
  };
}

function moveLabel(from: ProjectStatus, to: ProjectStatus): string {
  if (to === 'delivered') return 'Record delivered';
  if (to === 'completed') return 'Record completed';
  if (to === 'scheduled') return 'Back to Not started';
  if (to === 'in_progress') return from === 'delivered' ? 'Back to In progress' : 'Start work';
  return `${PROJECT_STATUS_OPTION_LABEL[to]}…`;
}

function taskActionLabel(from: TaskStatus, to: TaskStatus): string {
  if (to === 'cancelled') return 'Cancel…';
  if (to === 'done') return 'Mark done';
  if (to === 'todo') return 'Back to To do';
  return from === 'done' ? 'Reopen' : 'Start';
}

type Pending =
  | { kind: 'note'; to: ProjectStatus }
  | { kind: 'task-cancel'; task: Task }
  | { kind: 'reopen' }
  | { kind: 'cancel' }
  | { kind: 'assign-devs' }
  | { kind: 'add-task' };

interface StatusInput {
  to: ProjectStatus;
  note?: string;
  acknowledge: boolean;
  mine: Record<string, string>;
}
type StatusResult = { project: Project; warning?: undefined } | { warning: OpenTasksWarning; project?: undefined };

export function ProjectBoard({ id }: { id: string }) {
  const toast = useToast();
  const { data, error, isLoading, retry } = useApi<ProjectDetailResponse>(projectsPaths.detail(id));
  const deal = useApi<DealResponse>(data ? dealsPaths.detail(data.project.dealId) : null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [warning, setWarning] = useState<{ warning: OpenTasksWarning; note?: string } | null>(null);
  const [text, setText] = useState('');
  const [conflict, setConflict] = useState<ConflictSnapshot | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const statusSave = useVersionedSave<StatusInput, StatusResult>(async (input, ctx) => {
    try {
      const project = await changeProjectStatus(id, {
        version: ctx.version,
        to: input.to,
        note: input.note,
        acknowledgeOpenTasks: input.acknowledge ? true : undefined,
      }, ctx.idempotencyKey);
      return { project };
    } catch (e) {
      const w = asOpenTasksWarning(e);
      if (w) return { warning: w };
      throw e;
    }
  });
  const taskSave = useVersionedSave<{ task: Task; to: TaskStatus; cancelReason?: string; mine: Record<string, string> }, Task>((input, ctx) =>
    updateTask(input.task.id, { version: ctx.version, status: input.to, cancelReason: input.cancelReason }, ctx.idempotencyKey)
  );
  const reopenSave = useVersionedSave<{ reason: string; mine: Record<string, string> }, Project>((input, ctx) =>
    reopenProject(id, { version: ctx.version, reason: input.reason }, ctx.idempotencyKey)
  );
  const cancelSave = useVersionedSave<{ reason: string; mine: Record<string, string> }, Project>((input, ctx) =>
    cancelProject(id, { version: ctx.version, reason: input.reason }, ctx.idempotencyKey)
  );

  const assignSave = useVersionedSave<{ ids: string[]; mine: Record<string, string> }, Project>((input, ctx) =>
    assignProjectDevelopers(id, { version: ctx.version, developerIds: input.ids }, ctx.idempotencyKey)
  );

  const p: ProjectDetail | undefined = data?.project;

  const reported = useRef<unknown>(null);
  useEffect(() => {
    const c = statusSave.conflict ?? taskSave.conflict ?? reopenSave.conflict ?? cancelSave.conflict ?? assignSave.conflict;
    if (!c || reported.current === c || !p) return;
    reported.current = c;
    const attempted = c.attempted as { mine: Record<string, string> };
    setConflict({
      entity: 'project',
      labels: CONFLICT_LABELS,
      base: describeProject(p),
      mine: { ...describeProject(p), ...attempted.mine },
      baseUpdatedAt: p.updatedAt,
    });
    void retry();
  }, [statusSave.conflict, taskSave.conflict, reopenSave.conflict, cancelSave.conflict, assignSave.conflict, p, retry]);

  if (error) return <LoadError error={error} onRetry={() => void retry()} backHref="/projects" backLabel="Back to Projects" what="this project" />;
  if (isLoading || !p) return <BoardSkeleton />;

  const readOnly = p.readOnly;
  const canChange = p.allowed.changeStatus && !readOnly;
  const busy = statusSave.status === 'saving' || taskSave.status === 'saving' || reopenSave.status === 'saving' || cancelSave.status === 'saving' || assignSave.status === 'saving';
  const lastStatusChange = [...p.history].filter((h) => h.type === 'status_changed').sort((x, y) => y.at.localeCompare(x.at))[0];
  const milestones = p.tasks.filter((t) => t.isMilestone);

  function closeAll() {
    setPending(null);
    setWarning(null);
    setText('');
    setConflict(null);
  }

  async function moveProject(to: ProjectStatus, note?: string, acknowledge = false) {
    if (!p) return;
    const input: StatusInput = {
      to,
      note,
      acknowledge,
      mine: { status: PROJECT_STATUS_LABEL[to], ...(note ? { note } : {}) },
    };
    const r = await statusSave.save(input, p.version);
    if (!r) return;
    if (r.warning) {
      setWarning({ warning: r.warning, note });
      return;
    }
    const open = r.project.taskCounts.open;
    toast.show({
      tone: 'success',
      title: `Project moved to ${PROJECT_STATUS_LABEL[to]}`,
      body: (to === 'delivered' || to === 'completed') && open > 0 ? `${open} task${open === 1 ? '' : 's'} still open` : undefined,
    });
    closeAll();
    void retry();
  }

  function requestMove(to: ProjectStatus) {
    statusSave.reset();
    if (NEEDS_NOTE[to]) setPending({ kind: 'note', to });
    else void moveProject(to);
  }

  async function moveTask(task: Task, to: TaskStatus, cancelReason?: string) {
    const r = await taskSave.save(
      { task, to, cancelReason, mine: { tasks: `${task.title} → ${TASK_STATUS_LABEL[to]}` } },
      task.version
    );
    if (r) {
      toast.show({ tone: 'success', title: to === 'cancelled' ? 'Task cancelled' : 'Task updated' });
      closeAll();
      void retry();
    }
  }

  function requestTask(task: Task, to: TaskStatus) {
    taskSave.reset();
    if (to === 'cancelled') setPending({ kind: 'task-cancel', task });
    else void moveTask(task, to);
  }

  const noteCfg = pending?.kind === 'note' ? NEEDS_NOTE[pending.to] : null;
  const dialogBusy = busy;
  const dialogRoute = pending?.kind === 'task-cancel' ? taskSave : pending?.kind === 'reopen' ? reopenSave : pending?.kind === 'cancel' ? cancelSave : statusSave;

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-text-secondary">
        <Link href="/projects" className="text-text-link hover:underline">
          Projects
        </Link>
        <Icon name="chevron-right" size={12} />
        <span className="text-text-link">{p.businessName ?? p.dealCode}</span>
        <Icon name="chevron-right" size={12} />
        <span>{p.code}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl leading-8 font-semibold tracking-tight text-text-primary [overflow-wrap:anywhere]">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
            <ProjectStatusBadge status={p.status} />
            <Badge tone="info" hasDot>
              Deal · Verified closed
            </Badge>
            {p.assignedToMe && <AssignedChip />}
            {p.developers.length === 0 ? (
              <Badge tone="warning" derived>
                No developer assigned
              </Badge>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2">
                {p.developers.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-2">
                    <Avatar name={d.fullName} size="sm" tone="neutral" />
                    {d.fullName}
                  </span>
                ))}
                <span>· assigned developer{p.developers.length === 1 ? '' : 's'}</span>
              </span>
            )}
            <span className="text-text-muted">{p.code}</span>
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {p.allowed.assignDevelopers && (
              <Button
                variant="secondary"
                leadingIcon={<Icon name="user" size={16} />}
                disabled={busy}
                onClick={() => setPending({ kind: 'assign-devs' })}
              >
                {p.developers.length === 0 ? 'Assign developer' : 'Manage developers'}
              </Button>
            )}
            <Button leadingIcon={<Icon name="plus" size={16} />} disabled={!p.allowed.createTask || busy} onClick={() => setPending({ kind: 'add-task' })}>
              Add task
            </Button>
            {p.allowed.cancel && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  cancelSave.reset();
                  setPending({ kind: 'cancel' });
                }}
              >
                Cancel project…
              </Button>
            )}
          </div>
        )}
      </div>

      {readOnly && (
        <div className="space-y-2">
          <p className="text-[13px] text-text-muted">
            {p.status === 'cancelled'
              ? `This project was cancelled${p.cancelledAt ? ` on ${fmtDate(p.cancelledAt)}` : ''}: ${p.cancelReason ?? 'no reason recorded'}. Its history and tasks are kept; nothing can be changed.`
              : 'This project is Completed. Status, schedule and tasks can no longer be changed.'}
          </p>
          {p.allowed.reopen && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                reopenSave.reset();
                setPending({ kind: 'reopen' });
              }}
            >
              Reopen project…
            </Button>
          )}
        </div>
      )}

      {conflict && (
        <DeliveryConflict
          snapshot={conflict}
          latest={describeProject(p)}
          latestUpdatedAt={p.updatedAt}
          onReapply={() => setConflict(null)}
          onReload={closeAll}
          onCancel={closeAll}
        />
      )}
      {!pending && !warning && (statusSave.status === 'failed' || taskSave.status === 'failed' || reopenSave.status === 'failed' || cancelSave.status === 'failed') && (
        <ActionError
          route={statusSave.route ?? taskSave.route ?? reopenSave.route ?? cancelSave.route}
          error={statusSave.error ?? taskSave.error ?? reopenSave.error ?? cancelSave.error}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="ds-overline text-text-muted">Project status</span>
              <ProjectStatusBadge status={p.status} />
              <span className="text-[13px] text-text-muted">since {fmtDate(lastStatusChange?.at ?? p.createdAt, false)}</span>
            </div>
            {p.statusNote && <p className="text-[13px] text-text-secondary">{p.statusNote}</p>}
            {canChange && p.allowedNextStatuses.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-text-secondary">Move project to:</span>
                {p.allowedNextStatuses.map((s) => (
                  <Button
                    key={s}
                    variant={s === 'delivered' || s === 'completed' ? 'secondary' : 'ghost'}
                    size="sm"
                    disabled={busy}
                    onClick={() => requestMove(s)}
                  >
                    {moveLabel(p.status, s)}
                  </Button>
                ))}
                <span className="text-xs text-text-muted max-w-[220px]">Non-linear · Completed only from Delivered</span>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-text-primary">
              Schedule & milestones{' '}
              <span className="ml-2 text-sm font-normal text-text-secondary">
                {p.startDate ? `Start ${fmtDate(p.startDate)} → ` : ''}Target delivery {fmtDate(p.targetDate)}
              </span>
            </h2>
            <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {milestones.map((m) => (
                <li key={m.id} className="flex flex-col items-center text-center gap-1">
                  <span
                    className={
                      m.status === 'done'
                        ? 'w-5 h-5 rounded-full bg-status-success-solid text-text-on-primary inline-flex items-center justify-center'
                        : 'w-5 h-5 rounded-full border-2 border-border-strong bg-surface-default'
                    }
                  >
                    {m.status === 'done' && <Icon name="check" size={12} />}
                  </span>
                  <span className="text-[13px] font-medium text-text-primary">{m.title}</span>
                  <span className="text-xs text-text-muted">
                    {m.status === 'done' ? `${fmtDate(m.completedAt, false)} · achieved` : m.dueDate ? fmtDate(m.dueDate, false) : 'No date'}
                  </span>
                </li>
              ))}
              {milestones.length === 0 && <li className="col-span-full text-[13px] text-text-muted">No milestones set.</li>}
            </ol>
          </Card>

          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary mr-2">Tasks</span>
              {p.tasks.length} · Columns are task statuses. Moving a task never changes the project status.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {COLUMNS.map((col) => {
                const tasks = p.tasks.filter((t) => t.status === col);
                return (
                  <section key={col} aria-label={TASK_STATUS_LABEL[col]} className="rounded-xl bg-surface-subtle border border-border-subtle p-3 space-y-3 min-h-[200px]">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      {TASK_STATUS_LABEL[col]}
                      <span className="text-xs font-normal text-text-muted tabular-nums">{tasks.length}</span>
                    </h3>
                    {tasks.length === 0 && (
                      <div className="text-[13px] text-text-muted">
                        <p className="font-medium text-text-secondary">No tasks</p>
                        {col === 'cancelled' && <p>Cancelling needs a reason.</p>}
                      </div>
                    )}
                    {tasks.map((t) => (
                      <TaskCard key={t.id} task={t} readOnly={readOnly} busy={busy} onOpen={() => setOpenTaskId(t.id)} onMove={(s) => requestTask(t, s)} />
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-text-primary">Deal context</h2>
              <Link href={`/deals/${p.dealId}`} className="text-[13px] font-medium text-text-link hover:underline">
                Open deal {p.dealCode}
              </Link>
            </div>
            <p className="text-[13px] text-text-muted">Closed ≠ Completed: delivery continues here.</p>
            {deal.error ? (
              <InlineError error={deal.error} onRetry={() => void deal.retry()} what="the deal" />
            ) : !deal.data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
                <dt className="text-text-secondary">Accepted</dt>
                <dd>{fmtDate(deal.data.deal.createdAt)}</dd>
                <dt className="text-text-secondary">Signed</dt>
                <dd>{deal.data.deal.facts.signature ? fmtDate(deal.data.deal.facts.signature.date) : 'Not recorded'}</dd>
                <dt className="text-text-secondary">Paid</dt>
                <dd>{deal.data.deal.facts.payment ? fmtDate(deal.data.deal.facts.payment.date) : 'Not recorded'}</dd>
                <dt className="text-text-secondary">Closed</dt>
                <dd>{deal.data.deal.closure ? fmtDate(deal.data.deal.closure.closedAt) : 'Not closed'}</dd>
              </dl>
            )}
            <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
              <dt className="text-text-secondary">Project</dt>
              <dd>{p.provisionedBy === 'auto' ? 'Provisioned automatically at closure' : 'Created manually'}</dd>
            </dl>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-text-primary">Client dependencies & notes</h2>
            {!p.statusNote && !p.tasks.some((t) => t.clientDependency) && <p className="text-[13px] text-text-muted">No notes yet.</p>}
            {p.statusNote && (
              <CardInset className="bg-status-warning-bg border-status-warning-border text-status-warning-fg text-[13px] space-y-1">
                <p className="font-medium">{PROJECT_STATUS_LABEL[p.status]}</p>
                <p>{p.statusNote}</p>
              </CardInset>
            )}
            {p.tasks
              .filter((t) => t.clientDependency)
              .map((t) => (
                <CardInset key={t.id} className="bg-status-warning-bg border-status-warning-border text-status-warning-fg text-[13px] space-y-1">
                  <p className="font-medium">{t.title}</p>
                  {t.clientDependencyNote && <p>{t.clientDependencyNote}</p>}
                </CardInset>
              ))}
            <h2 className="text-base font-semibold text-text-primary pt-2">Activity</h2>
            {[...p.history]
              .sort((x, y) => y.at.localeCompare(x.at))
              .map((h) => (
                <div key={h.id} className="text-[13px]">
                  <p className="font-medium text-text-primary">{historyLabel(h)}</p>
                  <p className="text-text-muted">
                    {fmtDayMonth(h.at)}
                    {h.note ? ` · ${h.note}` : ''}
                    {h.openTaskCount ? ` · ${h.openTaskCount} task${h.openTaskCount === 1 ? '' : 's'} still open` : ''}
                  </p>
                </div>
              ))}
          </Card>
        </aside>
      </div>

      {warning && (
        <RecordDeliveredDialog
          project={p}
          warning={warning.warning}
          busy={dialogBusy}
          route={statusSave.route}
          error={statusSave.error}
          onCancel={() => {
            setWarning(null);
            statusSave.reset();
          }}
          onReview={() => {
            setWarning(null);
            statusSave.reset();
          }}
          onConfirm={() => void moveProject(warning.warning.to, warning.note, true)}
        />
      )}

      <Dialog
        isOpen={(pending?.kind === 'note' || pending?.kind === 'task-cancel' || pending?.kind === 'reopen' || pending?.kind === 'cancel') && !conflict}
        onClose={() => {
          setPending(null);
          setText('');
        }}
        title={
          pending?.kind === 'task-cancel' ? 'Cancel task' : pending?.kind === 'reopen' ? 'Reopen project' : pending?.kind === 'cancel' ? 'Cancel project' : noteCfg?.title ?? ''
        }
        description={pending?.kind === 'task-cancel' ? pending.task.title : p.name}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
                setText('');
              }}
              disabled={dialogBusy}
            >
              Back
            </Button>
            <Button
              disabled={text.trim().length < 3 || dialogBusy}
              isLoading={dialogBusy}
              onClick={async () => {
                const reason = text.trim();
                if (pending?.kind === 'note') await moveProject(pending.to, reason);
                if (pending?.kind === 'task-cancel') await moveTask(pending.task, 'cancelled', reason);
                if (pending?.kind === 'reopen') {
                  const r = await reopenSave.save({ reason, mine: { status: PROJECT_STATUS_LABEL.in_progress } }, p.version);
                  if (r) {
                    toast.show({ tone: 'success', title: 'Project reopened' });
                    closeAll();
                    void retry();
                  }
                }
                if (pending?.kind === 'cancel') {
                  const r = await cancelSave.save({ reason, mine: { status: PROJECT_STATUS_LABEL.cancelled } }, p.version);
                  if (r) {
                    toast.show({ tone: 'success', title: 'Project cancelled' });
                    closeAll();
                    void retry();
                  }
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            label={pending?.kind === 'task-cancel' ? 'Cancel reason' : pending?.kind === 'reopen' || pending?.kind === 'cancel' ? 'Reason' : noteCfg?.label ?? ''}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            helperText={
              pending?.kind === 'reopen'
                ? 'Owner only. Completed returns to In progress.'
                : pending?.kind === 'cancel'
                  ? 'Owner only. Cancelled is final; the project history and tasks are kept.'
                  : 'Required. Recorded in the project activity.'
            }
            error={fieldMessage(dialogRoute.fieldErrors, 'note', 'cancelReason', 'reason')}
          />
          <ActionError route={dialogRoute.route} error={dialogRoute.error} />
        </div>
      </Dialog>

      {p.allowed.assignDevelopers && pending?.kind === 'assign-devs' && !conflict && (
        <AssignDevelopersDialog
          project={p}
          save={assignSave}
          onClose={() => {
            assignSave.reset();
            setPending(null);
          }}
          onSaved={() => {
            toast.show({ tone: 'success', title: 'Project developers updated', body: p.name });
            closeAll();
            void retry();
          }}
        />
      )}

      {openTaskId && p.tasks.some((t) => t.id === openTaskId) && !(pending?.kind === 'task-cancel') && (
        <TaskDrawer
          key={openTaskId}
          task={p.tasks.find((t) => t.id === openTaskId) as Task}
          project={p}
          readOnly={readOnly}
          onClose={() => setOpenTaskId(null)}
          onSaved={() => void retry()}
          onConflict={() => void retry()}
          onCancelTask={(t) => {
            taskSave.reset();
            setOpenTaskId(null);
            setPending({ kind: 'task-cancel', task: t });
          }}
        />
      )}

      {pending?.kind === 'add-task' && (
        <AddTaskDialog
          projectId={p.id}
          onClose={() => setPending(null)}
          onCreated={() => {
            toast.show({ tone: 'success', title: 'Task added' });
            setPending(null);
            void retry();
          }}
        />
      )}
    </div>
  );
}

function statusOf(x: unknown): string | null {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object' && 'status' in x && typeof (x as { status: unknown }).status === 'string') return (x as { status: string }).status;
  return null;
}

function statusName(s: string | null): string {
  return s && s in PROJECT_STATUS_LABEL ? PROJECT_STATUS_LABEL[s as ProjectStatus] : (s ?? '');
}

function historyLabel(h: ProjectHistoryItem): string {
  switch (h.type) {
    case 'provisioned':
      return 'Project provisioned';
    case 'status_changed': {
      const from = statusOf(h.before);
      const to = statusOf(h.after);
      return from && to ? `Status: ${statusName(from)} → ${statusName(to)}` : 'Status changed';
    }
    case 'schedule_changed':
      return 'Schedule changed';
    case 'developer_assigned':
      return 'Developer assigned';
    case 'developer_unassigned':
      return 'Developer unassigned';
  }
}

function TaskCard({ task, readOnly, busy, onOpen, onMove }: { task: Task; readOnly: boolean; busy: boolean; onOpen: () => void; onMove: (s: TaskStatus) => void }) {
  return (
    <Card className="p-3.5 space-y-2">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left text-sm font-semibold text-text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm"
        aria-label={`Open task: ${task.title}`}
      >
        {task.title}
      </button>
      {task.description && <p className="text-[13px] text-text-muted">{task.description}</p>}
      {task.clientDependency && (
        <div className="space-y-1">
          <ClientDependencyChip />
          {task.clientDependencyNote && <p className="text-xs text-text-muted">{task.clientDependencyNote}</p>}
        </div>
      )}
      {task.status === 'cancelled' && task.cancelReason && <p className="text-xs text-text-muted">Cancelled: {task.cancelReason}</p>}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        {task.ownerName ? <Avatar name={task.ownerName} size="sm" tone="neutral" /> : null}
        <span>
          {task.status === 'done'
            ? task.completedAt
              ? fmtDayMonth(task.completedAt)
              : 'Done'
            : task.dueDate
              ? `Due ${fmtDate(task.dueDate, false)}`
              : 'No due date'}
        </span>
        {task.status === 'done' && <TaskStatusBadge status="done" />}
      </div>
      {!readOnly && task.allowedNextStatuses.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border-subtle">
          {task.allowedNextStatuses.map((to) => (
            <Button key={to} variant="ghost" size="sm" disabled={busy} aria-label={`${taskActionLabel(task.status, to).replace(/…$/, '')} task: ${task.title}`} onClick={() => onMove(to)}>
              {taskActionLabel(task.status, to)}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

function AddTaskDialog({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState('');
  const [dependency, setDependency] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const { status, fieldErrors, error, route, save, retry } = useVersionedSave<null, Task>(
    (_input, ctx) =>
      createTask(
        {
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: due || undefined,
          clientDependency: dependency || undefined,
        },
        ctx.idempotencyKey
      ),
    { onSaved: onCreated }
  );
  const busy = status === 'saving';
  const err = (k: string) => local[k] ?? fieldMessage(fieldErrors, k);
  return (
    <Dialog
      isOpen
      onClose={busy ? () => undefined : onClose}
      title="Add task"
      description="Tasks have their own statuses; adding one never changes the project status."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            isLoading={busy}
            disabled={busy}
            onClick={() => {
              const next: Record<string, string> = {};
              if (!title.trim()) next.title = 'Add a task title.';
              if (due && due < todayInput()) next.dueDate = 'The due date is in the past.';
              setLocal(next);
              if (Object.keys(next).length === 0) void save(null, 1);
            }}
          >
            Add task
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} error={err('title')} maxLength={200} />
        <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} error={err('description')} />
        <DateInput label="Due date (optional)" value={due} onChange={(e) => setDue(e.target.value)} error={err('dueDate')} />
        <Checkbox label="Waiting on the client (shows the Client dependency chip)" checked={dependency} onChange={(e) => setDependency(e.target.checked)} />
        <ActionError route={route} error={error} onRetry={() => void retry()} />
      </div>
    </Dialog>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-5 max-w-[1200px] mx-auto" aria-busy="true">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}


interface DeveloperRow {
  id: string;
  name: string;
  inactive: boolean;
}

/** Active developers from the picker plus anyone already assigned who is no longer in it (inactive). */
export function mergeDeveloperRows(active: AssignableDeveloper[], assigned: { id: string; fullName: string }[]): DeveloperRow[] {
  const rows: DeveloperRow[] = active.map((d) => ({ id: d.id, name: d.name, inactive: false }));
  const seen = new Set(rows.map((r) => r.id));
  for (const a of assigned) if (!seen.has(a.id)) rows.unshift({ id: a.id, name: a.fullName, inactive: true });
  return rows;
}

function AssignDevelopersDialog({
  project,
  save,
  onClose,
  onSaved,
}: {
  project: ProjectDetail;
  save: UseVersionedSaveResult<{ ids: string[]; mine: Record<string, string> }, Project>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const devs = useApi<{ items: AssignableDeveloper[] }>(dealsPaths.developers, { refreshInterval: 0 });
  // Snapshot when the dialog opens: polling must not reset the ticks or move the version under the user (B-19).
  const [baseVersion] = useState(project.version);
  const [assigned] = useState(project.developers);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => project.developers.map((d) => d.id));
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);

  function toggle(id: string) {
    setConfirmRemoveAll(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Nothing is listed until the active list has loaded: otherwise an assigned developer flashes "Inactive" (A-09).
  const rows = useMemo(() => (devs.data ? mergeDeveloperRows(devs.data.items ?? [], assigned) : []), [devs.data, assigned]);
  const removingAll = selectedIds.length === 0 && assigned.length > 0;

  async function handleSave() {
    if (removingAll && !confirmRemoveAll) {
      setConfirmRemoveAll(true);
      return;
    }
    const names = rows.filter((r) => selectedIds.includes(r.id)).map((r) => r.name);
    const r = await save.save({ ids: selectedIds, mine: { developers: names.length ? names.join(', ') : 'None' } }, baseVersion);
    if (r) onSaved();
  }

  const busy = save.status === 'saving';

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Assign developers"
      description={`${project.name} · ${project.code}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} isLoading={busy} disabled={busy || devs.isLoading}>
            {removingAll && confirmRemoveAll ? 'Yes, remove all developers' : 'Save assignments'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Select one or more active developers to assign to this project. Developers assigned here will have access to the project board and can be assigned to tasks.
        </p>

        {devs.isLoading && <p className="text-sm text-text-muted">Loading active developers…</p>}
        {devs.error && <Alert tone="danger" title="Could not load developers" body={devs.error.message} />}

        {!devs.isLoading && !devs.error && rows.length === 0 && <p className="text-sm text-text-muted">No active developers found in the company.</p>}

        {rows.length > 0 && (
          <div className="space-y-1 max-h-60 overflow-y-auto divide-y divide-border-subtle border border-border-default rounded-lg p-2">
            {rows.map((dev) => (
              <label key={dev.id} className="flex items-center gap-3 py-2 px-2 cursor-pointer hover:bg-surface-subtle rounded transition-colors">
                <input
                  type="checkbox"
                  className="rounded border-border-strong text-brand-accent focus:ring-brand-accent h-4 w-4"
                  checked={selectedIds.includes(dev.id)}
                  onChange={() => toggle(dev.id)}
                />
                <Avatar name={dev.name} size="sm" tone="neutral" />
                <span className="text-sm font-medium text-text-primary">{dev.name}</span>
                {dev.inactive && <Badge tone="warning">Inactive</Badge>}
              </label>
            ))}
          </div>
        )}

        {removingAll && confirmRemoveAll && (
          <Alert
            tone="warning"
            title="Remove every developer?"
            body="No developer will be assigned to this project afterwards. Press the button again to confirm."
          />
        )}
        <ActionError route={save.route} error={save.error} onRetry={() => void save.retry()} />
      </div>
    </Dialog>
  );
}
