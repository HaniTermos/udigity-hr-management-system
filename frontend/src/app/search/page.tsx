'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ACTIONS } from '@/lib/actions';
import { AppShell } from '@/components/layout/AppShell';
import type { SearchMatchType } from '@/lib/api/businesses';
import { SearchInput } from '@/components/ui/Input';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { StateView } from '@/components/ui/State';
import { ErrorState } from '@/components/businesses/AsyncState';
import { useBusinessAccess, useBusinessSearch } from '@/components/businesses/hooks';
import { PageHeader } from '@/components/businesses/PageHeader';
import { SearchResultsTable, SearchTypeChips } from '@/components/businesses/SearchResults';

const PAGE_SIZE = 10;

/**
 * SCR-SHR-010 Search results. Scoped by the server (`scopeFilter`): hidden and out-of-scope businesses are never
 * returned, counted, or hinted at. The top-bar search (FE1 header) opens this page with `?q=`.
 */
function SearchContent() {
  const params = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  // Keyed by the query so the match-type chip and page reset when the term changes.
  return <SearchBody key={q} q={q} />;
}

function SearchBody({ q }: { q: string }) {
  const router = useRouter();
  const { role, allowed } = useBusinessAccess();
  const [matchType, setMatchType] = useState<SearchMatchType>();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(q);

  const { data, error, isLoading, mutate } = useBusinessSearch({ q, matchType, page, pageSize: PAGE_SIZE });

  if (role && !allowed(ACTIONS.businessSearch)) return <NoticeAccess type="permission-denied" />;

  const digitsOnly = /^[\d\s+()-]+$/.test(q);
  const total = data?.counts.all ?? 0;
  const subtitle = q.length < 2
    ? 'Search by business name, phone number or social handle. Enter at least 2 characters.'
    : data
      ? `${total} ${total === 1 ? 'business matches' : 'businesses match'}${digitsOnly ? ' the phone digits' : ''}. Results show only businesses you can open.`
      : 'Results show only businesses you can open.';

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        title={q ? `Search results for “${q}”` : 'Search'}
        subtitle={subtitle}
      />

      {q.length < 2 ? (
        <div className="space-y-4">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(draft.trim())}`);
            }}
          >
            <SearchInput label="Search businesses" placeholder="Search name, phone or social handle" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </form>
          <StateView type="empty" title="Type to search" body="Enter at least 2 characters. Results include only businesses you can open." />
        </div>
      ) : (
        <>
          <SearchTypeChips
            counts={data?.counts}
            active={matchType}
            onChange={(t) => {
              setMatchType(t);
              setPage(1);
            }}
          />
          <SearchResultsTable
            hits={data?.items ?? []}
            query={q}
            loading={isLoading}
            error={error ? <ErrorState error={error} onRetry={() => mutate()} /> : undefined}
            page={data?.page ?? page}
            pageSize={data?.pageSize ?? PAGE_SIZE}
            total={data?.total ?? 0}
            onPageChange={setPage}
            onClear={() => router.push('/search')}
          />
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <SearchContent />
      </Suspense>
    </AppShell>
  );
}
