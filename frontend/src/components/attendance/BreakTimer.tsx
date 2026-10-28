'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { ProgressBar } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/State';
import { ApiError } from '@/lib/api/client';
import { attendancePaths, endBreak, getActiveBreak, startBreak, type ActiveBreakDto } from '@/lib/api/attendance';
import { classifyError } from '@/lib/errorRouting';
import { newIdempotencyKey } from '@/lib/api/client';
import { formatHM, formatHMS } from './format';

interface BreakTimerCardProps {
  onBreakChanged?: () => void;
}

/** Daily break allowance (the server's value: 60 minutes per shift). */
const ALLOWANCE_SECONDS = 3600;

function breakError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const reason = (err.details as { reason?: string } | undefined)?.reason;
    if (reason === 'BREAK_ALREADY_ACTIVE') return 'A break is already running. Refresh to see it.';
    if (reason === 'NO_ACTIVE_BREAK') return 'There is no running break to end.';
    if (err.status === 0) return 'You appear to be offline. Try again when your connection returns.';
    return err.message || fallback;
  }
  return fallback;
}

/** Seconds elapsed since `startedAt`, re-computed once a second. State is only set inside timer callbacks. */
function useElapsedSince(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0;
}

export function BreakTimerCard({ onBreakChanged }: BreakTimerCardProps) {
  const { data, error, isLoading, mutate } = useSWR<ActiveBreakDto>(attendancePaths.activeBreak, getActiveBreak, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [breakType, setBreakType] = useState<'paid' | 'unpaid'>('unpaid');
  const [notes, setNotes] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const activeBreak = data?.activeBreak ?? null;
  const elapsedActive = useElapsedSince(activeBreak?.startedAt ?? null);

  const handleStart = useCallback(async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      await startBreak({ breakType, notes: notes.trim() || undefined }, newIdempotencyKey());
      setNotes('');
      setShowOptions(false);
      await mutate();
      onBreakChanged?.();
    } catch (err) {
      setActionError(breakError(err, 'Could not start the break. Try again.'));
      if (err instanceof ApiError && err.status === 409) await mutate();
    } finally {
      setSubmitting(false);
    }
  }, [breakType, notes, mutate, onBreakChanged]);

  const handleEnd = useCallback(async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      await endBreak({}, newIdempotencyKey());
      await mutate();
      onBreakChanged?.();
    } catch (err) {
      setActionError(breakError(err, 'Could not end the break. Try again.'));
      if (err instanceof ApiError && err.status === 409) await mutate();
    } finally {
      setSubmitting(false);
    }
  }, [mutate, onBreakChanged]);

  if (error && !data) {
    const route = classifyError(error);
    return (
      <Card className="p-5 flex flex-col gap-3 border border-border-subtle bg-surface-default">
        <h2 className="text-base font-semibold leading-6 text-text-primary">Break counter</h2>
        <Alert
          tone="danger"
          title={route.kind === 'offline' ? 'You are offline' : 'Breaks could not be loaded'}
          body="Your attendance is not affected. Try again."
        >
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => void mutate()}>
              Try again
            </Button>
          </div>
        </Alert>
      </Card>
    );
  }

  if (isLoading && !data) {
    return (
      <Card className="p-5 space-y-3 border border-border-subtle bg-surface-default" role="status" aria-label="Loading break counter">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-24" />
      </Card>
    );
  }

  const isOnBreak = activeBreak !== null;
  // The server total already includes a running break, so rebuild it from the finished breaks plus the live timer.
  const finishedSeconds = (data?.breaks ?? []).reduce((sum, b) => sum + (b.endedAt ? (b.durationSeconds ?? 0) : 0), 0);
  const totalBreakSeconds = finishedSeconds + (isOnBreak ? elapsedActive : 0);
  const totalBreakMinutes = Math.floor(totalBreakSeconds / 60);
  const allowanceMinutes = ALLOWANCE_SECONDS / 60;
  const isExcessive = totalBreakSeconds > ALLOWANCE_SECONDS;
  const remainingMinutes = Math.max(0, allowanceMinutes - totalBreakMinutes);

  return (
    <Card className="p-5 flex flex-col gap-4 border border-border-subtle bg-surface-default">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="clock" size={20} className="text-icon-accent" />
          <h2 className="text-base font-semibold leading-6 text-text-primary">Break counter</h2>
        </div>
        <Badge tone={isOnBreak ? 'warning' : 'neutral'} hasDot>
          {isOnBreak ? 'On break' : 'Working'}
        </Badge>
      </div>

      {actionError && <Alert tone="danger" title="Break not saved" body={actionError} role="alert" />}

      {isOnBreak ? (
        <div className="text-center py-2 space-y-1">
          <p className="text-[13px] text-text-muted">Current break</p>
          <p
            className="text-4xl leading-tight font-semibold tabular-nums tracking-tight text-status-warning-fg font-mono"
            role="timer"
            aria-label={`Break running for ${formatHMS(elapsedActive)}`}
          >
            {formatHMS(elapsedActive)}
          </p>
          <p className="text-[13px] text-text-secondary">
            {activeBreak.breakType === 'paid' ? 'Paid break' : 'Unpaid break'}
            {activeBreak.notes ? ` · ${activeBreak.notes}` : ''}
          </p>
        </div>
      ) : (
        <div className="text-center py-2 space-y-1">
          <p className="text-[13px] text-text-muted">Break time today</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-text-primary">{formatHM(totalBreakMinutes)}</p>
          <p className="text-[13px] text-text-secondary">
            {remainingMinutes > 0 ? `${remainingMinutes}m left in the daily allowance` : 'Daily break allowance used up'}
          </p>
        </div>
      )}

      <ProgressBar
        percent={(totalBreakSeconds / ALLOWANCE_SECONDS) * 100}
        tone={isExcessive ? 'warning' : 'brand'}
        label="Daily break allowance"
        value={`${totalBreakMinutes}m of ${allowanceMinutes}m`}
      />

      <p className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <PolicyPendingChip dec="No DEC ID" label="break rules" demo />
      </p>

      {isExcessive && (
        <Alert
          tone="warning"
          title="Over the daily allowance"
          body="Break time above 60 minutes is flagged for the Owner to review. Your attendance is not blocked."
        />
      )}

      {isOnBreak ? (
        <Button size="lg" fullWidth onClick={() => void handleEnd()} isLoading={submitting} disabled={submitting}>
          Resume work
        </Button>
      ) : showOptions ? (
        <div className="p-3 rounded-lg bg-surface-subtle border border-border-subtle space-y-3">
          <div className="flex gap-2" role="group" aria-label="Break type">
            {(['unpaid', 'paid'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={breakType === t}
                onClick={() => setBreakType(t)}
                className={`flex-1 min-h-[44px] px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  breakType === t
                    ? 'bg-surface-selected border-brand-accent text-text-primary'
                    : 'border-border-default text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {t === 'unpaid' ? 'Unpaid break' : 'Paid break'}
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-text-secondary">
            Note (optional)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. lunch"
              maxLength={200}
              className="mt-1 w-full h-10 text-sm px-3 rounded-md border border-border-input bg-surface-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent"
            />
          </label>
          <div className="flex gap-2">
            <Button size="md" fullWidth onClick={() => void handleStart()} isLoading={submitting} disabled={submitting}>
              Start break
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowOptions(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="lg" fullWidth onClick={() => setShowOptions(true)} disabled={submitting}>
          Take a break
        </Button>
      )}
    </Card>
  );
}
