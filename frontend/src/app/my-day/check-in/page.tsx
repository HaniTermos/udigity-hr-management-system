'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { CheckInBody, checkInTitle, useCheckInFlow } from '@/components/attendance/CheckInFlow';
import { dayLabel } from '@/components/attendance/format';
import { useToday } from '@/components/attendance/hooks';
import { Card } from '@/components/ui/Card';
import { LoadErrorState } from '@/components/states';

/** SCR-SHR-002 as a focused page (phones, deep links). Opening the URL never records attendance. */
export default function CheckInPage() {
  const router = useRouter();
  const today = useToday();
  const mutateToday = today.mutate;
  const flow = useCheckInFlow({ autoStart: false, onChanged: () => void mutateToday() });

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-4 pb-12">
        <div>
          <Link href="/my-day" className="text-[13px] text-text-link hover:underline">
            ‹ My Day
          </Link>
          <h1 className="text-2xl font-semibold leading-8 text-text-primary mt-1">{checkInTitle(flow.phase)}</h1>
          {today.data && <p className="text-sm text-text-secondary">{dayLabel(today.data.date)}</p>}
        </div>
        {today.error ? (
          <LoadErrorState what="your attendance" onRetry={() => void mutateToday()} />
        ) : (
          <Card className="p-5">
            <CheckInBody
              flow={flow}
              today={today.data}
              onClose={() => router.push('/my-day')}
              onOpenWorkList={() => router.push('/queue')}
              onViewAttendance={() => router.push('/my-attendance')}
            />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
