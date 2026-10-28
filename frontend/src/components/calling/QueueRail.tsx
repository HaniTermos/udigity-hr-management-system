'use client';

import React, { useMemo, useState } from 'react';
import { CardSection } from '@/components/ui/Card';
import { DerivedChip } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SearchInput } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import type { QueueDto } from '@/lib/api/calling';
import { BucketGroup, groupQueue } from './QueueBoard';

/** Left rail of the contact workspace (SCR-CC-002/003): the same buckets, compact. */
export function QueueRail({ queue, activeId, dncCount }: { queue: QueueDto; activeId: string; dncCount: number | null }) {
  const [text, setText] = useState('');
  const groups = useMemo(() => groupQueue(queue.items, text, 'all'), [queue, text]);
  return (
    <CardSection title="My calling queue" subtitle={`${queue.total} businesses`} className="p-0 gap-0 [&>div:first-child]:p-4 overflow-hidden">
      <div className="px-4 pb-3 flex flex-col gap-2">
        <SearchInput label="Filter queue" size="sm" placeholder="Filter queue" value={text} onChange={(e) => setText(e.target.value)} />
        <DerivedChip>Derived · buckets are not stored</DerivedChip>
      </div>
      {groups.map((g) => (
        <BucketGroup key={g.bucket} group={g} activeId={activeId} compact defaultOpen={g.column === 'due-now' || g.items.some((i) => i.businessId === activeId)} />
      ))}
      <div className="px-4 py-3 border-t border-border-subtle flex flex-col gap-2 text-[13px] text-status-brand-fg">
        <span className="inline-flex items-center gap-1.5 font-medium">
          Rejected: do not call{dncCount !== null ? ` (${dncCount})` : ''} — view only <Icon name="ban" size={14} />
        </span>
        <PolicyPendingChip dec="DEC-016" demo />
      </div>
    </CardSection>
  );
}
