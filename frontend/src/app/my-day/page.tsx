'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { LoadErrorState } from '@/components/states';
import { AttendanceCard, AttendanceCardSkeleton, CheckInNote, TargetsCard, WorkListCard } from '@/components/attendance/MyDayCards';
import { BreakTimerCard } from '@/components/attendance/BreakTimer';
import { CheckInDialog } from '@/components/attendance/CheckInFlow';
import { CheckOutDrawer } from '@/components/attendance/CheckOutFlow';
import { dayLabel } from '@/components/attendance/format';
import { useMyTargets, useMyWorkList, useToday } from '@/components/attendance/hooks';
import { useAuth } from '@/lib/auth';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';

import { formatRoleName } from '@/components/owner/format';

/** SCR-SHR-001 My Day. Attendance never gates the work list (contract A1). */
export default function MyDayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const time = useCompanyTime();
  const today = useToday();
  const work = useMyWorkList();
  const targets = useMyTargets();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);

  const mutateToday = today.mutate;
  const refresh = useCallback(() => {
    void mutateToday();
  }, [mutateToday]);

  const earlier = today.data?.openSessionFromEarlierDay;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4 pb-12">
        <div>
          <h1 className="text-2xl font-semibold leading-8 text-text-primary">My Day</h1>
          <p className="text-sm text-text-secondary">
            {today.data ? dayLabel(today.data.date) : '—'}
            {user ? ` · ${formatRoleName(user.role)}` : ''}
          </p>
        </div>


        {earlier && !today.data?.session && (
          <Alert
            tone="warning"
            title={`You still have an open session from ${dayLabel(earlier.workDate, 'short')}`}
            body={`Checked in ${time.formatTime(earlier.effectiveCheckInAt)} with no checkout. Check-in stays blocked until you send a correction request with your checkout time.`}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">
          <div className="space-y-4">
            {today.error ? (
              <LoadErrorState what="your attendance" onRetry={refresh} size="inline" />
            ) : !today.data ? (
              <AttendanceCardSkeleton />
            ) : (
              <>
                <AttendanceCard today={today.data} time={time} onCheckIn={() => setCheckInOpen(true)} onCheckOut={() => setCheckOutOpen(true)} />
                {/* Break timer while checked in, when the server has break tracking on (CFG attendance.breaksEnabled). */}
                {today.data.breaksEnabled && today.data.session?.state === 'open' && <BreakTimerCard onBreakChanged={refresh} />}
                <CheckInNote today={today.data} time={time} />
              </>
            )}
          </div>
          <div className="space-y-4">
            <TargetsCard data={targets.data} isLoading={targets.isLoading} error={targets.error} onRetry={() => void targets.mutate()} />
            <WorkListCard data={work.data} isLoading={work.isLoading} error={work.error} onRetry={() => void work.mutate()} time={time} />
          </div>
        </div>

        <CheckInDialog
          isOpen={checkInOpen}
          today={today.data}
          onClose={() => setCheckInOpen(false)}
          onChanged={refresh}
          onOpenWorkList={() => router.push('/queue')}
          onViewAttendance={() => router.push('/my-attendance')}
        />
        <CheckOutDrawer isOpen={checkOutOpen} today={today.data} onClose={() => setCheckOutOpen(false)} onChanged={refresh} />
      </div>
    </AppShell>
  );
}
