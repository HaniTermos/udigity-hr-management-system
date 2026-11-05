'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { useCapability } from '@/lib/hooks/useCapability';
import { ACTIONS } from '@/lib/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { SkeletonCard, SkeletonTableRow, StateView } from '@/components/ui/State';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/hooks/useApi';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import {
  createProject,
  projectListPath,
  retryProvisioning,
  type Project,
  type ProjectList,
  type ProjectStatus,
  type ProvisionRetryResult,
  type UnprovisionedDeal } from '@/lib/api/projects';
import { ActionError, AssignedChip, fmtDate, LoadError, OverdueChip, PageTitle, PersonCell, ProjectStatusBadge, PROJECT_STATUS_OPTION_LABEL } from './shared';

const STATUS_OPTIONS = [
  { value: 'any', label: 'Status: Any' },
  ...(Object.keys(PROJECT_STATUS_OPTION_LABEL) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS_OPTION_LABEL[s] })),
];
const SCOPE_OPTIONS = [
  { value: 'all', label: 'All eligible projects' },
  { value: 'assigned_to_me', label: 'Assigned to me' },
];

function Metric({ label, value, hint, sub }: { label: string; value: React.ReactNode; hint: string; sub: string }) {
  return (
    <Card className="p-5 space-y-1">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="text-3xl font-semibold text-text-primary tabular-nums">{value}</p>
      <p className="text-[13px] text-text-secondary">{hint}</p>
      <p className="text-[13px] text-text-muted">{sub}</p>
    </Card>
  );
}

export function ProjectsList() {
  const [status, setStatus] = useState<ProjectStatus | 'any'>('any');
  const [scope, setScope] = useState<'all' | 'assigned_to_me'>('all');
  const [overdue, setOverdue] = useState(false);

  const path = projectListPath({
    status: status === 'any' ? undefined : status,
    scope,
    overdueOnly: overdue,
    pageSize: 100,
    sort: 'targetDate',
    order: 'asc',
  });
  const { data, error, isLoading, retry } = useApi<ProjectList>(path, { keepPreviousData: true });
  const filtered = status !== 'any' || scope !== 'all' || overdue;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <PageTitle
        title="Projects"
        description="Delivery of closed deals. Project status is separate from task status; a closed deal is not a completed project."
      />

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric
            label="Development workload"
            value={`${data.workload.activeProjects} · ${data.workload.openTasks}`}
            hint="Active projects and their open tasks"
            sub="Active projects · Open tasks"
          />
          <Metric label="Active projects" value={data.workload.activeProjects} hint="No change" sub="Company-wide eligible" />
          <Metric label="Delivery overdue" value={data.workload.deliveryOverdue} hint="Target date passed, not delivered" sub="" />
          <Metric label="Completed this month" value={data.workload.completedThisMonth} hint="Completed projects" sub="This calendar month" />
        </div>
      )}
      {isLoading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {data && data.unprovisioned.length > 0 && (
        <Unprovisioned items={data.unprovisioned} autoProvision={data.policy.autoProvision} onChanged={() => void retry()} />
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Select aria-label="Project status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | 'any')} wrapperClassName="sm:w-48" />
        <Select aria-label="Scope" options={SCOPE_OPTIONS} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} wrapperClassName="sm:w-52" />
        <Select
          aria-label="Delivery overdue"
          options={[
            { value: 'all', label: 'Delivery: Any' },
            { value: 'overdue', label: 'Delivery overdue' },
          ]}
          value={overdue ? 'overdue' : 'all'}
          onChange={(e) => setOverdue(e.target.value === 'overdue')}
          wrapperClassName="sm:w-44"
        />
        <span className="sm:ml-auto text-xs text-text-muted">Sorted by target delivery date</span>
      </div>

      {error ? (
        <LoadError error={error} onRetry={() => void retry()} backHref="/deals" backLabel="Back to Deals" what="projects" />
      ) : isLoading && !data ? (
        <TableContainer aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonTableRow key={i} />
          ))}
        </TableContainer>
      ) : data && data.items.length === 0 ? (
        <StateView
          type={filtered ? 'no-results' : 'empty'}
          title={filtered ? 'No projects match' : 'No projects yet'}
          body={filtered ? 'Try a different filter.' : 'Projects appear here after a deal is closed and provisioned.'}
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR interactive={false}>
                <TH>Project</TH>
                <TH>Project status</TH>
                <TH>Developer</TH>
                <TH>Target date</TH>
                <TH align="right">Tasks</TH>
                <TH>Conditions</TH>
                <TH aria-label="Actions" />
              </TR>
            </THead>
            <TBody>
              {data?.items.map((p) => (
                <ProjectTableRow key={p.id} p={p} />
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}

      <p className="text-xs text-text-muted">A closed deal is not a completed project. Rows you cannot access are omitted and not counted.</p>
    </div>
  );
}

/** Closed deals without a project (derived). F3 failure offers the Owner retry; manual F2 offers Create project. */
function Unprovisioned({ items, autoProvision, onChanged }: { items: UnprovisionedDeal[]; autoProvision: boolean; onChanged: () => void }) {
  const toast = useToast();
  const isOwner = useCapability(ACTIONS.projectProvisionRetry);
  const [busyId, setBusyId] = useState<string | null>(null);

  const retrySave = useVersionedSave<string, ProvisionRetryResult>((dealId) => retryProvisioning(dealId), {
    onSaved: (r) => {
      toast.show(
        r.provisioning.state === 'provisioned'
          ? { tone: 'success', title: 'Project created' }
          : { tone: 'error', title: 'Provisioning failed again', body: `Attempt ${r.provisioning.attempts}.` }
      );
      onChanged();
    },
  });
  const createSave = useVersionedSave<string, Project>((dealId, ctx) => createProject({ dealId }, ctx.idempotencyKey), {
    onSaved: () => {
      toast.show({ tone: 'success', title: 'Project created' });
      onChanged();
    },
  });
  const failed = items.some((i) => i.provisioning === 'failed');

  return (
    <div className="space-y-2">
      <Alert
        tone={failed ? 'danger' : 'info'}
        title={`${items.length} closed deal${items.length === 1 ? ' has' : 's have'} no project yet`}
        body={
          failed
            ? 'Provisioning failed for at least one deal. Closures stand; it retries automatically and the Owner can retry now.'
            : autoProvision
              ? 'Projects are created automatically after closure.'
              : 'Projects are created manually.'
        }
      />
      <Card className="divide-y divide-border-subtle">
        {items.map((d) => (
          <div key={d.dealId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <Link href={`/deals/${d.dealId}`} className="font-medium text-text-link hover:underline">
                {d.businessName ?? d.dealCode}
              </Link>
              <p className="text-[13px] text-text-muted">
                {d.dealCode} · closed {fmtDate(d.closedAt)} ·{' '}
                {d.provisioning === 'failed' ? `project setup failed (attempt ${d.attempts})` : 'Project setup pending'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {d.provisioning === 'failed' && isOwner && (
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={busyId === d.dealId && retrySave.status === 'saving'}
                  onClick={() => {
                    setBusyId(d.dealId);
                    void retrySave.save(d.dealId, 1);
                  }}
                >
                  Retry provisioning
                </Button>
              )}
              {!autoProvision && (
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={busyId === d.dealId && createSave.status === 'saving'}
                  onClick={() => {
                    setBusyId(d.dealId);
                    void createSave.save(d.dealId, 1);
                  }}
                >
                  Create project
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
      <ActionError route={retrySave.route ?? createSave.route} error={retrySave.error ?? createSave.error} />
    </div>
  );
}

function ProjectTableRow({ p }: { p: Project }) {
  const done = p.taskCounts.done + p.taskCounts.cancelled;
  return (
    <TR>
      <TD meta={`${p.code} · ${p.dealCode ?? ''}${p.businessName ? ` · ${p.businessName}` : ''}`} className="max-w-[280px]">
        <Link href={`/projects/${p.id}`} className="block truncate hover:underline">
          {p.name}
        </Link>
      </TD>
      <TD>
        <ProjectStatusBadge status={p.status} />
      </TD>
      <TD>
        <PersonCell name={p.developers.length ? p.developers.map((d) => d.fullName).join(', ') : null} />
      </TD>
      <TD>{fmtDate(p.targetDate)}</TD>
      <TD numeric>
        {done} of {p.taskCounts.total} done
      </TD>
      <TD>
        <div className="flex flex-col items-start gap-1">
          {p.assignedToMe && <AssignedChip />}
          {p.deliveryOverdue && <OverdueChip />}
          {p.statusNote && <span className="text-[13px] text-text-muted">{p.statusNote}</span>}
        </div>
      </TD>
      <TD>
        <Link href={`/projects/${p.id}`} className="text-sm font-medium text-text-link hover:underline whitespace-nowrap">
          Open board
        </Link>
      </TD>
    </TR>
  );
}
