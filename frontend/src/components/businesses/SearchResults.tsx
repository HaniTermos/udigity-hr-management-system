import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SearchHit, SearchMatchType, SearchPage } from '@/lib/api/businesses';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/ui/State';
import { Tag } from '@/components/ui/Badge';
import { Pagination, Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ListSkeleton } from './AsyncState';
import { FilterChip } from './FilterChip';
import { FlagChips } from './FlagChips';
import { BusinessNameCell, PhonesCell, SocialCell } from './BusinessTable';

const MATCH_LABEL: Record<SearchMatchType, string> = { name: 'Name', phone: 'Phone', social: 'Social handle' };

/** Match-type chips of SCR-SHR-010: All (n), Name, Phone, Social handle. Counts are after access filtering. */
export function SearchTypeChips({
  counts,
  active,
  onChange,
}: {
  counts?: SearchPage['counts'];
  active: SearchMatchType | undefined;
  onChange: (t: SearchMatchType | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Match type">
      <FilterChip pressed={!active} removable onClick={() => onChange(undefined)}>
        {counts ? `All (${counts.all})` : 'All'}
      </FilterChip>
      {(Object.keys(MATCH_LABEL) as SearchMatchType[]).map((t) => (
        <FilterChip key={t} pressed={active === t} onClick={() => onChange(active === t ? undefined : t)}>
          {MATCH_LABEL[t]}
          {counts ? ` (${counts[t]})` : ''}
        </FilterChip>
      ))}
    </div>
  );
}

/** Results table. The empty state never hints that a hidden business exists (DEC-003). */
export function SearchResultsTable({
  hits,
  query,
  loading,
  error,
  page,
  pageSize,
  total,
  onPageChange,
  onClear,
}: {
  hits: SearchHit[];
  query: string;
  loading?: boolean;
  error?: React.ReactNode;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onClear?: () => void;
}) {
  const router = useRouter();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const showing = Math.min(total, page * pageSize) - (page - 1) * pageSize;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border-default bg-surface-default">
      <div className="overflow-x-auto">
        <Table aria-label="Search results">
          <THead>
            <tr>
              <TH>Business</TH>
              <TH>Matched on</TH>
              <TH>Phones</TH>
              <TH>Social</TH>
              <TH>Flags</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {hits.map((h) => (
              <TR key={h.id} className="cursor-pointer" onClick={() => router.push(`/businesses/${h.id}`)}>
                <TD className="max-w-[260px]">
                  <BusinessNameCell name={h.name} meta={[h.branch, h.category].filter(Boolean).join(' · ')} href={`/businesses/${h.id}`} />
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {h.matchedOn.map((m) => (
                      <Tag key={m}>{MATCH_LABEL[m]}</Tag>
                    ))}
                  </div>
                </TD>
                <TD>
                  <PhonesCell phones={h.phones} />
                </TD>
                <TD className="max-w-[200px]">
                  <SocialCell accounts={h.social} />
                </TD>
                <TD>
                  <FlagChips flags={h.flags} />
                </TD>
                <TD className="text-right">
                  <Link href={`/businesses/${h.id}`} className="text-sm font-medium text-text-link hover:underline underline-offset-2" aria-label={`Open ${h.name}`}>
                    Open
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {loading && hits.length === 0 && <ListSkeleton rows={3} />}
      {error}
      {!loading && !error && hits.length === 0 && (
        <div className="border-t border-border-subtle">
          <StateView
            type="no-results"
            title="No matches"
            body={`No business you can open matches “${query}”. Try a name, a phone number or a social handle.`}
            action={
              onClear && (
                <Button variant="secondary" size="sm" onClick={onClear}>
                  Clear search
                </Button>
              )
            }
          />
        </div>
      )}
      {!error && (
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={onPageChange}
          rangeLabel={loading && hits.length === 0 ? undefined : `Showing ${showing < 0 ? 0 : showing} of ${total}`}
          perPage={`${pageSize} per page`}
        />
      )}
    </div>
  );
}
