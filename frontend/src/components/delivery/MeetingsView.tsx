'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Input';
import { Skeleton, StateView } from '@/components/ui/State';
import { useApi } from '@/lib/hooks/useApi';
import { cn } from '@/lib/utils';
import { addDaysKey, useCallingFormat, weekStartKey, type CallingFormat } from '@/components/calling/format';
import { meetingListPath, type Meeting, type MeetingStatus } from '@/lib/api/meetings';
import { describeMeeting, MeetingDrawer, MEETING_CONFLICT_LABELS } from './MeetingDrawer';
import { ScheduleMeetingDrawer } from './ScheduleMeetingDrawer';
import {
  type ConflictSnapshot,
  DeliveryConflict,
  fmtDayMonth,
  fmtTime,
  LoadError,
  MEETING_STATUS_LABEL,
  MEETING_TONE,
  PageTitle } from './shared';

const FIRST_HOUR = 9;
const LAST_HOUR = 17;
const HOUR_PX = 60;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** `15` -> 15:00, `9.5` -> 09:30, read from the company-zone local time `YYYY-MM-DDTHH:mm`. */
function hourOfLocal(local: string): number {
  return Number(local.slice(11, 13)) + Number(local.slice(14, 16)) / 60;
}

function dayNumber(key: string): number {
  return Number(key.slice(8, 10));
}

/** The end of a meeting; the API allows a meeting without one (drawn as one hour). */
function endOf(m: Meeting): string {
  return m.endsAt ?? new Date(new Date(m.startsAt).getTime() + 3_600_000).toISOString();
}

const STATUS_OPTIONS = [
  { value: 'any', label: 'Status: Any' },
  ...(Object.keys(MEETING_STATUS_LABEL) as MeetingStatus[]).map((s) => ({ value: s, label: MEETING_STATUS_LABEL[s] })),
];

export function MeetingsView() {
  const [view, setView] = useState<'week' | 'list'>('week');
  const fmt = useCallingFormat();
  // The week is a company-zone calendar date (Monday), moved by date arithmetic, so a DST change never shifts it (B-10).
  const [weekPick, setWeekPick] = useState<string | null>(null);
  const weekStart = weekPick ?? weekStartKey(fmt.todayKey());
  const [mine, setMine] = useState(true);
  const [status, setStatus] = useState<MeetingStatus | 'any'>('any');
  const [open, setOpen] = useState<Meeting | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [conflict, setConflict] = useState<{ meetingId: string; snapshot: ConflictSnapshot } | null>(null);

  const path = useMemo(
    () =>
      meetingListPath({
        from: fmt.toIso(`${weekStart}T00:00`),
        to: fmt.toIso(`${addDaysKey(weekStart, 7)}T00:00`),
        mine,
        status,
      }),
    [fmt, weekStart, mine, status]
  );
  const { data, error, isLoading, retry } = useApi<{ items: Meeting[] }>(path);
  const meetings = data?.items;

  const weekEnd = addDaysKey(weekStart, 6);
  const rangeLabel = `${dayNumber(weekStart)} – ${fmtDayMonth(fmt.toIso(`${weekEnd}T12:00`))} ${weekEnd.slice(0, 4)}`;
  const shift = (days: number) => setWeekPick(addDaysKey(weekStart, days));

  const latest = conflict ? meetings?.find((m) => m.id === conflict.meetingId) : undefined;

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      <PageTitle
        title="Meetings & calendar"
        description="Meetings on deals you can access. Rescheduling keeps the previous time in the meeting history."
        aside={
          <>
            <Button variant="secondary" leadingIcon={<Icon name="plus" size={16} />} onClick={() => setScheduling(true)}>
              Schedule meeting
            </Button>
          </>
        }
      />

      {conflict && (
        <DeliveryConflict
          snapshot={conflict.snapshot}
          latest={latest ? describeMeeting(latest) : {}}
          latestUpdatedAt={latest?.updatedAt ?? new Date().toISOString()}
          onReapply={() => {
            setConflict(null);
            if (latest) setOpen(latest);
          }}
          onReload={() => setConflict(null)}
          onCancel={() => setConflict(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex p-1 rounded-lg bg-surface-sunken border border-border-subtle text-sm">
          {(['week', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'h-8 px-3 rounded-md cursor-pointer capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                view === v ? 'bg-surface-default text-text-primary shadow-elevation-1 font-medium' : 'text-text-secondary hover:bg-surface-hover'
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <IconButton icon="chevron-left" label="Previous week" variant="secondary" onClick={() => shift(-7)} />
        <IconButton icon="chevron-right" label="Next week" variant="secondary" onClick={() => shift(7)} />
        <Button variant="ghost" size="sm" onClick={() => setWeekPick(null)}>
          Today
        </Button>
        <span className="text-sm font-semibold text-text-primary tabular-nums">{rangeLabel}</span>
        <div className="sm:ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => setMine((v) => !v)}
            className={cn(
              'h-8 px-3 rounded-md border text-[13px] font-medium cursor-pointer inline-flex items-center gap-1.5',
              mine ? 'bg-status-brand-bg border-status-brand-border text-status-brand-fg' : 'bg-surface-default border-border-strong text-text-primary'
            )}
          >
            My meetings
            {mine && <Icon name="x" size={12} />}
          </button>
          <Select
            aria-label="Meeting status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as MeetingStatus | 'any')}
          />
        </div>
      </div>

      {error ? (
        <LoadError error={error} onRetry={() => void retry()} backHref="/deals" backLabel="Back to Deals" what="meetings" />
      ) : isLoading || !meetings ? (
        <div aria-busy="true" className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : meetings.length === 0 ? (
        <StateView type="empty" title="No meetings this week" body="Meetings on deals you can access will appear here." />
      ) : view === 'week' ? (
        <>
          {/* Phones get the list: the week grid needs a wide screen. */}
          <div className="hidden md:block">
            <WeekGrid weekStart={weekStart} meetings={meetings} onOpen={setOpen} fmt={fmt} />
          </div>
          <div className="md:hidden">
            <MeetingList meetings={meetings} onOpen={setOpen} />
          </div>
        </>
      ) : (
        <MeetingList meetings={meetings} onOpen={setOpen} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info" hasDot>
          Scheduled
        </Badge>
        <Badge tone="success" hasDot>
          Held
        </Badge>
        <Badge tone="danger" hasDot derived>
          Outcome due: awaiting outcome
        </Badge>
        <Badge tone="neutral" derived>
          Upcoming
        </Badge>
      </div>
      <p className="text-[13px] text-text-muted">Cancelled and Missed meetings are listed in List view.</p>

      <MeetingDrawer
        meeting={open}
        onClose={() => setOpen(null)}
        onChanged={() => void retry()}
        onConflict={(m, mineFields) => {
          setConflict({
            meetingId: m.id,
            snapshot: {
              entity: 'meeting',
              labels: MEETING_CONFLICT_LABELS,
              base: describeMeeting(m),
              mine: { ...describeMeeting(m), ...mineFields },
              baseUpdatedAt: m.updatedAt,
            },
          });
          void retry();
        }}
      />
      {scheduling && <ScheduleMeetingDrawer onClose={() => setScheduling(false)} onScheduled={() => void retry()} />}
    </div>
  );
}

function eventStyle(m: Meeting): { box: string; label: string; icon: 'users' | 'check' | 'alert-circle' } {
  if (m.status === 'held') return { box: 'bg-surface-sunken border-status-neutral-solid text-text-secondary', label: 'Held', icon: 'check' };
  if (m.awaitingOutcome) return { box: 'bg-status-danger-bg border-status-danger-solid text-status-danger-fg', label: 'Outcome due', icon: 'alert-circle' };
  return { box: 'bg-status-info-bg border-status-info-solid text-status-info-fg', label: '', icon: 'users' };
}

function WeekGrid({ weekStart, meetings, onOpen, fmt }: { weekStart: string; meetings: Meeting[]; onOpen: (m: Meeting) => void; fmt: CallingFormat }) {
  const days = DAY_NAMES.map((n, i) => ({ name: n, key: addDaysKey(weekStart, i) }));
  const todayKey = fmt.todayKey();
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  return (
    <div className="rounded-xl border border-border-default bg-surface-default overflow-x-auto" tabIndex={0} role="region" aria-label="Week calendar (scrolls sideways)">
      <div className="min-w-[860px] grid grid-cols-[56px_repeat(7,1fr)]">
        <div className="border-b border-border-subtle" />
        {days.map((d) => {
          const today = d.key === todayKey;
          return (
            <div key={d.name} className="h-10 flex items-center justify-center gap-2 text-[13px] border-b border-l border-border-subtle text-text-secondary">
              <span className={cn(today && 'px-2 py-0.5 rounded-full bg-surface-inverse text-text-inverse font-medium')}>
                {d.name} {dayNumber(d.key)}
              </span>
              {today && <span className="text-text-link">Today</span>}
            </div>
          );
        })}
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <span key={h} className="absolute right-2 text-xs text-text-muted tabular-nums" style={{ top: i * HOUR_PX + 4 }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d.name} className="relative border-l border-border-subtle" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute inset-x-0 border-t border-border-subtle" style={{ top: i * HOUR_PX }} />
            ))}
            {meetings
              .filter((m) => m.status !== 'cancelled' && m.status !== 'missed' && fmt.dayKey(m.startsAt) === d.key)
              .map((m) => {
                const s = new Date(m.startsAt);
                const e = new Date(endOf(m));
                const top = Math.max(0, (hourOfLocal(fmt.toLocal(m.startsAt)) - FIRST_HOUR) * HOUR_PX);
                const height = Math.max(36, ((e.getTime() - s.getTime()) / 3_600_000) * HOUR_PX - 2);
                const st = eventStyle(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onOpen(m)}
                    className={cn(
                      'absolute left-1 right-1 rounded-sm border-l-[3px] px-2 py-1 text-left text-xs leading-4 overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      st.box
                    )}
                    style={{ top, height }}
                  >
                    <span className="flex items-center gap-1 tabular-nums">
                      <Icon name={st.icon} size={12} />
                      {fmtTime(m.startsAt)}
                      {m.status === 'held' || m.awaitingOutcome ? ` · ${st.label}` : `–${fmtTime(endOf(m))}`}
                    </span>
                    <span className="block font-medium text-text-primary truncate">{m.businessName ?? m.dealCode}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingList({ meetings, onOpen }: { meetings: Meeting[]; onOpen: (m: Meeting) => void }) {
  const sorted = [...meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <ul className="rounded-xl border border-border-default bg-surface-default divide-y divide-border-subtle">
      {sorted.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => onOpen(m)}
            className="w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text-primary truncate">
                {m.businessName ?? m.dealCode}
                {m.title ? ` · ${m.title}` : ''}
              </span>
              <span className="block text-[13px] text-text-muted tabular-nums">
                {fmtDayMonth(m.startsAt)} · {fmtTime(m.startsAt)}
                {m.endsAt ? `–${fmtTime(m.endsAt)}` : ''} · {m.attendees.length} attendee{m.attendees.length === 1 ? '' : 's'}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {m.awaitingOutcome && (
                <Badge tone="danger" derived>
                  Outcome due
                </Badge>
              )}
              <Badge tone={MEETING_TONE[m.status]} hasDot>
                {MEETING_STATUS_LABEL[m.status]}
              </Badge>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
