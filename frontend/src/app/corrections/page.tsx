'use client';

import React, { useState } from 'react';
import { ACTIONS } from '@/lib/actions';
import { AppShell } from '@/components/layout/AppShell';
import type { CorrectionTab } from '@/lib/api/corrections';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { SearchInput, Select } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { ErrorState } from '@/components/businesses/AsyncState';
import { CorrectionsTable } from '@/components/businesses/CorrectionsTable';
import { useBusinessAccess, useCorrections } from '@/components/businesses/hooks';
import { PageHeader } from '@/components/businesses/PageHeader';
import { ResolveCorrectionDrawer } from '@/components/businesses/ResolveCorrectionDrawer';

const PAGE_SIZE = 10;

/** SCR-DE-006 Correction-request queue (+ SCR-DE-005 resolve drawer). Data comes from `lib/api/corrections.ts`. */
function CorrectionsContent() {
  const { allowed } = useBusinessAccess();
  const [tab, setTab] = useState<CorrectionTab>('open');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'submitted' | 'in_review'>('');
  const [requestedBy, setRequestedBy] = useState('');
  const [age, setAge] = useState<'' | 'lt1d' | 'd1to3' | 'gt3d'>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useCorrections({
    tab,
    q: q.trim() || undefined,
    status: tab === 'open' ? status || undefined : undefined,
    requestedBy: requestedBy || undefined,
    age: age || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  if (!allowed(ACTIONS.correctionRead)) return <NoticeAccess type="permission-denied" />;

  const counts = data?.tabCounts;
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        title="Correction requests"
        subtitle="Requests from Call Center, Developers and the Owner to fix business master data. One shared queue."
        chips={<PolicyPendingChip dec="DEC-002" demo />}
      />

      <Tabs
        activeId={tab}
        onChange={(id) => {
          setTab(id as CorrectionTab);
          setPage(1);
        }}
        items={[
          { id: 'open', label: `Open${counts ? ` (${counts.open})` : ''}` },
          { id: 'resolved', label: 'Resolved' },
          { id: 'closed', label: 'Closed / rejected' },
          { id: 'withdrawn', label: 'Withdrawn' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_240px_190px_190px] gap-3">
        <SearchInput
          label="Search business or requester"
          placeholder="Search business or requester"
          value={q}
          onChange={(e) => reset(setQ)(e.target.value)}
          wrapperClassName="sm:col-span-2 lg:col-span-1"
        />
        <Select
          aria-label="Status"
          value={status}
          disabled={tab !== 'open'}
          onChange={(e) => reset(setStatus)(e.target.value as typeof status)}
          options={[
            { value: '', label: 'Status: Submitted + In review' },
            { value: 'submitted', label: 'Status: Submitted' },
            { value: 'in_review', label: 'Status: In review' },
          ]}
        />
        <Select
          aria-label="Requested by"
          value={requestedBy}
          onChange={(e) => reset(setRequestedBy)(e.target.value)}
          options={[{ value: '', label: 'Requested by: Any' }, ...(data?.requesters ?? []).map((r) => ({ value: r, label: `Requested by: ${r}` }))]}
        />
        <Select
          aria-label="Age"
          value={age}
          onChange={(e) => reset(setAge)(e.target.value as typeof age)}
          options={[
            { value: '', label: 'Age: Any' },
            { value: 'lt1d', label: 'Age: Under 1 day' },
            { value: 'd1to3', label: 'Age: 1–3 days' },
            { value: 'gt3d', label: 'Age: Over 3 days' },
          ]}
        />
      </div>

      <CorrectionsTable
        rows={data?.items ?? []}
        tab={tab}
        loading={isLoading}
        error={error ? <ErrorState error={error} onRetry={() => mutate()} /> : undefined}
        selectedId={openId}
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? PAGE_SIZE}
        total={data?.total ?? 0}
        countTotal={data ? Math.min(data.total, counts?.[tab] ?? data.total) : undefined}
        onOpen={(row) => setOpenId(row.id)}
        onPageChange={setPage}
      />

      {tab === 'open' && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-text-secondary">
          <PolicyPendingChip dec="DEC-002" demo />
          <span>The redacted row is not counted in Open ({counts?.open ?? 0}). Omitting the row instead is the other alternative — neither is selected.</span>
        </p>
      )}
      {tab === 'withdrawn' && (
        <p className="text-[13px] leading-[18px] text-text-muted">Withdrawn requests are read-only. They are never reopened.</p>
      )}

      <ResolveCorrectionDrawer correctionId={openId} onClose={() => setOpenId(null)} onChanged={() => mutate()} />
    </div>
  );
}

export default function CorrectionsPage() {
  return (
    <AppShell>
      <CorrectionsContent />
    </AppShell>
  );
}
