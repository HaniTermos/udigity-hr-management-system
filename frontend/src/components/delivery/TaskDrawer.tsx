'use client';

import React, { useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Checkbox, DateInput, Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { updateTask, type ProjectDetail, type Task, type TaskStatus } from '@/lib/api/projects';
import { ActionError, ClientDependencyChip, fieldMessage, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL, todayInput } from './shared';

interface Draft {
  title: string;
  status: TaskStatus;
  ownerId: string;
  dueDate: string;
  description: string;
  clientDependency: boolean;
  clientDependencyNote: string;
}

function draftOf(t: Task): Draft {
  return {
    title: t.title,
    status: t.status,
    ownerId: t.ownerId ?? '',
    dueDate: t.dueDate ?? '',
    description: t.description ?? '',
    clientDependency: t.clientDependency,
    clientDependencyNote: t.clientDependencyNote ?? '',
  };
}

const DESCRIPTION_MAX = 500;

/**
 * SCR-DEV-007 Task detail drawer. Edits the task on `PATCH /api/tasks/:id`. The status select offers only the moves the
 * server allows; cancelling goes through "Cancel task..." because it needs a reason. Task status never changes the
 * project status. `task` is the live task from the board: after a 409 the board reloads, the version sent moves to the
 * latest, and only the fields the user changed (against what they opened) are sent, so typed values are kept.
 * The API has no task start date, so that field from the frame is not shown.
 */
export function TaskDrawer({
  task,
  project,
  readOnly,
  onClose,
  onSaved,
  onConflict,
  onCancelTask,
}: {
  task: Task;
  project: ProjectDetail;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** The save answered 409: reload the board so `task` carries the latest version. */
  onConflict: () => void;
  onCancelTask: (t: Task) => void;
}) {
  const toast = useToast();
  const [baseTask] = useState<Task>(task);
  const base = { current: baseTask };
  const [draft, setDraft] = useState<Draft>(() => draftOf(task));
  const [local, setLocal] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const { status, conflict, fieldErrors, error, route, save, retry } = useVersionedSave<Draft, Task>(
    (input, ctx) => {
      const b = base.current;
      const patch: Parameters<typeof updateTask>[1] = { version: ctx.version };
      if (input.title.trim() !== b.title) patch.title = input.title.trim();
      if (input.status !== b.status) patch.status = input.status;
      if ((input.ownerId || null) !== b.ownerId) patch.ownerId = input.ownerId || null;
      if ((input.dueDate || null) !== b.dueDate) patch.dueDate = input.dueDate || null;
      if ((input.description.trim() || null) !== b.description) patch.description = input.description.trim() || null;
      if (input.clientDependency !== b.clientDependency) patch.clientDependency = input.clientDependency;
      const note = input.clientDependency ? input.clientDependencyNote.trim() || null : null;
      if (note !== b.clientDependencyNote) patch.clientDependencyNote = note;
      return updateTask(task.id, patch, ctx.idempotencyKey);
    },
    {
      onSaved: () => {
        toast.show({ tone: 'success', title: 'Task saved', body: task.title });
        onSaved();
        onClose();
      },
    }
  );
  const busy = status === 'saving';
  const reportedConflict = useRef<unknown>(null);
  React.useEffect(() => {
    if (conflict && reportedConflict.current !== conflict) {
      reportedConflict.current = conflict;
      onConflict();
    }
  }, [conflict, onConflict]);
  const err = (k: string) => local[k] ?? fieldMessage(fieldErrors, k);

  // Owner choices: the project's developers plus the current owner, so an existing owner is never dropped.
  const ownerOptions = [
    ...project.developers.map((d) => ({ value: d.id, label: d.fullName })),
    ...(task.ownerId && !project.developers.some((d) => d.id === task.ownerId) ? [{ value: task.ownerId, label: task.ownerName ?? 'Current owner' }] : []),
  ];
  const statusOptions: TaskStatus[] = [base.current.status, ...base.current.allowedNextStatuses.filter((s) => s !== 'cancelled' && s !== base.current.status)];
  const overdueDays =
    draft.status !== 'done' && draft.status !== 'cancelled' && draft.dueDate && draft.dueDate < todayInput()
      ? Math.max(1, Math.round((Date.parse(todayInput()) - Date.parse(draft.dueDate)) / 86_400_000))
      : 0;
  const locked = readOnly || task.status === 'cancelled';
  const ownerName = ownerOptions.find((o) => o.value === draft.ownerId)?.label;

  function submit() {
    const next: Record<string, string> = {};
    if (!draft.title.trim()) next.title = 'Add a task title.';
    if (draft.description.length > DESCRIPTION_MAX) next.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
    setLocal(next);
    if (Object.keys(next).length === 0) void save(draft, baseTask.version); // the version the user started from (B-05), not the live polled one
  }

  return (
    <Drawer
      isOpen
      onClose={busy ? () => undefined : onClose}
      title={task.title}
      subtitle={`Task · ${project.code} · ${project.businessName ?? project.name} — ${project.name}`}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {!locked && task.allowedNextStatuses.includes('cancelled') ? (
            <Button variant="ghost" onClick={() => onCancelTask(task)} disabled={busy}>
              Cancel task…
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Close
            </Button>
            {!locked && (
              <Button onClick={submit} isLoading={busy} disabled={busy}>
                {conflict ? 'Save again' : 'Save changes'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {locked && (
          <Alert
            tone="info"
            title={readOnly ? 'This project is Completed' : 'This task is cancelled'}
            body={readOnly ? 'Tasks can no longer be changed.' : task.cancelReason ? `Reason: ${task.cancelReason}` : 'Cancelled tasks cannot be edited.'}
          />
        )}

        {conflict && (
          <Alert
            tone="warning"
            title="Someone else changed this task"
            body="The latest version is loaded. Your edits are still here: Save again applies them on top, or close to discard them."
          />
        )}

        <Input label="Title" required value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={200} disabled={locked} error={err('title')} />

        <Select
          label="Task status"
          value={draft.status}
          onChange={(e) => set('status', e.target.value as TaskStatus)}
          disabled={locked}
          options={statusOptions.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
          helperText={`Changes the task status only. Project status stays ${PROJECT_STATUS_LABEL[project.status]}.`}
          error={err('status')}
        />

        <div className="flex flex-wrap items-center gap-2">
          {draft.clientDependency && <ClientDependencyChip />}
          {overdueDays > 0 && (
            <Badge tone="warning" derived>
              Overdue {overdueDays} day{overdueDays === 1 ? '' : 's'}
            </Badge>
          )}
          <span className="text-[13px] leading-[18px] text-text-secondary">
            {draft.clientDependency ? 'Client content pending — not a task status.' : overdueDays > 0 ? 'Derived: due date passed, not Done.' : 'No client dependency.'}
          </span>
        </div>

        <Select
          label="Owner"
          placeholder="Unassigned"
          value={draft.ownerId}
          onChange={(e) => set('ownerId', e.target.value)}
          disabled={locked}
          options={ownerOptions}
          error={err('ownerId')}
          helperText={ownerOptions.length === 0 ? 'No developer is assigned to this project yet.' : undefined}
        />
        {ownerName && (
          <div className="-mt-2 flex items-center gap-2 text-[13px] text-text-secondary">
            <Avatar name={ownerName} size="sm" tone="brand" />
            {ownerName}
          </div>
        )}

        <DateInput label="Due date" value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} disabled={locked} error={err('dueDate')} />

        <Textarea
          label="Description"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          disabled={locked}
          rows={4}
          counter={`${draft.description.length} / ${DESCRIPTION_MAX}`}
          error={err('description')}
        />

        <Checkbox
          label="Waiting on the client (shows the Client dependency chip)"
          checked={draft.clientDependency}
          disabled={locked}
          onChange={(e) => set('clientDependency', e.target.checked)}
        />
        {draft.clientDependency && (
          <Textarea
            label="Dependency note"
            value={draft.clientDependencyNote}
            onChange={(e) => set('clientDependencyNote', e.target.value)}
            disabled={locked}
            rows={2}
            helperText="What are we waiting for?"
            error={err('clientDependencyNote')}
          />
        )}
        {draft.clientDependency && !locked && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              set('clientDependency', false);
              set('clientDependencyNote', '');
            }}
          >
            Mark dependency resolved
          </Button>
        )}

        <ActionError route={conflict ? null : route} error={conflict ? null : error} onRetry={() => void retry()} />
      </div>
    </Drawer>
  );
}
