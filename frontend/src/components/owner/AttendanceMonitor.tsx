'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { DateInput, Select } from '@/components/ui/Input';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { SkeletonCard, SkeletonTableRow, StateView } from '@/components/ui/State';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import {
  getAttendanceOverview,
  overviewKey,
  type AttendanceException,
  type AttendanceOverview,
  type MonitorRow,
  type MonitorStatus,
  type OverviewQuery,
  type VerificationState,
} from '@/lib/api/attendanceOwner';
import type { Punctuality } from '@/lib/api/attendance';
import { ApiError } from '@/lib/api/client';
import { employeesListKey, listEmployees } from '@/lib/api/employees';
import { formatClock, formatWeekdayDay, useCompanyTimezone } from './format';

const STATUS: Record<MonitorStatus, { label: string; tone: BadgeTone }> = {
  checked_in: { label: 'Checked in', tone: 'success' },
  checked_out: { label: 'Checked out', tone: 'neutral' },
  open_previous: { label: 'Open since', tone: 'warning' },
  not_checked_in: { label: 'Not checked in yet', tone: 'neutral' },
};

const VERIFICATION: Record<VerificationState, { primary: string; secondary: string }> = {
  recorded: { primary: 'Recorded', secondary: 'mode unknown' },
  remote: { primary: 'Remote', secondary: 'if adopted' },
  blocked: { primary: 'Check-in blocked', secondary: 'until corrected' },
  none: { primary: '—', secondary: '' },
};

const linkButton =
  'inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium bg-surface-default text-text-primary border border-border-strong ' +
  'hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

function PunctualityCell({ value }: { value: Punctuality | null }) {
  if (value === 'non_working_day') return <span className="text-xs text-text-muted">Non-working day</span>;
  if (value === 'late') return <Badge tone="warning">Late</Badge>;
  if (value === 'on_time') return <Badge tone="success">On time</Badge>;
  if (value === 'unclassified') {
    return (
      <Badge tone="neutral" derived>
        Unclassified
      </Badge>
    );
  }
  return <span className="text-text-muted">—</span>;
}

export function AttendanceMonitor() {
  const [date, setDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const timeZone = useCompanyTimezone();
  const query: OverviewQuery = { date, employeeId };
  const { data, error, isLoading, mutate } = useSWR<AttendanceOverview>(overviewKey(query), () => getAttendanceOverview(query), {
    refreshInterval: 60_000,
  });

  const peopleQuery = { pageSize: 100 };
  const { data: people } = useSWR(employeesListKey(peopleQuery), () => listEmployees(peopleQuery), { revalidateOnFocus: false });
  const options = (people?.items ?? []).filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.fullName }));
  const denied = error instanceof ApiError && (error.isPermissionDenied || error.code === 'OWNER_2FA_REQUIRED');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Attendance</h1>
          <p className="text-[13px] text-text-secondary mt-1">
            {data ? `${formatWeekdayDay(data.asOf, timeZone)} · ${formatClock(data.asOf, timeZone)} company time · live` : 'Company time · live'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <DateInput label="Date" value={date} onChange={(e) => setDate(e.target.value)} wrapperClassName="sm:w-48" />
          <Select
            label="Employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="All employees"
            options={options}
            wrapperClassName="sm:w-52"
          />
          <Link href="/attendance/corrections" className={linkButton}>
            Corrections &amp; review
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="rounded-xl border border-border-default bg-surface-default">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </div>
        </div>
      ) : error || !data ? (
        <StateView
          type="error"
          title={denied ? 'Owners only' : undefined}
          body={denied ? 'Attendance monitoring needs an Owner session with two-factor verification.' : undefined}
          action={
            denied ? undefined : (
              <Button variant="secondary" onClick={() => mutate()}>
                Try again
              </Button>
            )
          }
        />
      ) : (
        <Loaded data={data} timeZone={timeZone} filtered={Boolean(employeeId)} />
      )}
    </div>
  );
}

function Loaded({ data, timeZone, filtered }: { data: AttendanceOverview; timeZone: string; filtered: boolean }) {
  const s = data.summary;
  const configured = data.scheduleConfigured;
  return (
    <>
      <section aria-label="Today at a glance" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric
          value={s.expected !== null ? `${s.checkedIn} of ${s.expected}` : String(s.checkedIn)}
          label="Checked in now"
          note={s.firstCheckIn && s.lastCheckIn ? `In ${formatClock(s.firstCheckIn, timeZone)}–${formatClock(s.lastCheckIn, timeZone)}` : 'No check-ins yet'}
        />
        <Metric value={String(s.checkedOut)} label="Checked out" note="Sessions closed today" />
        <Metric
          value={!configured || s.notCheckedIn === null ? '—' : String(s.notCheckedIn)}
          label="Not checked in yet"
          note={configured ? 'Scheduled today, no check-in' : 'Not configured · policy pending (DEC-008)'}
        />
        <Metric
          value={String(s.missingCheckout)}
          label="Missing checkout"
          note={data.rows.find((r) => r.missingCheckout)?.employeeName ?? 'None open'}
          tone={s.missingCheckout > 0 ? 'warning' : undefined}
        />
        <Metric
          value={!configured || s.lateArrivals === null ? '—' : String(s.lateArrivals)}
          label="Late arrivals"
          note={configured ? 'After grace period' : 'Not configured · policy pending (DEC-008)'}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="min-w-0 space-y-3">
          {data.rows.length === 0 ? (
            <StateView
              type={filtered ? 'no-results' : 'empty'}
              title={filtered ? 'No attendance for this employee' : 'No employees to show'}
              body={filtered ? 'Choose “All employees” to see everyone.' : 'Active employees appear here once they exist.'}
            />
          ) : (
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH>Employee</TH>
                    <TH>Status</TH>
                    <TH>In</TH>
                    <TH>Out</TH>
                    <TH>Verification</TH>
                    <TH>Punctuality</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.rows.map((r) => (
                    <MonitorTableRow key={r.employeeId} row={r} timeZone={timeZone} />
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </div>

        <ExceptionsPanel exceptions={data.exceptions} />
      </div>
    </>
  );
}

function Metric({ value, label, note, tone, chip }: { value: string; label: string; note: string; tone?: 'warning'; chip?: string }) {
  return (
    <Card className="p-4 space-y-1 min-h-[112px]">
      <div className={tone === 'warning' ? 'text-3xl font-semibold tabular-nums text-status-warning-fg' : 'text-3xl font-semibold tabular-nums text-text-primary'}>{value}</div>
      <div className="text-[13px] font-medium text-text-primary">{label}</div>
      <div className="text-xs text-text-muted">{note}</div>
      {chip && <PolicyPendingChip dec={chip} demo />}
    </Card>
  );
}

function MonitorTableRow({ row: r, timeZone }: { row: MonitorRow; timeZone: string }) {
  const st = STATUS[r.status];
  const base = VERIFICATION[r.verification];
  const checkInVerification = r.session?.verification.checkIn;
  const v =
    r.verification === 'recorded' && checkInVerification
      ? { primary: 'Recorded', secondary: `mode ${checkInVerification.mode ?? 'unknown'}` }
      : base;
  return (
    <TR className="border-t border-border-subtle" interactive={false}>
      <TD>
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={r.employeeName} size="sm" tone="neutral" />
          <span className="font-semibold text-text-primary truncate">{r.employeeName}</span>
        </div>
      </TD>
      <TD>
        <Badge tone={st.tone} hasDot={r.status === 'checked_in'}>
          {r.status === 'open_previous' && r.openSince ? `${st.label} ${formatWeekdayDay(r.openSince, timeZone).split(' ').slice(1).join(' ')}` : st.label}
        </Badge>
      </TD>
      <TD>
        {r.checkInAt ? (
          <>
            <span className="tabular-nums">{formatClock(r.checkInAt, timeZone)}</span>
            {r.status === 'open_previous' && <div className="text-xs text-text-muted">{formatWeekdayDay(r.checkInAt, timeZone)}</div>}
          </>
        ) : (
          '—'
        )}
      </TD>
      <TD>{r.checkOutAt ? <span className="tabular-nums">{formatClock(r.checkOutAt, timeZone)}</span> : '—'}</TD>
      <TD meta={v.secondary || undefined}>{v.primary}</TD>
      <TD>
        {r.missingCheckout ? (
          <Badge tone="warning" icon="flag">
            Missing checkout
          </Badge>
        ) : (
          <PunctualityCell value={r.punctuality} />
        )}
      </TD>
    </TR>
  );
}

const EXCEPTION_ICON: Record<AttendanceException['kind'], { icon: 'alert-triangle' | 'alert-circle' | 'info'; className: string }> = {
  missing_checkout: { icon: 'alert-triangle', className: 'text-status-warning-fg' },
  checkin_alerts_off: { icon: 'info', className: 'text-text-muted' },
};

function ExceptionsPanel({ exceptions }: { exceptions: AttendanceException[] }) {
  const count = exceptions.filter((e) => e.kind !== 'checkin_alerts_off').length;
  return (
    <Card className="p-5 space-y-4" aria-labelledby="exceptions-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="exceptions-title" className="text-base font-semibold text-text-primary">
          Exceptions &amp; alerts · {count}
        </h2>
        <Link href="/attendance/corrections" className="text-[13px] font-medium text-text-link hover:underline">
          Review all
        </Link>
      </div>
      {exceptions.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No exceptions. Alerts appear here when a session stays open or a check-in is missing.</p>
      ) : (
        <ul className="space-y-4">
          {exceptions.map((e) => {
            const ic = EXCEPTION_ICON[e.kind];
            return (
              <li key={e.id} className="flex items-start gap-2.5">
                <Icon name={ic.icon} size={16} className={`mt-0.5 shrink-0 ${ic.className}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text-primary">{e.title}</div>
                  <div className="text-xs text-text-secondary">{e.detail}</div>
                </div>
                {e.kind === 'missing_checkout' && (
                  <Link href="/attendance/corrections" className="shrink-0 text-[13px] font-medium text-text-link hover:underline">
                    Review
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <PolicyPendingChip dec="DEC-007" demo />
        <PolicyPendingChip dec="DEC-008" demo />
        <PolicyPendingChip dec="DEC-022" demo />
      </div>
      <NoticePolicy size="block" dec="No DEC ID" body="Alert recipients, timing and escalation are not decided." />
    </Card>
  );
}
