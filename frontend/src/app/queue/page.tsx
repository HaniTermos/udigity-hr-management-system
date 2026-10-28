'use client';

import React, { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { DerivedChip } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Alert';
import { StateView } from '@/components/ui/State';
import { ApiErrorView } from '@/components/states';
import { CallingPageHeader, HeaderLink, LoadingBlock } from '@/components/calling/CallingPageHeader';
import { BucketFilter, QueueBoard, QueueFilterBar, groupQueue } from '@/components/calling/QueueBoard';
import { OverdueThresholdChip, ReopenPolicyChip } from '@/components/calling/PolicyNotes';
import { useDoNotCallCount, useQueue } from '@/components/calling/hooks';
import { useCallingFormat } from '@/components/calling/format';

/** SCR-CC-001 Calling queue. Buckets and counts come from GET /api/calling/queue (derived, nothing stored). */
export default function CallingQueuePage() {
  const { data, error, route, isLoading, retry } = useQueue();
  const dncCount = useDoNotCallCount();
  const f = useCallingFormat();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<BucketFilter>('all');
  const groups = useMemo(() => (data ? groupQueue(data.items, text, filter) : []), [data, text, filter]);

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1200px] mx-auto">
        <CallingPageHeader
          title="Calling queue"
          subtitle={
            data
              ? `${f.dateLabel(new Date())} · ${data.total} businesses assigned to you · open a business to see its history and start a contact`
              : undefined
          }
          actions={
            <>
              <HeaderLink href="/calendar" icon="calendar">
                Follow-ups &amp; Calendar
              </HeaderLink>
              <HeaderLink href="/do-not-call" icon="ban">
                Do-not-call list{dncCount !== null ? ` (${dncCount})` : ''}
              </HeaderLink>
            </>
          }
        />

        {isLoading && <LoadingBlock />}
        {error && <ApiErrorView route={route} onRetry={retry} area="the calling queue" what="the calling queue" backHref="/my-day" />}

        {data && (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <QueueFilterBar counts={data.counts} text={text} onText={setText} filter={filter} onFilter={setFilter} />
              <div className="flex flex-wrap items-center gap-2">
                <DerivedChip>Buckets are derived · a business is in exactly one</DerivedChip>
                <OverdueThresholdChip />
              </div>
            </div>

            {data.total > data.items.length && (
              <Alert tone="info" title={`Showing the first ${data.items.length} of ${data.total} businesses`} body="Use the filter or the bucket tabs to narrow the list." />
            )}

            {data.total === 0 ? (
              <StateView type="empty" size="page" title="Nothing in your queue" body="No businesses are assigned to you. The Owner assigns businesses to your queue." />
            ) : groups.length === 0 ? (
              <StateView type="no-results" size="inline" title="No matches" body="No business in your queue matches this filter." />
            ) : (
              <QueueBoard groups={groups} />
            )}

            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 rounded-xl border border-border-default bg-surface-default px-4 py-3 text-[13px] leading-[18px] text-text-secondary">
              <span className="inline-flex items-center gap-1.5 font-medium text-status-brand-fg">
                Rejected: do not call{dncCount !== null ? ` (${dncCount})` : ''} — view only <Icon name="ban" size={14} />
              </span>
              <span className="flex-1">Rejected businesses are excluded from every calling bucket; Start Contact is disabled for them.</span>
              <ReopenPolicyChip />
              <span className="text-text-muted">No check-in needed to call</span>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
