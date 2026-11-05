'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { CheckOutBody, useCheckOutFlow } from '@/components/attendance/CheckOutFlow';
import { dayLabel } from '@/components/attendance/format';
import { useToday } from '@/components/attendance/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadErrorState, LoadingState } from '@/components/states';

/** SCR-SHR-003 as a focused page (phones, deep links). */
export default function CheckOutPage() {
  const router = useRouter();
  const today = useToday();
  const mutateToday = today.mutate;
  const flow = useCheckOutFlow({ today: today.data, onChanged: () => void mutateToday() });
  const data = today.data;

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-4 pb-12">
        <div>
          <Link href="/my-day" className="text-[13px] text-text-link hover:underline">
            ‹ My Day
          </Link>
          <h1 className="text-2xl font-semibold leading-8 text-text-primary mt-1">Check out</h1>
          {data && <p className="text-sm text-text-secondary">{dayLabel(data.date)}</p>}
        </div>
        {today.error ? (
          <LoadErrorState what="your attendance" onRetry={() => void mutateToday()} />
        ) : !data ? (
          <LoadingState variant="cards" rows={1} />
        ) : !data.session ? (
          <EmptyState
            title="You are not checked in"
            body="There is no open session to check out of."
            action={<Button onClick={() => router.push('/my-day')}>Back to My Day</Button>}
          />
        ) : (
          <Card className="p-5">
            <CheckOutBody flow={flow} today={data} onClose={() => router.push('/my-day')} />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
