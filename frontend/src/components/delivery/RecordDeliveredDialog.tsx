'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import type { Project, OpenTasksWarning } from '@/lib/api/projects';
import type { ApiError } from '@/lib/api';
import type { ErrorRoute } from '@/lib/errorRouting';
import { ActionError, ClientDependencyChip, PROJECT_STATUS_LABEL, TaskStatusBadge } from './shared';

/**
 * "Record delivered with open tasks?" (SCR-DEV-006 warning state), shown for the 422 `OPEN_TASKS_WARNING`
 * the server returned. Warning only (OQ-10, Proposed): confirming resends the move with
 * `acknowledgeOpenTasks: true`; only the project changes, the tasks keep their statuses.
 * Cancel and "Review open tasks" make no call.
 */
export function RecordDeliveredDialog({
  project,
  warning,
  busy,
  route,
  error,
  onCancel,
  onReview,
  onConfirm,
}: {
  project: Project;
  warning: OpenTasksWarning;
  busy: boolean;
  route: ErrorRoute | null;
  error: ApiError | null;
  onCancel: () => void;
  onReview: () => void;
  onConfirm: () => void;
}) {
  const verb = warning.to === 'completed' ? 'completed' : 'delivered';
  const n = warning.openTaskCount;
  return (
    <Dialog
      isOpen
      onClose={busy ? () => undefined : onCancel}
      title={`Record ${verb} with open tasks?`}
      description={`${project.name} · ${project.code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} isLoading={busy} disabled={busy}>
            Record {verb}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div role="alert" className="flex items-start gap-2.5 p-3 rounded-lg border bg-status-warning-bg border-status-warning-border text-status-warning-fg">
          <Icon name="alert-triangle" size={18} className="shrink-0 mt-0.5" />
          <p className="text-[13px] leading-[18px]">
            {n} task{n === 1 ? ' is' : 's are'} not Done or Cancelled. Recording {PROJECT_STATUS_LABEL[warning.to]} changes the project status only — the tasks stay as they are.
          </p>
        </div>

        <ul className="space-y-2">
          {warning.openTasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <TaskStatusBadge status={t.status} />
                <span className="font-medium text-text-primary truncate">{t.title}</span>
              </span>
              {t.clientDependency && <ClientDependencyChip />}
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-[110px_1fr] gap-y-2">
          <dt className="text-text-secondary">Project status</dt>
          <dd className="text-text-primary">
            {PROJECT_STATUS_LABEL[warning.from]} → {PROJECT_STATUS_LABEL[warning.to]}
          </dd>
        </dl>

        <p className="text-[13px] leading-[18px] text-text-muted">
          Warning only: you can still record {PROJECT_STATUS_LABEL[warning.to]}. {warning.to === 'delivered' ? 'Completed is recorded later, from Delivered.' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onReview} className="text-[13px] font-medium text-text-link hover:underline cursor-pointer">
            Review open tasks
          </button>
        </div>
        <ActionError route={route} error={error} />
      </div>
    </Dialog>
  );
}
