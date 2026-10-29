'use client';

import React from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardInset, CardSection } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { ProgressBar } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/State';
import { EmptyState, LoadErrorState } from '@/components/states';
import type { CompanyTime } from '@/lib/hooks/useCompanyTime';
import type { MyTargetsDto, WorkListDto } from '@/lib/api/myDay';
import type { AttendanceTodayDto } from '@/lib/api/attendance';
import { PUNCTUALITY_LABEL, formatHM, formatHMS, verificationText } from './format';
import { useElapsedSeconds } from './hooks';

/** SCR-SHR-001 left card: elapsed time toward the confirmed 9 h workday and the check-in / check-out action. */
export function AttendanceCard({
  today,
  time,
  onCheckIn,
  onCheckOut,
}: {
  today: AttendanceTodayDto;
  time: CompanyTime;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const session = today.session;
  const blocked = Boolean(today.openSessionFromEarlierDay);
  const open = session?.state === 'open';
  const elapsed = useElapsedSeconds(session);
  const workday = session?.requiredMinutes ?? 540;
  const percent = (elapsed / 60 / workday) * 100;

  const chip = open ? (
    <Badge tone="success" hasDot>
      Checked in
    </Badge>
  ) : session ? (
    <Badge tone={session.state === 'closed' ? 'neutral' : 'warning'} hasDot>
      {session.state === 'closed' ? 'Checked out' : session.state === 'closed_provisional' ? 'Provisional' : 'Pending review'}
    </Badge>
  ) : (
    <Badge tone="neutral" hasDot>
      Not checked in
    </Badge>
  );

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold leading-6 text-text-primary">Attendance</h2>
        {chip}
      </div>

      <div className="text-center" aria-live="off">
        <p className="text-[13px] text-text-muted">Elapsed today</p>
        <p className="text-5xl leading-[56px] font-bold tabular-nums tracking-tight text-text-primary" aria-label={`Elapsed ${formatHM(elapsed / 60)}`}>
          {formatHMS(elapsed)}
        </p>
        <p className="text-[13px] text-text-secondary">
          {session ? (open ? `Since ${time.formatTime(session.effectiveCheckInAt)} · today` : `${time.formatTime(session.effectiveCheckInAt)} to ${session.effectiveCheckOutAt ? time.formatTime(session.effectiveCheckOutAt) : '—'}`) : !today.configured
              ? 'Attendance is not set up yet'
              : today.workingDay
                ? 'Not checked in yet today'
                : today.nonWorkingReason === 'day_off'
                  ? 'Approved day off'
                  : 'Not a working day'}
        </p>
      </div>

      <ProgressBar
        percent={percent}
        label="Toward 9 h workday"
        value={session ? `${formatHM(elapsed / 60)} of ${Math.round(workday / 60)}h` : `0h of ${Math.round(workday / 60)}h`}
      />

      {open && session && (
        <Alert
          tone={session.remote ? 'warning' : 'info'}
          title={verificationText(session.verification.checkIn)}
          body={`${time.formatTime(session.checkInAt)} · at check-in`}
        />
      )}

      {open ? (
        <>
          <Button variant="secondary" size="lg" fullWidth onClick={onCheckOut} disabled={!today.canCheckOut}>
            Check out
          </Button>
          {!today.canCheckOut && session.missingCheckout && (
            <p className="text-[13px] text-text-secondary">This session is flagged as a missing checkout. Send a correction request with your checkout time from My Attendance.</p>
          )}
        </>
      ) : session ? (
        <p className="text-sm text-text-secondary">You have checked out for today.</p>
      ) : (
        <Button size="lg" fullWidth onClick={onCheckIn} disabled={blocked || !today.canCheckIn} aria-describedby={blocked ? 'checkin-blocked' : undefined}>
          Check in
        </Button>
      )}
      {blocked && (
        <p id="checkin-blocked" className="sr-only">
          Check-in is blocked until the open session from an earlier day is corrected.
        </p>
      )}

      <div>
        <PolicyPendingChip dec="DEC-009" demo />
      </div>
    </Card>
  );
}

/** Second left card: how the check-in was classified, or why check-in is blocked, plus the policy notes. */
export function CheckInNote({ today, time }: { today: AttendanceTodayDto; time: CompanyTime }) {
  const session = today.session;
  const earlier = today.openSessionFromEarlierDay;

  if (earlier && !session) {
    return (
      <NoticePolicy
        dec="DEC-011"
        demo
        body={
          today.employeeRequestsEnabled
            ? 'Demonstration setting: you can send a correction request from My Attendance. The Owner decides it.'
            : 'Demonstration setting: the Owner corrects the open session and you are notified.'
        }
      />
    );
  }

  return (
    <CardInset className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
        <Icon name="clock" size={16} className="text-icon-muted" />
        {session ? (
          <>
            <span>Check-in {time.formatTime(session.effectiveCheckInAt)}</span>
            <span>
              · {PUNCTUALITY_LABEL[session.punctuality]}
              {session.punctuality === 'late' ? ` (${session.lateMinutes} min)` : ''}
            </span>
            <Badge derived>Derived</Badge>
          </>
        ) : (
          <span>Punctuality is derived when you check in</span>
        )}
      </div>
      <NoticePolicy
        dec="DEC-007/008"
        demo
        body={
          today.configured && today.schedule.shiftStart
            ? `Schedule start ${today.schedule.shiftStart} and ${today.schedule.graceMinutes ?? '—'} min grace are demonstration values. The 9 h workday is confirmed; "On time" is derived.`
            : 'Schedule start and grace are not configured, so punctuality shows Unclassified. The 9 h workday is confirmed.'
        }
      />
      <p className="text-[13px] text-text-muted">
        {today.summaryRule.required ? 'At checkout you add a work summary.' : 'At checkout a work summary is optional.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <PolicyPendingChip dec="DEC-012" demo />
        <PolicyPendingChip dec="DEC-022" demo />
      </div>
    </CardInset>
  );
}

export function AttendanceCardSkeleton() {
  return (
    <Card className="p-5 flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading attendance</span>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-14 w-2/3 mx-auto" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-12 w-full" />
    </Card>
  );
}

/** SCR-SHR-001 "Today's targets": progress toward targets the Owner set. */
export function TargetsCard({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data: MyTargetsDto | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <CardSection title="Today’s targets" subtitle="Set by the Owner">
      <div className="flex flex-wrap gap-2">
        <PolicyPendingChip dec="DEC-020" demo />
        <PolicyPendingChip dec="DEC-025" demo />
      </div>
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : error ? (
        <LoadErrorState what="your targets" onRetry={onRetry} />
      ) : !data || data.targets.length === 0 ? (
        <EmptyState title="No targets set for today" body="The Owner has not set targets for you today." />
      ) : (
        <div className="space-y-4">
          {data.targets.map((t) => (
            <ProgressBar
              key={t.key}
              label={t.label}
              value={`${t.done} of ${t.target}`}
              percent={t.target > 0 ? (t.done / t.target) * 100 : 0}
            />
          ))}
        </div>
      )}
    </CardSection>
  );
}

const STATUS_TONE: Record<string, 'warning' | 'neutral' | 'info'> = { 'In progress': 'info' };

/** SCR-SHR-001 "My work list": works without check-in (contract A1, no gating). */
export function WorkListCard({
  data,
  isLoading,
  error,
  onRetry,
  time,
}: {
  data: WorkListDto | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  time: CompanyTime;
}) {
  const shown = data?.items.length ?? 0;
  return (
    <CardSection
      title="My work list"
      subtitle={data ? (data.total > shown ? `Showing ${shown} of ${data.total} items · works without check-in` : `${data.total} items · works without check-in`) : 'Works without check-in'}
      action={
        <Link href="/queue" className="text-text-link hover:underline">
          Open queue
        </Link>
      }
    >
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <LoadErrorState what="your work list" onRetry={onRetry} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No work assigned today" body="Your Owner has not assigned a work list yet. Check back later." />
      ) : (
        <ul className="divide-y divide-border-subtle -my-2">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span aria-hidden className="w-9 h-9 shrink-0 rounded-full bg-brand-accent-subtle text-brand-accent-strong flex items-center justify-center">
                  <Icon name={item.dueAt ? 'calendar' : 'check-circle'} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary truncate">{item.title}</span>
                  {(item.detail || item.dueAt) && (
                    <span className="block text-[13px] text-text-muted truncate">
                      {item.detail || `Due ${time.formatDate(item.dueAt as string)}`}
                    </span>
                  )}
                </span>
                <Badge tone={STATUS_TONE[item.statusLabel] ?? 'neutral'}>{item.statusLabel}</Badge>
                <Icon name="chevron-right" size={16} className="text-icon-muted shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div>
        <PolicyPendingChip dec="DEC-021" demo />
      </div>
    </CardSection>
  );
}
