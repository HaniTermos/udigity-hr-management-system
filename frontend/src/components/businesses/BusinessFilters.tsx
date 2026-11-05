import React from 'react';
import type { BusinessQuery, DirectoryFlagFilter } from '@/lib/api/businesses';
import { SearchInput, Select } from '@/components/ui/Input';
import { FilterChip } from './FilterChip';

export interface DirectoryFilterState {
  q: string;
  category: string;
  createdBy: string;
  website: '' | 'yes' | 'no';
  followers: '' | 'known' | 'unknown';
  flag: DirectoryFlagFilter | '';
  /** Owner only: `only` lists archived businesses. */
  archived: '' | 'only';
}

export const EMPTY_FILTERS: DirectoryFilterState = { q: '', category: '', createdBy: '', website: '', followers: '', flag: '', archived: '' };

export function filtersToQuery(f: DirectoryFilterState): BusinessQuery {
  return {
    q: f.q.trim() || undefined,
    category: f.category || undefined,
    createdBy: f.createdBy || undefined,
    website: f.website || undefined,
    followers: f.followers || undefined,
    flag: f.flag || undefined,
    archived: f.archived || undefined,
  };
}

const QUICK: { id: DirectoryFlagFilter; label: string }[] = [
  { id: 'no_phone', label: 'No phone' },
  { id: 'no_website', label: 'No website' },
  { id: 'followers_unknown', label: 'Followers unknown' },
];

/**
 * SCR-DE-001 filter bar: search (name, phone, social handle), four selects and the quick chips.
 * "Archived" is an Owner-only chip (C-01 demonstration alternative): non-Owners never receive archived rows.
 */
export function BusinessFilters({
  value,
  onChange,
  categories,
  creators,
  correctionCount,
  showArchived,
}: {
  value: DirectoryFilterState;
  onChange: (next: DirectoryFilterState) => void;
  categories: string[];
  creators: string[];
  /** `undefined` while loading (the chip then shows no count). */
  correctionCount?: number;
  /** Owner only. */
  showArchived?: boolean;
}) {
  const set = <K extends keyof DirectoryFilterState>(key: K, v: DirectoryFilterState[K]) => onChange({ ...value, [key]: v });
  const toggleFlag = (id: DirectoryFlagFilter) => set('flag', value.flag === id ? '' : id);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
        <SearchInput
          label="Search businesses"
          placeholder="Search name, phone or social handle…"
          value={value.q}
          onChange={(e) => set('q', e.target.value)}
          wrapperClassName="w-full min-w-0"
        />
        <Select
          aria-label="Category"
          value={value.category}
          onChange={(e) => set('category', e.target.value)}
          options={[{ value: '', label: 'Category: All' }, ...categories.map((c) => ({ value: c, label: `Category: ${c}` }))]}
          wrapperClassName="w-full min-w-0"
        />
        <Select
          aria-label="Created by"
          value={value.createdBy}
          onChange={(e) => set('createdBy', e.target.value)}
          options={[{ value: '', label: 'Created by: Any' }, ...creators.map((c) => ({ value: c, label: `Created by: ${c}` }))]}
          wrapperClassName="w-full min-w-0"
        />
        <Select
          aria-label="Website"
          value={value.website}
          onChange={(e) => set('website', e.target.value as DirectoryFilterState['website'])}
          options={[
            { value: '', label: 'Website: Any' },
            { value: 'yes', label: 'Website: Yes' },
            { value: 'no', label: 'Website: No' },
          ]}
          wrapperClassName="w-full min-w-0"
        />
        <Select
          aria-label="Followers"
          value={value.followers}
          onChange={(e) => set('followers', e.target.value as DirectoryFilterState['followers'])}
          options={[
            { value: '', label: 'Followers: Any' },
            { value: 'known', label: 'Followers: Known' },
            { value: 'unknown', label: 'Followers: Unknown' },
          ]}
          wrapperClassName="w-full min-w-0"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip pressed={value.flag === 'correction_requested'} onClick={() => toggleFlag('correction_requested')}>
          {correctionCount === undefined ? 'Correction requested' : `Correction requested (${correctionCount})`}
        </FilterChip>
        {QUICK.map((c) => (
          <FilterChip key={c.id} pressed={value.flag === c.id} onClick={() => toggleFlag(c.id)}>
            {c.label}
          </FilterChip>
        ))}
        {showArchived && (
          <FilterChip pressed={value.archived === 'only'} onClick={() => set('archived', value.archived === 'only' ? '' : 'only')}>
            Archived
          </FilterChip>
        )}
      </div>
    </div>
  );
}
