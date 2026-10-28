'use client';

import React, { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { Skeleton, StateView } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import { employeesListKey } from '@/lib/api/employees';
import type { DashboardMetrics } from '@/lib/api/reports';
import {
  createTarget,
  createWorkItem,
  updateTarget,
  updateWorkItem,
  workPaths,
  type TargetItem,
  type WorkItem,
} from '@/lib/api/work';
import { useApi } from '@/lib/hooks/useApi';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';
import { periodEnd } from '@/lib/period';
import type { Page } from '@/lib/api/types';
import type { EmployeeRow } from '@/lib/api/employees';

type Period = TargetItem['period'];

const METRIC_OPTIONS = [
  { value: 'outreach_calls', label: 'Outreach calls' },
  { value: 'businesses_contacted', label: 'Businesses contacted' },
  { value: 'closed_deals', label: 'Closed deals' },
  { value: 'data_entries', label: 'Data entries' },
];
const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];
const metricLabel = (m: string) => METRIC_OPTIONS.find((o) => o.value === m)?.label ?? m.replace(/_/g, ' ');
const periodLabel = (p: string) => PERIOD_OPTIONS.find((o) => o.value === p)?.label ?? p;
const dashboardPeriodLabel = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom range' } as const;

function errText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const first = Object.values(err.fieldErrors)[0]?.[0];
    return first ?? err.message;
  }
  return fallback;
}

type Progress = { current: number; target: number; percentage: number } | undefined;

function QuotaCard({ title, p, tone }: { title: string; p: Progress; tone: 'brand' | 'success' | 'info' }) {
  const has = Boolean(p && p.target > 0);
  const pct = has && p ? Math.max(0, Math.min(100, p.percentage)) : 0;
  const bar = { brand: 'bg-brand-accent', success: 'bg-status-success-solid', info: 'bg-status-info-solid' }[tone];
  return (
    <Card className="p-5 space-y-3">
      <span className="text-xs font-semibold text-text-secondary">{title}</span>
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold text-text-primary tabular-nums">
          {has && p ? p.current : '—'}
          {has && p && <span className="text-sm font-normal text-text-muted"> / {p.target}</span>}
        </span>
        <span className="text-xs font-semibold text-text-secondary tabular-nums">{has ? `${Math.round(pct)}%` : 'No target set'}</span>
      </div>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={has ? Math.round(pct) : undefined}
        className="w-full bg-surface-sunken rounded-full h-2 overflow-hidden"
      >
        <div className={`${bar} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

export default function TargetsPage() {
  const toast = useToast();
  const time = useCompanyTime();

  const targets = useApi<Page<TargetItem>>(workPaths.targets, { refreshInterval: 0 });
  const workItems = useApi<Page<WorkItem>>(workPaths.workItems, { refreshInterval: 0 });
  const metrics = useApi<DashboardMetrics>('/api/dashboard?period=30d', { refreshInterval: 60_000 });
  const peopleQuery = { pageSize: 100 };
  const people = useApi<Page<EmployeeRow>>(employeesListKey(peopleQuery), { refreshInterval: 0 });
  const employees = useMemo(() => people.data?.items.filter((e) => e.isActive) ?? [], [people.data]);
  const employeeOptions = employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.role.replace(/_/g, ' ')})` }));

  // Target dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TargetItem | null>(null);
  const [territory, setTerritory] = useState('');
  const [metric, setMetric] = useState('outreach_calls');
  const [period, setPeriod] = useState<Period>('monthly');
  const [targetValue, setTargetValue] = useState('50');
  const [employeeId, setEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Work item dialog + filter
  const [workOpen, setWorkOpen] = useState(false);
  const [workFilter, setWorkFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openTargetDialog = (target?: TargetItem) => {
    setEditing(target ?? null);
    setTerritory(target?.territory ?? '');
    setMetric(target?.metric ?? 'outreach_calls');
    setPeriod(target?.period ?? 'monthly');
    setTargetValue(String(target?.targetValue ?? 50));
    setEmployeeId(target?.employeeId ?? employees[0]?.id ?? '');
    setFormError(null);
    setDialogOpen(true);
  };

  const parsedTarget = Number(targetValue);
  const targetValid = Number.isFinite(parsedTarget) && parsedTarget > 0;
  const canSaveTarget = targetValid && (editing !== null || Boolean(employeeId)) && !saving;

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveTarget) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateTarget(editing.id, { version: editing.version, targetValue: parsedTarget, period, territory: territory.trim() || undefined });
      } else {
        const start = time.dayKey(new Date());
        await createTarget({
          employeeId,
          metric,
          period,
          targetValue: parsedTarget,
          startDate: start,
          endDate: periodEnd(start, period),
          territory: territory.trim() || undefined,
        });
      }
      await targets.mutate();
      setDialogOpen(false);
      toast.show({ tone: 'success', title: editing ? 'Target updated' : 'Target allocated' });
    } catch (err) {
      if (err instanceof ApiError && err.isVersionConflict) {
        await targets.mutate();
        setFormError('Someone else changed this target. The latest values are loaded; close and reopen to review them.');
      } else {
        setFormError(errText(err, 'Could not save the target. Try again.'));
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleWorkItem(item: WorkItem) {
    const next: 'completed' | 'open' = item.status === 'completed' ? 'open' : 'completed';
    setTogglingId(item.id);
    try {
      await updateWorkItem(item.id, { version: item.version, status: next });
    } catch (err) {
      toast.show({ tone: 'error', title: 'Could not update the task', body: errText(err, 'Try again.') });
    } finally {
      await workItems.mutate();
      setTogglingId(null);
    }
  }

  async function saveWorkItem(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setTaskError('Task title is required');
      return;
    }
    if (!taskAssigneeId) {
      setTaskError('Choose an assignee');
      return;
    }
    setSavingTask(true);
    setTaskError(null);
    try {
      await createWorkItem({
        assigneeId: taskAssigneeId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        dueDate: taskDueDate ? new Date(`${taskDueDate}T12:00:00Z`).toISOString() : undefined,
      });
      await workItems.mutate();
      setWorkOpen(false);
      toast.show({ tone: 'success', title: 'Task created' });
    } catch (err) {
      setTaskError(errText(err, 'Could not create the task. Try again.'));
    } finally {
      setSavingTask(false);
    }
  }

  const allWork = workItems.data?.items ?? [];
  const filteredWork = allWork.filter((i) =>
    workFilter === 'open' ? i.status !== 'completed' && i.status !== 'cancelled' : workFilter === 'completed' ? i.status === 'completed' : true
  );
  const openCount = allWork.filter((i) => i.status !== 'completed' && i.status !== 'cancelled').length;
  const doneCount = allWork.filter((i) => i.status === 'completed').length;
  const m = metrics.data;

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text-primary">Targets & Work Lists</h1>
            <p className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-2">
              Quotas, territories and employee task checklists
              <PolicyPendingChip dec="DEC-020" />
              <PolicyPendingChip dec="DEC-025" />
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              leadingIcon={<Icon name="plus" size={16} />}
              disabled={!people.data}
              onClick={() => {
                setTaskTitle('');
                setTaskDescription('');
                setTaskDueDate('');
                setTaskAssigneeId(employees[0]?.id ?? '');
                setTaskError(null);
                setWorkOpen(true);
              }}
            >
              Add work item
            </Button>
            <Button leadingIcon={<Icon name="plus" size={16} />} disabled={!people.data} onClick={() => openTargetDialog()}>
              Allocate target
            </Button>
          </div>
        </div>

        {people.error && (
          <Alert tone="warning" title="Employees could not be loaded" body="Allocating targets and tasks needs the employee list." />
        )}

        <section aria-label="Company progress" className="space-y-2">
          <p className="text-xs text-text-muted">
            Company progress · {m ? dashboardPeriodLabel[m.period] : 'loading'}
          </p>
          {metrics.error && !m ? (
            <ApiErrorView error={metrics.error} route={metrics.route} onRetry={() => void metrics.retry()} size="inline" what="company progress" area="Targets" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {!m ? (
                [0, 1, 2].map((i) => <Skeleton key={i} className="h-[124px] rounded-xl" />)
              ) : (
                <>
                  <QuotaCard title="Outreach calls" p={m.targets?.outreachProgress} tone="brand" />
                  <QuotaCard title="Closed deals" p={m.targets?.closedDealsProgress} tone="success" />
                  <QuotaCard title="Businesses contacted" p={m.targets?.contactedBusinessesProgress} tone="info" />
                </>
              )}
            </div>
          )}
        </section>

        <Card className="overflow-hidden shadow-xs border border-border-default">
          <div className="p-4 border-b border-border-subtle bg-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-text-primary">Employee work list</h2>
                <Badge tone={openCount > 0 ? 'brand' : 'success'}>{openCount} open</Badge>
                {doneCount > 0 && <Badge tone="neutral">{doneCount} done</Badge>}
              </div>
              <p className="text-xs text-text-muted mt-0.5">Tasks assigned to team members. They check tasks off as they finish.</p>
            </div>
            <div role="group" aria-label="Filter tasks" className="inline-flex items-center p-0.5 bg-surface-sunken rounded-lg border border-border-subtle text-xs">
              {([
                ['all', `All (${allWork.length})`],
                ['open', `Pending (${openCount})`],
                ['completed', `Completed (${doneCount})`],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={workFilter === id}
                  onClick={() => setWorkFilter(id)}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    workFilter === id ? 'bg-surface-default text-text-primary shadow-xs' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {workItems.error && !workItems.data ? (
            <ApiErrorView error={workItems.error} route={workItems.route} onRetry={() => void workItems.retry()} size="inline" what="the work list" area="Targets & Work Lists" />
          ) : !workItems.data ? (
            <div role="status" aria-label="Loading work list" className="p-4 space-y-3">
              <Skeleton className="h-10 rounded-md" />
              <Skeleton className="h-10 rounded-md" />
            </div>
          ) : filteredWork.length === 0 ? (
            <StateView
              type="empty"
              size="inline"
              title={workFilter === 'all' ? 'No work items yet' : workFilter === 'open' ? 'No pending work items' : 'No completed work items'}
              body={workFilter === 'all' ? 'Create a task for a team member with Add work item.' : 'Switch the filter or create a new task.'}
              className="mx-auto"
            />
          ) : (
            <ul className="divide-y divide-border-subtle text-xs">
              {filteredWork.map((item) => {
                const done = item.status === 'completed';
                const who = item.assigneeName || employees.find((e) => e.id === item.assigneeId)?.fullName || 'Assigned member';
                return (
                  <li key={item.id} className="p-4 flex items-start sm:items-center justify-between gap-3.5">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`${item.title}: ${done ? 'completed' : 'open'}`}
                        disabled={togglingId === item.id}
                        onClick={() => void toggleWorkItem(item)}
                        className={`mt-0.5 sm:mt-0 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                          done ? 'bg-status-success-solid border-status-success-solid text-text-on-primary' : 'border-border-strong bg-surface-default text-transparent'
                        }`}
                      >
                        <Icon name="check" size={13} className={done ? 'opacity-100' : 'opacity-0'} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-medium ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>{item.title}</span>
                          <Badge tone={done ? 'success' : item.status === 'in_progress' ? 'brand' : 'neutral'}>
                            {done ? 'Completed' : item.status === 'in_progress' ? 'In progress' : item.status === 'cancelled' ? 'Cancelled' : 'Open'}
                          </Badge>
                        </div>
                        {item.description && <p className={`text-xs mt-1 ${done ? 'text-text-muted' : 'text-text-secondary'}`}>{item.description}</p>}
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-text-muted">
                          <span className="inline-flex items-center gap-1 text-text-secondary">
                            <Icon name="user" size={12} className="text-icon-muted" />
                            {who}
                          </span>
                          {item.dueDate && (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="calendar" size={12} className="text-icon-muted" />
                              Due {time.formatDate(item.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant={done ? 'secondary' : 'primary'} size="sm" onClick={() => void toggleWorkItem(item)} disabled={togglingId === item.id}>
                      {done ? 'Reopen' : 'Mark complete'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border-subtle bg-surface-subtle flex items-center justify-between text-xs">
            <h2 className="font-semibold text-text-primary">Targets & territories</h2>
            <span className="text-text-muted">{targets.data ? `${targets.data.total} configured` : ''}</span>
          </div>
          {targets.error && !targets.data ? (
            <ApiErrorView error={targets.error} route={targets.route} onRetry={() => void targets.retry()} size="inline" what="targets" area="Targets & Work Lists" />
          ) : !targets.data ? (
            <div role="status" aria-label="Loading targets" className="p-4 space-y-3">
              <Skeleton className="h-10 rounded-md" />
              <Skeleton className="h-10 rounded-md" />
            </div>
          ) : targets.data.items.length === 0 ? (
            <StateView type="empty" size="inline" title="No targets yet" body="Allocate a target to give an employee a quota and a territory." className="mx-auto" />
          ) : (
            <ul className="divide-y divide-border-subtle text-xs">
              {targets.data.items.map((t) => {
                const pct = t.targetValue > 0 ? Math.min(100, Math.round((t.currentValue / t.targetValue) * 100)) : null;
                return (
                  <li key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm text-text-primary">{t.territory || metricLabel(t.metric)}</div>
                      <div className="text-text-secondary mt-0.5">
                        {t.employeeName ? `${t.employeeName} · ` : ''}
                        {metricLabel(t.metric)} · {periodLabel(t.period)} · {t.currentValue} of {t.targetValue}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {pct !== null && <span className="text-[11px] text-text-secondary font-medium tabular-nums">{pct}%</span>}
                      <Button variant="secondary" size="sm" onClick={() => openTargetDialog(t)}>
                        Update
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Update target' : 'Allocate target'}
        description={editing ? 'Change the quota, period or territory. Metric and assignee stay as created.' : 'Give an employee a quota and, optionally, a territory.'}
      >
        <form onSubmit={saveTarget} className="space-y-4 text-sm">
          {formError && <Alert tone="danger" title="Could not save" body={formError} role="alert" />}
          <Input label="Territory (optional)" value={territory} maxLength={120} onChange={(e) => setTerritory(e.target.value)} placeholder="e.g. Beirut Central" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Metric" value={metric} onChange={(e) => setMetric(e.target.value)} options={METRIC_OPTIONS} disabled={editing !== null} />
            <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} options={PERIOD_OPTIONS} />
          </div>
          <Input
            label="Target quota"
            type="number"
            min={1}
            required
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            error={targetValue !== '' && !targetValid ? 'Enter a number above zero' : undefined}
          />
          {editing ? (
            <p className="text-xs text-text-secondary">Assignee: {editing.employeeName ?? employees.find((e) => e.id === editing.employeeId)?.fullName ?? 'Assigned employee'}</p>
          ) : (
            <Select label="Assignee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} options={employeeOptions} placeholder="Choose an employee" required />
          )}
          <div className="pt-3 flex justify-end gap-2 border-t border-border-subtle">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSaveTarget} isLoading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={workOpen} onClose={() => setWorkOpen(false)} title="Add work item" description="Create a task and assign it to an employee.">
        <form onSubmit={saveWorkItem} className="space-y-4 text-sm">
          {taskError && <Alert tone="danger" title="Could not save" body={taskError} role="alert" />}
          <Input label="Task title" required value={taskTitle} maxLength={200} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Call 20 hospitality leads" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Assignee" value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)} options={employeeOptions} placeholder="Choose an employee" required />
            <Input label="Due date (optional)" type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
          </div>
          <Textarea label="Notes (optional)" rows={3} maxLength={2000} value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} />
          <div className="pt-3 flex justify-end gap-2 border-t border-border-subtle">
            <Button variant="secondary" type="button" onClick={() => setWorkOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={savingTask} disabled={savingTask}>
              Create work item
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
