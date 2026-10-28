'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ApiErrorView } from '@/components/states';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, DerivedChip, OutcomeBadge, type OutcomeType } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Checkbox, Select } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { SkeletonTableRow, StateView } from '@/components/ui/State';
import { Pagination, Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import {
  assignBusinesses,
  assignmentsListKey,
  autofillAgent,
  listAssignments,
  type AssignmentListItem,
  type AssignmentListQuery,
  type AssignmentStatusFilter,
  type AutofillResultDto,
  type SkippedItem,
} from '@/lib/api/assignments';
import { ApiError } from '@/lib/api/client';
import { employeesListKey, listEmployees } from '@/lib/api/employees';
import { classifyError } from '@/lib/errorRouting';
import { formatDayTime, useCompanyTimezone } from './format';
import { ReassignImpactDialog, type AgentOption } from './ReassignImpactDialog';

const OUTCOME_LABEL: Record<string, OutcomeType> = {
  pending: 'Pending',
  on_hold: 'On hold',
  needs_another_call: 'Needs another call',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const SKIP_LABEL: Record<string, string> = {
  no_phone: 'no phone number',
  do_not_call: 'do not call',
  archived: 'archived',
  open_deal: 'open deal',
  already_assigned: 'already assigned',
  not_found: 'not found',
};

const PAGE_SIZE = 25;

interface DialogTarget {
  mode: 'reassign' | 'unassign';
  queue: string[];
  total: number;
}

export function CallingAssignments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AssignmentStatusFilter | ''>('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [sort, setSort] = useState<NonNullable<AssignmentListQuery['sort']>>('startedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [busy, setBusy] = useState<'assign' | 'autofill' | null>(null);
  const [result, setResult] = useState<{ title: string; skipped: SkippedItem[]; tone: 'success' | 'warning' } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  /** Businesses seen with a live reservation (preview or a 409): the list itself carries no reservation field. */
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const timeZone = useCompanyTimezone();
  const toast = useToast();

  const query: AssignmentListQuery = { page, pageSize: PAGE_SIZE, sort, order, status, assigneeId: filterAssignee };
  const listKey = assignmentsListKey(query);
  const { data, error, isLoading, mutate } = useSWR(listKey, () => listAssignments(query), { keepPreviousData: true });
  const unassignedCount = useSWR(assignmentsListKey({ page: 1, pageSize: 1, status: 'unassigned' }), () =>
    listAssignments({ page: 1, pageSize: 1, status: 'unassigned' })
  );

  const agentQuery = { role: 'call_center', status: 'active', pageSize: 100 } as const;
  const agentsData = useSWR(employeesListKey(agentQuery), () => listEmployees(agentQuery), { revalidateOnFocus: false });
  const agents: AgentOption[] = useMemo(
    () => (agentsData.data?.items ?? []).map((e) => ({ id: e.id, name: e.fullName })),
    [agentsData.data]
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const byId = useMemo(() => new Map(items.map((i) => [i.businessId, i])), [items]);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(status || filterAssignee);
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.businessId));
  const selectedItems = [...selected].map((id) => byId.get(id)).filter((i): i is AssignmentListItem => Boolean(i));
  const selectedAssigned = selectedItems.filter((i) => i.assignment);
  const dialogRow = dialog ? byId.get(dialog.queue[0]) ?? null : null;

  const refresh = () => {
    void mutate();
    void unassignedCount.mutate();
  };

  function toggleSort(key: NonNullable<AssignmentListQuery['sort']>) {
    if (sort === key) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder('asc');
    }
    setPage(1);
  }
  const sortDir = (key: string) => (sort === key ? (order === 'asc' ? 'ascending' : 'descending') : 'none');

  function reportFailure(e: unknown) {
    const route = classifyError(e);
    setActionError(
      route.kind === 'offline'
        ? 'You are offline. Nothing was saved.'
        : route.kind === 'permission-denied' || route.kind === 'owner-2fa-required'
          ? 'Assigning needs an Owner session with two-factor verification.'
          : e instanceof ApiError && e.status < 500
            ? e.message
            : 'Could not save. Nothing was changed. Try again.'
    );
  }

  async function runAssign() {
    if (!bulkAssignee || selected.size === 0) return;
    setBusy('assign');
    setActionError(null);
    setResult(null);
    try {
      const res = await assignBusinesses({ businessIds: [...selected], assigneeId: bulkAssignee });
      const name = agents.find((a) => a.id === bulkAssignee)?.name ?? 'the agent';
      setResult({
        title: `${res.assigned.length} assigned to ${name}${res.skipped.length ? ` · ${res.skipped.length} skipped` : ''}`,
        skipped: res.skipped,
        tone: res.skipped.length ? 'warning' : 'success',
      });
      if (res.assigned.length) toast.show({ tone: 'success', title: `${res.assigned.length} assigned to ${name}` });
      setSelected(new Set());
      refresh();
    } catch (e) {
      reportFailure(e);
    } finally {
      setBusy(null);
    }
  }

  async function runAutofill() {
    if (!bulkAssignee) return;
    setBusy('autofill');
    setActionError(null);
    setResult(null);
    try {
      const res: AutofillResultDto = await autofillAgent({ agentId: bulkAssignee });
      const name = agents.find((a) => a.id === bulkAssignee)?.name ?? 'the agent';
      const atCap = res.alreadyToday + res.assigned.length >= res.cap;
      setResult({
        title: `${res.assigned.length} assigned to ${name} automatically · ${res.alreadyToday + res.assigned.length} of ${res.cap} today${atCap ? ' (daily cap reached)' : ''}`,
        skipped: res.skipped,
        tone: res.assigned.length === 0 || res.skipped.length ? 'warning' : 'success',
      });
      refresh();
    } catch (e) {
      reportFailure(e);
    } finally {
      setBusy(null);
    }
  }

  function openUnassign() {
    const ids = selectedAssigned.map((i) => i.businessId);
    if (ids.length) setDialog({ mode: 'unassign', queue: ids, total: ids.length });
  }

  const denied = error instanceof ApiError && (error.isPermissionDenied || error.code === 'OWNER_2FA_REQUIRED');
  const summary = data
    ? `${data.total} ${filtered ? 'matching ' : ''}${data.total === 1 ? 'business' : 'businesses'}${
        unassignedCount.data ? ` · ${unassignedCount.data.total} unassigned` : ''
      }`
    : 'Loading assignments';

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Calling assignments</h1>
          <p className="text-[13px] text-text-secondary mt-1">{summary} · Owner only</p>
        </div>
        <Link
          href="/queue"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-sm font-medium bg-surface-default text-text-primary border border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Icon name="phone" size={16} />
          Open agent queue
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <Select
          aria-label="Filter by assignment status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AssignmentStatusFilter | '');
            setPage(1);
          }}
          placeholder="All businesses"
          options={[
            { value: 'assigned', label: 'Assigned' },
            { value: 'unassigned', label: `Unassigned${unassignedCount.data ? ` · ${unassignedCount.data.total}` : ''}` },
            { value: 'inaccessible', label: 'Needs decision (inactive assignee)' },
          ]}
          wrapperClassName="sm:w-64"
        />
        <Select
          aria-label="Filter by assignee"
          value={filterAssignee}
          onChange={(e) => {
            setFilterAssignee(e.target.value);
            setPage(1);
          }}
          placeholder="All assignees"
          options={agents.map((a) => ({ value: a.id, label: a.name }))}
          wrapperClassName="sm:w-56"
        />
        {filtered && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setStatus('');
              setFilterAssignee('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 rounded-xl border border-border-default bg-surface-subtle p-3" role="region" aria-label="Bulk assignment">
        <span className="text-sm font-semibold text-text-primary tabular-nums shrink-0" aria-live="polite">
          {selected.size} selected
        </span>
        <Select
          aria-label="Agent to assign to"
          value={bulkAssignee}
          onChange={(e) => setBulkAssignee(e.target.value)}
          placeholder={agentsData.isLoading ? 'Loading agents…' : 'Choose agent…'}
          options={agents.map((a) => ({ value: a.id, label: a.name }))}
          wrapperClassName="lg:w-60"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!bulkAssignee || selected.size === 0} isLoading={busy === 'assign'} onClick={() => void runAssign()}>
            Assign
          </Button>
          <Button size="sm" variant="secondary" disabled={selectedAssigned.length === 0} onClick={openUnassign}>
            Unassign{selectedAssigned.length > 1 ? ` (${selectedAssigned.length})` : ''}
          </Button>
          <Button size="sm" variant="secondary" disabled={!bulkAssignee} isLoading={busy === 'autofill'} onClick={() => void runAutofill()}>
            Autofill to daily cap
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <PolicyPendingChip dec="DEC-021" label="automatic allocation (cap 40 per agent per day)" demo />
          <PolicyPendingChip dec="DEC-017" label="B6 open deal blocks" demo />
        </div>
      </div>

      {actionError && <Alert tone="danger" title="Could not complete the action" body={actionError} />}
      {result && (
        <Alert tone={result.tone} title={result.title}>
          {result.skipped.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.skipped.slice(0, 8).map((s) => (
                <li key={`${s.businessId}:${s.code}`}>
                  {byId.get(s.businessId)?.businessName ?? s.businessId.slice(0, 8)} — {SKIP_LABEL[s.code] ?? s.message}
                </li>
              ))}
              {result.skipped.length > 8 && <li>and {result.skipped.length - 8} more</li>}
            </ul>
          )}
        </Alert>
      )}

      {isLoading && !data ? (
        <div className="rounded-xl border border-border-default bg-surface-default" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
      ) : error && !data ? (
        denied ? (
          <ApiErrorView error={error} area="Calling assignments" />
        ) : (
          <ApiErrorView error={error} onRetry={() => void mutate()} what="the assignments" />
        )
      ) : items.length === 0 ? (
        <StateView
          type={filtered ? 'no-results' : 'empty'}
          title={filtered ? 'No businesses match' : 'No businesses to assign'}
          body={filtered ? undefined : 'Businesses appear here once Data Entry adds them.'}
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('');
                  setFilterAssignee('');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <TH className="w-10">
                    <Checkbox
                      aria-label="Select all on this page"
                      checked={allSelected}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          items.forEach((i) => (e.target.checked ? next.add(i.businessId) : next.delete(i.businessId)));
                          return next;
                        })
                      }
                    />
                  </TH>
                  <TH sort={sortDir('businessName')} onSort={() => toggleSort('businessName')}>
                    Business
                  </TH>
                  <TH>Outcome</TH>
                  <TH sort={sortDir('assignee')} onSort={() => toggleSort('assignee')}>
                    Assigned to
                  </TH>
                  <TH sort={sortDir('startedAt')} onSort={() => toggleSort('startedAt')}>
                    Assigned since
                  </TH>
                  <TH>Flags</TH>
                  <TH className="w-44 text-right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {items.map((item) => (
                  <Row
                    key={item.businessId}
                    item={item}
                    checked={selected.has(item.businessId)}
                    reserved={reserved.has(item.businessId)}
                    timeZone={timeZone}
                    onToggle={(on) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(item.businessId);
                        else next.delete(item.businessId);
                        return next;
                      })
                    }
                    onReassign={() => setDialog({ mode: 'reassign', queue: [item.businessId], total: 1 })}
                    onUnassign={() => setDialog({ mode: 'unassign', queue: [item.businessId], total: 1 })}
                  />
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            rangeLabel={data ? `Showing ${(data.page - 1) * data.pageSize + 1}–${(data.page - 1) * data.pageSize + items.length} of ${data.total}` : undefined}
          />
        </>
      )}

      <p className="text-[13px] text-text-secondary leading-relaxed max-w-2xl">
        Reserved, Assigned but inaccessible and Assignee inactive are derived from live data and never stored. Nothing is reassigned automatically: you decide per
        business, and per open follow-up.
      </p>

      <ReassignImpactDialog
        mode={dialog?.mode ?? 'reassign'}
        row={dialogRow}
        agents={agents}
        timeZone={timeZone}
        progress={dialog && dialog.total > 1 ? `${dialog.total - dialog.queue.length + 1} of ${dialog.total}` : undefined}
        onClose={() => setDialog(null)}
        onReservationSeen={(id) => setReserved((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))}
        onDone={(message, businessId) => {
          toast.show({ tone: 'success', title: message });
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(businessId);
            return next;
          });
          setReserved((prev) => {
            const next = new Set(prev);
            next.delete(businessId);
            return next;
          });
          refresh();
          setDialog((d) => (d && d.queue.length > 1 ? { ...d, queue: d.queue.slice(1) } : null));
        }}
      />
    </div>
  );
}

function Row({
  item,
  checked,
  reserved,
  timeZone,
  onToggle,
  onReassign,
  onUnassign,
}: {
  item: AssignmentListItem;
  checked: boolean;
  reserved: boolean;
  timeZone: string;
  onToggle: (on: boolean) => void;
  onReassign: () => void;
  onUnassign: () => void;
}) {
  const a = item.assignment;
  const outcome = OUTCOME_LABEL[item.outcome] ?? 'Pending';
  const flags: React.ReactNode[] = [];
  if (reserved) flags.push(<DerivedChip key="reserved" tone="amber">Reserved</DerivedChip>);
  if (a?.assignedButInaccessible) flags.push(<DerivedChip key="b7" tone="amber">Assigned but inaccessible (B7)</DerivedChip>);
  if (a?.assigneeInactive) flags.push(<DerivedChip key="inactive" tone="amber">Assignee inactive</DerivedChip>);
  if (item.outcome === 'rejected') flags.push(<DerivedChip key="dnc">Do not call</DerivedChip>);

  return (
    <TR selected={checked}>
      <TD>
        <Checkbox aria-label={`Select ${item.businessName}`} checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      </TD>
      <TD>
        <span className="font-semibold text-text-primary">{item.businessName}</span>
      </TD>
      <TD>
        <OutcomeBadge outcome={outcome} />
      </TD>
      <TD>
        {a ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={a.assigneeName || '?'} size="sm" tone="neutral" />
            <span className="truncate text-text-primary">{a.assigneeName}</span>
            {a.source === 'automatic' && <Badge tone="neutral">auto</Badge>}
          </div>
        ) : (
          <span className="text-text-secondary">Unassigned</span>
        )}
      </TD>
      <TD className="text-[13px] text-text-secondary">{a ? formatDayTime(a.startedAt, timeZone) : '—'}</TD>
      <TD>{flags.length ? <div className="flex flex-wrap gap-1">{flags}</div> : <span className="text-text-muted">—</span>}</TD>
      <TD className="text-right">
        {a ? (
          <div className="inline-flex gap-1">
            <Button size="sm" variant="secondary" onClick={onReassign} aria-label={`Reassign ${item.businessName}`}>
              Reassign
            </Button>
            <Button size="sm" variant="ghost" onClick={onUnassign} aria-label={`Unassign ${item.businessName}`}>
              Unassign
            </Button>
          </div>
        ) : null}
      </TD>
    </TR>
  );
}
