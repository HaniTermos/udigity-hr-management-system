'use client';

import React, { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { DerivedChip } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { StateView } from '@/components/ui/State';
import { Tabs } from '@/components/ui/Tabs';
import { ApiErrorView } from '@/components/states';
import type { FollowUpDto } from '@/lib/api/calling';
import { CallingPageHeader, LoadingBlock } from '@/components/calling/CallingPageHeader';
import { FollowUpCommandDialog, FollowUpDrawer, FollowUpGroups, DayAgenda, WeekGrid } from '@/components/calling/FollowUps';
import { OverdueThresholdChip } from '@/components/calling/PolicyNotes';
import { useFollowUps, useQueue } from '@/components/calling/hooks';
import { addDaysKey, useCallingFormat, weekStartKey } from '@/components/calling/format';

/** SCR-CC-004 Follow-ups & calendar (+ SCR-CC-006 drawer). Data: GET /api/follow-ups (list, and a <=62-day range for the week). */
export default function FollowUpsPage() {
  const f = useCallingFormat();
  const [view, setView] = useState<'list' | 'week'>('list');
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const start = weekStart ?? weekStartKey(f.todayKey());
  const [drawer, setDrawer] = useState<'create' | 'reschedule' | null>(null);
  const [target, setTarget] = useState<FollowUpDto | null>(null);
  const [command, setCommand] = useState<{ kind: 'complete' | 'cancel'; fu: FollowUpDto } | null>(null);
  const [stateFilter, setStateFilter] = useState<'scheduled' | 'completed' | 'cancelled' | 'all'>('scheduled');
  const [presetBusinessId, setPresetBusinessId] = useState<string | undefined>(undefined);

  const listQuery = useMemo(
    () => ({ state: stateFilter === 'all' ? undefined : stateFilter, sort: 'scheduledFor' as const, order: stateFilter === 'scheduled' ? ('asc' as const) : ('desc' as const), pageSize: 100 }),
    [stateFilter]
  );
  const weekQuery = useMemo(
    () => ({ from: f.toIso(`${start}T00:00`), to: f.toIso(`${addDaysKey(start, 7)}T00:00`), sort: 'scheduledFor' as const, pageSize: 100 }),
    [f, start]
  );
  const closedQuery = useMemo(() => ({ state: 'completed' as const, pageSize: 1 }), []);

  const main = useFollowUps(view === 'list' ? listQuery : weekQuery);
  const closed = useFollowUps(view === 'list' ? closedQuery : null);
  const { data: queue } = useQueue();
  const businesses = (queue?.items ?? []).map((i) => ({ id: i.businessId, name: i.businessName }));
  const callbackBusinesses = (queue?.items ?? []).filter((i) => i.callbackMarker && !i.openFollowUp).map((i) => ({ id: i.businessId, name: i.businessName }));

  const reload = () => {
    void main.mutate();
    void closed.mutate();
  };
  const openReschedule = (fu: FollowUpDto) => {
    setTarget(fu);
    setDrawer('reschedule');
  };

  const items = main.data?.items ?? [];
  // After a 409 the lists reload; the drawer and dialog then send the fresh version (typed values are kept).
  const live = (fu: FollowUpDto | null) => (fu ? (items.find((i) => i.id === fu.id) ?? fu) : null);
  const truncated = (main.data?.total ?? 0) > items.length;
  const weekLabel = `${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${start}T12:00:00Z`))} – ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${addDaysKey(start, 6)}T12:00:00Z`))}`;

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1200px] mx-auto">
        <CallingPageHeader
          title="Follow-ups & Calendar"
          subtitle={view === 'week' ? `Week of ${weekLabel} · company timezone` : `${f.dateLabel(new Date())} · your callback commitments · company timezone`}
          actions={
            <>
              <Tabs
                style="segmented"
                activeId={view}
                onChange={(id) => setView(id as 'list' | 'week')}
                items={[
                  { id: 'list', label: 'List' },
                  { id: 'week', label: 'Week' },
                ]}
              />
              <Button
                leadingIcon={<Icon name="plus" size={16} />}
                onClick={() => {
                  setTarget(null);
                  setPresetBusinessId(undefined);
                  setDrawer('create');
                }}
              >
                Schedule follow-up
              </Button>
            </>
          }
        />

        {main.isLoading && <LoadingBlock />}
        {main.error && !main.data && <ApiErrorView route={main.route} onRetry={main.retry} area="follow-ups" what="follow-ups" backHref="/queue" backLabel="Back to Calling Queue" />}

        {main.data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {view === 'week' && (
                <div className="flex items-center gap-2 mr-auto">
                  <Button variant="secondary" size="sm" aria-label="Previous week" onClick={() => setWeekStart(addDaysKey(start, -7))}>
                    <Icon name="chevron-left" size={16} />
                  </Button>
                  <span className="text-sm font-medium text-text-primary">{weekLabel}</span>
                  <Button variant="secondary" size="sm" aria-label="Next week" onClick={() => setWeekStart(addDaysKey(start, 7))}>
                    <Icon name="chevron-right" size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setWeekStart(null)}>
                    Today
                  </Button>
                </div>
              )}
              <span className={view === 'week' ? '' : 'ml-auto'}>
                <DerivedChip>Due today and Overdue are derived</DerivedChip>
              </span>
              <OverdueThresholdChip />
            </div>

            {view === 'list' && (
              <div role="group" aria-label="Follow-up state" className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['scheduled', 'Open'],
                    ['completed', 'Completed'],
                    ['cancelled', 'Cancelled'],
                    ['all', 'All'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={stateFilter === id}
                    onClick={() => setStateFilter(id)}
                    className={`h-8 px-3 rounded-full border text-[13px] font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      stateFilter === id ? 'bg-status-brand-bg border-border-selected text-status-brand-fg' : 'bg-surface-default border-border-default text-text-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {truncated && <p className="text-[13px] text-text-muted">Showing the first {items.length} of {main.data?.total} follow-ups. Narrow the state or week to see the rest.</p>}

            {view === 'list' ? (
              items.length === 0 && !(stateFilter === 'scheduled' && callbackBusinesses.length > 0) ? (
                <StateView
                  type="empty"
                  size="page"
                  title={stateFilter === 'scheduled' ? 'No open follow-ups' : 'No follow-ups in this state'}
                  body="Schedule a follow-up from a contact, or use Schedule follow-up."
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
                  <FollowUpGroups
                    items={items}
                    completedCount={closed.data ? closed.data.total : null}
                    flat={stateFilter !== 'scheduled'}
                    callbackBusinesses={stateFilter === 'scheduled' || stateFilter === 'all' ? callbackBusinesses : []}
                    onScheduleCallback={(id) => {
                      setTarget(null);
                      setPresetBusinessId(id);
                      setDrawer('create');
                    }}
                    onReschedule={openReschedule}
                    onComplete={(fu) => setCommand({ kind: 'complete', fu })}
                    onCancel={(fu) => setCommand({ kind: 'cancel', fu })}
                  />
                  <div className="flex flex-col gap-2">
                    <DayAgenda items={items} />
                    <p className="text-[13px] text-text-muted">Reminders never change a follow-up (D5).</p>
                  </div>
                </div>
              )
            ) : (
              <>
                <WeekGrid items={items} weekStart={start} onOpen={(fu) => (fu.state === 'scheduled' ? openReschedule(fu) : undefined)} />
                <p className="text-[13px] text-text-muted">Cancelled follow-ups are not shown on the calendar. Select an event to open it; Reschedule opens the drawer.</p>
              </>
            )}
          </>
        )}
      </div>

      <FollowUpDrawer mode={drawer} target={live(target)} businesses={businesses} callbackIds={callbackBusinesses.map((b) => b.id)} presetBusinessId={presetBusinessId} onClose={() => setDrawer(null)} onChanged={reload} />
      <FollowUpCommandDialog command={command?.kind ?? 'cancel'} target={live(command?.fu ?? null)} onClose={() => setCommand(null)} onChanged={reload} />
    </AppShell>
  );
}
