'use client';

import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ACTIONS } from '@/lib/actions';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { BusinessFilters, EMPTY_FILTERS, filtersToQuery, type DirectoryFilterState } from '@/components/businesses/BusinessFilters';
import { BusinessTable } from '@/components/businesses/BusinessTable';
import { ErrorState } from '@/components/businesses/AsyncState';
import { useBusinessAccess, useBusinessList } from '@/components/businesses/hooks';
import { PageHeader } from '@/components/businesses/PageHeader';

const PAGE_SIZE = 8;

/** SCR-DE-001 Business directory. Data comes from `lib/api/businesses.ts` through SWR (plan §9). */
function DirectoryContent() {
  const params = useSearchParams();
  const { allowed } = useBusinessAccess();
  const [filters, setFilters] = useState<DirectoryFilterState>({ ...EMPTY_FILTERS, q: params.get('q') ?? '' });
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const debouncedQ = useDebouncedValue(filters.q);

  const { data, error, isLoading, mutate } = useBusinessList({
    ...filtersToQuery({ ...filters, q: debouncedQ }),
    page,
    pageSize: PAGE_SIZE,
    sort: 'name',
    order,
  });

  const narrowed = Object.values(filters).some((v) => v !== '');
  const onFilters = (next: DirectoryFilterState) => {
    setFilters(next);
    setPage(1);
  };
  // Hidden/archived records are shown to whoever may restore them (capability, not role name; B-11).
  const isOwner = allowed(ACTIONS.businessRestore);

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        title="Businesses"
        subtitle={isOwner ? 'All stored businesses, including those hidden from other roles.' : 'Businesses you can see. Lists and counts include only records you can open.'}
        actions={
          allowed(ACTIONS.businessCreate) && (
            <Link href="/businesses/new" className="inline-flex">
              <Button leadingIcon={<Icon name="plus" size={16} />} tabIndex={-1}>
                Add business
              </Button>
            </Link>
          )
        }
      />

      {isOwner && (
        <Alert
          tone="info"
          title="Owner view"
          body="You see every business. “Hidden from other roles” marks records the visibility rules hide from other roles. Duplicates are blocked for everyone."
        />
      )}

      <BusinessFilters
        value={filters}
        onChange={onFilters}
        categories={data?.facets.categories ?? []}
        creators={data?.facets.creators ?? []}
        correctionCount={data?.counts.correctionRequested}
        showArchived={isOwner}
      />

      <BusinessTable
        rows={data?.items ?? []}
        loading={isLoading}
        error={error ? <ErrorState error={error} onRetry={() => mutate()} /> : undefined}
        filtered={narrowed}
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? PAGE_SIZE}
        total={data?.total ?? 0}
        sortOrder={order}
        onSort={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        onPageChange={setPage}
        onClearFilters={() => onFilters(EMPTY_FILTERS)}
      />
    </div>
  );
}

export default function BusinessDirectoryPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DirectoryContent />
      </Suspense>
    </AppShell>
  );
}
