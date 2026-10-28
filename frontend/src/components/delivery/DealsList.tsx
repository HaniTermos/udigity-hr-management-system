'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, CountBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { SkeletonTableRow, StateView } from '@/components/ui/State';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useAuth } from '@/lib/auth';
import { usePage } from '@/lib/hooks/useApi';
import { dealsPaths, type DealListItem } from '@/lib/api/deals';
import type { ProjectStatus } from '@/lib/api/projects';
import {
  AssignedChip,
  fmtDate,
  isProjectStatus,
  LoadError,
  PageTitle,
  PersonCell,
  ProjectStatusBadge,
  PROJECT_STATUS_LABEL,
} from './shared';

const PAGE_SIZE = 50;
const SCOPE_OPTIONS = [
  { value: 'all', label: 'All eligible deals' },
  { value: 'assigned_to_me', label: 'Assigned to me' },
];
const CLOSED_OPTIONS = [
  { value: '30', label: 'Closed: last 30 days' },
  { value: '90', label: 'Closed: last 90 days' },
  { value: 'all', label: 'Closed: any time' },
];
const STATUS_OPTIONS = [
  { value: 'any', label: 'Project status: Any' },
  ...(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] })),
];

export function DealsList() {
  const { user } = useAuth();
  const [tab] = useState<'closed'>('closed');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'assigned_to_me'>('all');
  const [closed, setClosed] = useState('all');
  const [status, setStatus] = useState<ProjectStatus | 'any'>('any');
  const [page, setPage] = useState(1);

  // The deal list filters by scope, closed-within and paging on the server. Search and project status are applied
  // to the loaded page (BE4-C1 item 6: the list has no `q` or `projectStatus`).
  const { items, total, pageCount, error, isLoading, retry } = usePage<DealListItem>(dealsPaths.list, {
    tab: 'closed',
    scope,
    closedWithinDays: closed === 'all' ? undefined : Number(closed),
    page,
    pageSize: PAGE_SIZE,
    sort: 'closedAt',
    order: 'desc',
  });

  const needle = q.trim().toLowerCase();
  const rows = items.filter(
    (d) =>
      (!needle || `${d.businessName ?? ''} ${d.code}`.toLowerCase().includes(needle)) &&
      (status === 'any' || d.projectStatus === status)
  );
  const filtered = Boolean(needle || scope !== 'all' || closed !== 'all' || status !== 'any');

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <PageTitle
        title="Deals"
        description="Closed deals from the whole company that you are eligible to see. Closed deal ≠ completed project — delivery runs on the project board."
      />

      <div role="tablist" className="flex items-center gap-6 border-b border-border-default text-sm overflow-x-auto">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'closed'}
          className="h-10 px-1 -mb-px border-b-2 border-brand-accent text-text-primary font-medium flex items-center gap-1.5 whitespace-nowrap"
        >
          Closed deals
          {!error && !isLoading && <CountBadge count={total} tone="brand" />}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          disabled
          className="h-10 px-1 -mb-px border-b-2 border-transparent text-text-disabled flex items-center gap-2 whitespace-nowrap"
        >
          Accepted opportunities
          <PolicyPendingChip dec="DEC-005" label="tab only if Alt 1" demo />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <SearchInput
            label="Search deals or businesses"
            placeholder="Search deals or businesses…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            wrapperClassName="w-full min-w-0"
          />
          <Select
            aria-label="Scope"
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as typeof scope);
              setPage(1);
            }}
            wrapperClassName="w-full min-w-0"
          />
          <Select
            aria-label="Closed within"
            options={CLOSED_OPTIONS}
            value={closed}
            onChange={(e) => {
              setClosed(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-full min-w-0"
          />
          <Select
            aria-label="Project status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus | 'any')}
            wrapperClassName="w-full min-w-0"
          />
        </div>
        <div className="flex justify-end">
          <span className="text-xs text-text-muted">Sorted by closed date, newest first</span>
        </div>
      </div>

      {error ? (
        <LoadError error={error} onRetry={() => void retry()} what="deals" />
      ) : isLoading ? (
        <TableContainer aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonTableRow key={i} />
          ))}
        </TableContainer>
      ) : rows.length === 0 ? (
        <StateView
          type={filtered ? 'no-results' : 'empty'}
          title={filtered ? 'No deals match' : 'No closed deals yet'}
          body={filtered ? 'Try a different search, or clear filters.' : 'Closed deals you are eligible to see will appear here.'}
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR interactive={false}>
                <TH>Deal</TH>
                <TH>Stage</TH>
                <TH>Developer</TH>
                <TH>Closed on</TH>
                <TH>Project status</TH>
                <TH>For you</TH>
                <TH aria-label="Actions" />
              </TR>
            </THead>
            <TBody>
              {rows.map((d) => (
                <DealTableRow key={d.id} deal={d} mine={Boolean(user && d.assignedDeveloperId === user.id)} />
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {pageCount > 1 && !error && (
        <div className="flex items-center justify-end gap-3 text-sm text-text-secondary">
          <span className="tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Closed deals only · no pre-closure or unassigned rows · rows you cannot access are omitted and not counted (WF-ACCESS-001).
      </p>
      <div className="flex flex-wrap gap-2">
        <PolicyPendingChip dec="DEC-002" label="15-day visibility pending" demo />
        <PolicyPendingChip dec="DEC-017" label="one or many deals per business" demo />
        <PolicyPendingChip dec="Proposed" label="stage names, no DEC ID" demo />
      </div>
    </div>
  );
}

function ProjectCell({ deal }: { deal: DealListItem }) {
  if (isProjectStatus(deal.projectStatus)) return <ProjectStatusBadge status={deal.projectStatus} />;
  // Closed and no project row yet: derived "Project provisioning pending" (F2).
  if (deal.stage === 'closed' && !deal.projectId) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="warning" derived>
          Project provisioning pending
        </Badge>
        <PolicyPendingChip dec="F2" demo />
      </div>
    );
  }
  return <span className="text-text-muted">—</span>;
}

function DealTableRow({ deal, mine }: { deal: DealListItem; mine: boolean }) {
  return (
    <TR>
      <TD meta={deal.code} className="max-w-[280px]">
        <Link href={`/deals/${deal.id}`} className="block truncate hover:underline">
          {deal.businessName ?? deal.code}
        </Link>
      </TD>
      <TD>
        <Badge tone="info" hasDot>
          Closed deal
        </Badge>
      </TD>
      <TD>
        <PersonCell name={deal.assignedDeveloperName} />
      </TD>
      <TD>{fmtDate(deal.closedAt)}</TD>
      <TD>
        <ProjectCell deal={deal} />
      </TD>
      <TD>{mine && <AssignedChip />}</TD>
      <TD>
        <Link href={`/deals/${deal.id}`} className="text-sm font-medium text-text-link hover:underline">
          Open
        </Link>
      </TD>
    </TR>
  );
}
