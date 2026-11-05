import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BusinessRow, SocialAccount, PhoneNumber } from '@/lib/api/businesses';
import { Pagination, Table, TBody, TD, TH, THead, TR, type SortDirection } from '@/components/ui/Table';
import { StateView } from '@/components/ui/State';
import { Button } from '@/components/ui/Button';
import { FlagChips } from './FlagChips';
import { ListSkeleton } from './AsyncState';
import { formatDay, formatPhone, socialSecondLine } from './format';

export function PhonesCell({ phones }: { phones: PhoneNumber[] }) {
  if (phones.length === 0) {
    return (
      <div className="flex flex-col">
        <span className="font-medium leading-5">No phone</span>
        <span className="text-[13px] leading-[18px] text-text-muted">Not callable</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="font-medium leading-5 tabular-nums">{formatPhone(phones[0])}</span>
      <span className="text-[13px] leading-[18px] text-text-muted">{phones.length > 1 ? `+${phones.length - 1} more` : 'Primary'}</span>
    </div>
  );
}

export function SocialCell({ accounts }: { accounts: SocialAccount[] }) {
  if (accounts.length === 0) return <span className="text-text-muted">No social account</span>;
  const first = accounts[0];
  return (
    <div className="flex flex-col">
      <span className="font-medium leading-5 truncate">{first.handle}</span>
      <span className="text-[13px] leading-[18px] text-text-muted truncate">
        {socialSecondLine(first)}
        {accounts.length > 1 ? ` · +${accounts.length - 1} more` : ''}
      </span>
    </div>
  );
}

export function BusinessNameCell({ name, meta, href }: { name: string; meta: string; href: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <Link href={href} className="font-medium leading-5 text-text-primary hover:underline underline-offset-2 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-xs">
        {name}
      </Link>
      <span className="text-[13px] leading-[18px] text-text-muted truncate">{meta}</span>
    </div>
  );
}

/** SCR-DE-001 directory table + pagination. Loading, empty and error are drawn by the caller through the props. */
export function BusinessTable({
  rows,
  loading,
  error,
  filtered,
  page,
  pageSize,
  total,
  sortOrder,
  onSort,
  onPageChange,
  onClearFilters,
}: {
  rows: BusinessRow[];
  loading?: boolean;
  error?: React.ReactNode;
  /** True when filters or a search narrowed the list (switches the empty copy to "No matches"). */
  filtered?: boolean;
  page: number;
  pageSize: number;
  total: number;
  sortOrder: 'asc' | 'desc';
  onSort: () => void;
  onPageChange: (page: number) => void;
  onClearFilters?: () => void;
}) {
  const router = useRouter();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const sort: SortDirection = sortOrder === 'asc' ? 'ascending' : 'descending';

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border-default bg-surface-default">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Businesses table (scrolls sideways)">
        <Table aria-label="Businesses">
          <THead>
            <tr>
              <TH sort={sort} onSort={onSort}>
                Business
              </TH>
              <TH>Phones</TH>
              <TH>Social</TH>
              <TH>Website</TH>
              <TH>Created by</TH>
              <TH>Flags</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((b) => (
              <TR key={b.id} className="cursor-pointer" onClick={() => router.push(`/businesses/${b.id}`)}>
                <TD className="max-w-[260px]">
                  <BusinessNameCell
                    name={b.name}
                    meta={[b.branch, b.category].filter(Boolean).join(' · ')}
                    href={`/businesses/${b.id}`}
                  />
                </TD>
                <TD>
                  <PhonesCell phones={b.phones} />
                </TD>
                <TD className="max-w-[220px]">
                  <SocialCell accounts={b.social} />
                </TD>
                <TD className="max-w-[160px]">
                  {b.website ? <span className="block truncate">{b.website}</span> : <span className="text-text-secondary">No website</span>}
                </TD>
                <TD meta={formatDay(b.createdAt)}>{b.createdBy}</TD>
                <TD>
                  <FlagChips flags={b.flags} openCorrections={b.openCorrections} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {loading && rows.length === 0 && <ListSkeleton rows={6} />}
      {error}
      {!loading && !error && rows.length === 0 && (
        <div className="border-t border-border-subtle">
          {filtered ? (
            <StateView
              type="no-results"
              action={
                onClearFilters && (
                  <Button variant="secondary" size="sm" onClick={onClearFilters}>
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <StateView
              type="empty"
              title="No businesses yet"
              body="Businesses you add will appear here. Duplicates are checked against all stored businesses when you save."
              action={
                <Link href="/businesses/new" className="inline-flex">
                  <Button variant="secondary" size="sm" tabIndex={-1}>
                    Add business
                  </Button>
                </Link>
              }
            />
          )}
        </div>
      )}

      {!error && (
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={onPageChange}
          rangeLabel={loading && rows.length === 0 ? undefined : `Showing ${from}–${to} of ${total}`}
          perPage={`${pageSize} per page`}
        />
      )}
    </div>
  );
}
