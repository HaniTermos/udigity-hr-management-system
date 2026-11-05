'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { DateInput, Select } from '@/components/ui/Input';
import { EmptyState, LoadErrorState, LoadingState } from '@/components/states';
import { AttendanceTable, SummaryTiles } from '@/components/attendance/AttendanceTable';
import { CorrectionDrawer } from '@/components/attendance/CorrectionDrawer';
import { dayLabel, periodRange, type Period } from '@/components/attendance/format';
import { latestBySession, useMyCorrections, useMySessions, useToday } from '@/components/attendance/hooks';
import type { AttendanceSessionDto } from '@/lib/api/attendance';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

/** SCR-SHR-004 My Attendance, with the correction request drawer (SCR-SHR-005). */
export default function MyAttendancePage() {
  const router = useRouter();
  const time = useCompanyTime();
  const today = useToday();
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selected, setSelected] = useState<AttendanceSessionDto | null>(null);

  const anchor = today.data?.date;
  const range = anchor && period !== 'custom' ? periodRange(period, anchor) : { from: customFrom || undefined, to: customTo || undefined };
  const ready = Boolean(anchor) && (period !== 'custom' || Boolean(customFrom && customTo));
  const sessions = useMySessions({ ...range, pageSize: 50 }, ready);
  const corrections = useMyCorrections(Boolean(today.data));
  const latest = React.useMemo(() => latestBySession(corrections.data?.items), [corrections.data]);

  const employeeRequests = today.data?.employeeRequestsEnabled ?? false;
  const earlier = today.data?.openSessionFromEarlierDay;
  const mutateCorrections = corrections.mutate;
  const mutateSessions = sessions.mutate;
  const mutateToday = today.mutate;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4 pb-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-8 text-text-primary">My Attendance</h1>
            <p className="text-sm text-text-secondary">Your sessions, hours and punctuality</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Period" options={PERIODS} value={period} onChange={(e) => setPeriod(e.target.value as Period)} />
            {period === 'custom' && (
              <div className="flex items-end gap-2">
                <DateInput label="From" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <DateInput label="To" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {sessions.data && <SummaryTiles summary={sessions.data.summary} />}

        {earlier && (
          <Alert
            tone="warning"
            title={`${dayLabel(earlier.workDate, 'short')} has no checkout`}
            body="The session is still open, so check-in is blocked today. It is never closed automatically."
          />
        )}

        {today.error || sessions.error ? (
          <LoadErrorState what="your attendance" onRetry={() => { void mutateToday(); void mutateSessions(); }} />
        ) : !ready && period === 'custom' ? (
          <EmptyState title="Choose a date range" body="Pick a start and end date to see your sessions." />
        ) : !sessions.data || !today.data ? (
          <LoadingState rows={6} />
        ) : sessions.data.items.length === 0 ? (
          <EmptyState
            title="No sessions in this period"
            body="Your sessions appear here after you check in."
            action={<Button onClick={() => router.push('/my-day')}>Go to My Day</Button>}
          />
        ) : (
          <AttendanceTable
            sessions={sessions.data.items}
            todayKey={today.data.date}
            employeeRequests={employeeRequests}
            corrections={latest}
            time={time}
            onOpen={setSelected}
          />
        )}

        <CorrectionDrawer
          session={selected}
          correction={selected ? latest.get(selected.id) : undefined}
          employeeRequests={employeeRequests}
          onClose={() => setSelected(null)}
          onSubmitted={() => {
            void mutateSessions();
            void mutateToday();
            void mutateCorrections();
          }}
        />
      </div>
    </AppShell>
  );
}
