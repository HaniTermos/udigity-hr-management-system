'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, CountBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Input';
import { SkeletonTableRow, StateView } from '@/components/ui/State';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useAuth } from '@/lib/auth';
import { usePage } from '@/lib/hooks/useApi';
import { dealSearchTerm, dealsPaths, type DealListItem } from '@/lib/api/deals';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import type { ProjectStatus } from '@/lib/api/projects';
import {
  AssignedChip,
  DealStageBadge,
  fmtDate,
  isProjectStatus,
  LoadError,
  PageTitle,
  PersonCell,
  ProjectStatusBadge,
  PROJECT_STATUS_OPTION_LABEL } from './shared';

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
  ...(Object.keys(PROJECT_STATUS_OPTION_LABEL) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS_OPTION_LABEL[s] })),
];

function tabClass(active: boolean): string {
  return active
    ? 'h-10 px-1 -mb-px border-b-2 border-brand-accent text-text-primary font-medium flex items-center gap-1.5 whitespace-nowrap'
    : 'h-10 px-1 -mb-px border-b-2 border-transparent text-text-secondary hover:text-text-primary flex items-center gap-1.5 whitespace-nowrap';
}

export function DealsList() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'closed' | 'accepted'>('closed');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'assigned_to_me'>('all');
  const [closed, setClosed] = useState('all');
  const [status, setStatus] = useState<ProjectStatus | 'any'>('any');
  const [page, setPage] = useState(1);

  // Search, project status, scope, closed-within and paging are all applied on the server (review B-04), so a match
  // on page 2 is found and the count badge is the count of what is shown.
  const search = dealSearchTerm(useDebouncedValue(q));
  const { items, total, pageCount, error, isLoading, retry } = usePage<DealListItem>(dealsPaths.list, {
    tab,
    scope,
    closedWithinDays: tab === 'closed' && closed !== 'all' ? Number(closed) : undefined,
    q: search,
    projectStatus: status === 'any' ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
    sort: tab === 'closed' ? 'closedAt' : 'createdAt',
    order: 'desc',
  });

  const rows = items;
  const filtered = Boolean(search || scope !== 'all' || closed !== 'all' || status !== 'any');

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
          onClick={() => {
            setTab('closed');
            setPage(1);
          }}
          className={tabClass(tab === 'closed')}
        >
          Closed deals
          {tab === 'closed' && !error && !isLoading && <CountBadge count={total} tone="brand" />}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'accepted'}
          onClick={() => {
            setTab('accepted');
            setPage(1);
          }}
          className={tabClass(tab === 'accepted')}
        >
          Accepted opportunities
          {tab === 'accepted' && !error && !isLoading && <CountBadge count={total} tone="brand" />}
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <SearchInput
            label="Search deals or businesses"
            placeholder="Search deals or businesses…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
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
          {tab === 'closed' && <Select
            aria-label="Closed within"
            options={CLOSED_OPTIONS}
            value={closed}
            onChange={(e) => {
              setClosed(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-full min-w-0"
          />}
          <Select
            aria-label="Project status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ProjectStatus | 'any');
              setPage(1);
            }}
            wrapperClassName="w-full min-w-0"
          />
        </div>
        <div className="flex justify-end">
          <span className="text-xs text-text-muted">{tab === 'closed' ? 'Sorted by closed date, newest first' : 'Sorted by date created, newest first'}</span>
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
          title={filtered ? 'No deals match' : tab === 'closed' ? 'No closed deals yet' : 'No accepted opportunities yet'}
          body={filtered ? 'Try a different search, or clear filters.' : tab === 'closed' ? 'Closed deals you are eligible to see will appear here.' : 'Open deals you are allowed to see will appear here.'}
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR interactive={false}>
                <TH>Deal</TH>
                <TH>Stage</TH>
                <TH>Developer</TH>
                <TH>{tab === 'closed' ? 'Closed on' : 'Created on'}</TH>
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
        Rows you cannot access are omitted and not counted.
      </p>
    </div>
  );
}

function ProjectCell({ deal }: { deal: DealListItem }) {
  if (isProjectStatus(deal.projectStatus)) return <ProjectStatusBadge status={deal.projectStatus} />;
  // Closed and no project row yet: derived "Project setup pending" (F2).
  if (deal.stage === 'closed' && !deal.projectId) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="warning" derived>
          Project setup pending
        </Badge>
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
        {deal.stage === 'closed' ? (
          <Badge tone="info" hasDot>
            Verified closed
          </Badge>
        ) : (
          <DealStageBadge stage={deal.stage} />
        )}
      </TD>
      <TD>
        <PersonCell name={deal.assignedDeveloperName} />
      </TD>
      <TD>{fmtDate(deal.closedAt ?? deal.createdAt)}</TD>
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
