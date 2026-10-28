'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge, DerivedChip, OutcomeBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SearchInput } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import type { QueueBucket, QueueDto, QueueItemDto } from '@/lib/api/calling';
import { BUCKET_COLUMN, BUCKET_ORDER, BUCKET_TITLE, OUTCOME_LABEL, useCallingFormat, type CallingFormat, type QueueColumn } from './format';

export type BucketFilter = 'all' | 'due' | 'overdue';

const COLUMNS: { id: QueueColumn; label: string }[] = [
  { id: 'due-now', label: 'Due now' },
  { id: 'to-start', label: 'To start or schedule' },
  { id: 'needs-attention', label: 'Needs attention' },
];

export interface BucketGroupData {
  bucket: QueueBucket;
  title: string;
  column: QueueColumn;
  items: QueueItemDto[];
}

/** Group one queue page into the derived buckets; empty buckets are kept only when no text filter is active. */
export function groupQueue(items: QueueItemDto[], text: string, filter: BucketFilter): BucketGroupData[] {
  const q = text.trim().toLowerCase();
  const wanted = (b: QueueBucket) => (filter === 'due' ? b === 'callback_due' : filter === 'overdue' ? b === 'overdue_follow_up' : true);
  return BUCKET_ORDER.filter(wanted)
    .map((bucket) => ({
      bucket,
      title: BUCKET_TITLE[bucket],
      column: BUCKET_COLUMN[bucket],
      items: items.filter((i) => i.bucket === bucket && (!q || i.businessName.toLowerCase().includes(q))),
    }))
    .filter((g) => g.items.length > 0);
}

/** Pre-formatted meta line (company timezone) built from the derived fields of the queue item. */
export function queueMeta(i: QueueItemDto, f: CallingFormat): string {
  const last = i.lastAttemptAt ? `last attempt ${f.dayTime(i.lastAttemptAt)}` : 'no attempts yet';
  switch (i.bucket) {
    case 'callback_due':
      return `Due ${i.openFollowUp ? f.time(i.openFollowUp.scheduledFor) : ''} · ${last}`;
    case 'overdue_follow_up':
      return `Was due ${i.openFollowUp ? f.dayTime(i.openFollowUp.scheduledFor) : ''} · ${last}`;
    case 'upcoming_follow_up':
      return `Next ${i.openFollowUp ? f.dayTime(i.openFollowUp.scheduledFor) : ''} · ${last}`;
    case 'callback_to_schedule':
      return `Time not set yet · ${last}`;
    case 'new_assigned':
      return `Assigned ${f.dayTime(i.assignedAt)} · no attempts yet`;
    default:
      return `${last}${i.openFollowUp ? '' : ' · no open follow-up'}`;
  }
}

export function QueueFilterBar({
  counts,
  text,
  onText,
  filter,
  onFilter,
}: {
  counts: QueueDto['counts'];
  text: string;
  onText: (v: string) => void;
  filter: BucketFilter;
  onFilter: (f: BucketFilter) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <SearchInput label="Filter by name" placeholder="Filter by name" value={text} onChange={(e) => onText(e.target.value)} wrapperClassName="sm:w-[240px]" />
      <Tabs
        style="segmented"
        activeId={filter}
        onChange={(id) => onFilter(id as BucketFilter)}
        items={[
          { id: 'all', label: 'All buckets' },
          { id: 'due', label: `Due today (${counts.callback_due})` },
          { id: 'overdue', label: `Overdue (${counts.overdue_follow_up})` },
        ]}
      />
    </div>
  );
}

export function QueueRow({ item, active, compact }: { item: QueueItemDto; active?: boolean; compact?: boolean }) {
  const f = useCallingFormat();
  return (
    <Link
      href={`/queue/${item.businessId}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'block px-4 py-3 border-t border-border-subtle transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset',
        active && 'bg-surface-selected border-l-4 border-l-border-selected pl-3'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('font-medium text-text-primary', compact ? 'text-sm' : 'text-[15px] leading-5')}>{item.businessName}</span>
        <OutcomeBadge outcome={OUTCOME_LABEL[item.outcome]} className="shrink-0" />
      </div>
      <div className="text-[13px] leading-[18px] text-text-muted mt-0.5">{queueMeta(item, f)}</div>
      {(item.reservedByOther || item.bucket === 'overdue_follow_up') && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {item.reservedByOther && <DerivedChip tone="amber">Reserved</DerivedChip>}
          {item.bucket === 'overdue_follow_up' && (
            <Badge tone="danger" icon="flag">
              Overdue
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}

export function BucketGroup({ group, activeId, compact, defaultOpen = true }: { group: BucketGroupData; activeId?: string; compact?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 h-11 px-4 bg-surface-subtle border-t border-border-subtle text-sm font-semibold text-text-primary cursor-pointer hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
      >
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} className="text-icon-muted" />
        <span className="flex-1 text-left">{group.title}</span>
        <span className="text-[13px] font-normal text-text-muted tabular-nums">{group.items.length}</span>
      </button>
      {open && group.items.map((i) => <QueueRow key={i.businessId} item={i} active={i.businessId === activeId} compact={compact} />)}
    </section>
  );
}

/** SCR-CC-001 board: three columns on desktop, one stacked list on mobile. */
export function QueueBoard({ groups }: { groups: BucketGroupData[] }) {
  const columns = useMemo(() => COLUMNS.map((c) => ({ ...c, groups: groups.filter((g) => g.column === c.id) })).filter((c) => c.groups.length), [groups]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {columns.map((c) => (
        <div key={c.id} className="rounded-xl border border-border-default bg-surface-default overflow-hidden">
          <h2 className="px-4 pt-3 pb-2 text-xs font-semibold tracking-wider uppercase text-text-muted">{c.label}</h2>
          {c.groups.map((g) => (
            <BucketGroup key={g.bucket} group={g} defaultOpen />
          ))}
        </div>
      ))}
    </div>
  );
}
