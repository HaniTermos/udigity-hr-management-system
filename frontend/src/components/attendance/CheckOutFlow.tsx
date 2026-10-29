'use client';

import React, { useCallback, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardInset } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Input';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { ProgressBar } from '@/components/ui/Progress';
import { ApiError } from '@/lib/api';
import {
  ATTENDANCE_REASONS,
  SUMMARY_MIN_CHARS,
  attendanceReason,
  checkOut,
  summaryCharCount,
  type AttendanceTodayDto,
  type CheckOutResult,
} from '@/lib/api/attendance';
import { offlineSaveMessage } from '@/lib/errorRouting';
import { useCompanyTime, type CompanyTime } from '@/lib/hooks/useCompanyTime';
import { dayLabel, formatHM, verificationText } from './format';
import { useElapsedSeconds } from './hooks';

const SUMMARY_MAX = 1000;

type Phase = 'form' | 'submitting' | 'failed' | 'done' | 'error' | 'stale';

export interface CheckOutFlowState {
  phase: Phase;
  summary: string;
  setSummary: (v: string) => void;
  summaryError: string | null;
  result: CheckOutResult | null;
  submit: () => void;
  alertText: string | null;
}

/** The check-out action with a work summary (SCR-SHR-003). D6: at least 10 non-whitespace characters (pinned). */
export function useCheckOutFlow({ today, onChanged }: { today: AttendanceTodayDto | undefined; onChanged: () => void }): CheckOutFlowState {
  const [phase, setPhase] = useState<Phase>('form');
  const [summary, setSummary] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckOutResult | null>(null);
  const [alertText, setAlertText] = useState<string | null>(null);
  const session = today?.session ?? null;

  const submit = useCallback(async () => {
    if (!session) return;
    const trimmed = summary.trim();
    if (summaryCharCount(trimmed) < SUMMARY_MIN_CHARS) {
      setSummaryError(
        trimmed.length === 0
          ? 'Add a short summary before checking out.'
          : `Add a little more: at least ${SUMMARY_MIN_CHARS} characters, not counting spaces.`
      );
      return;
    }
    setSummaryError(null);
    setPhase('submitting');
    try {
      const res = await checkOut({ version: session.version, summary: { workCompleted: trimmed } });
      setResult(res);
      setPhase('done');
      onChanged();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      const reason = err ? attendanceReason(err) : null;
      const summaryFieldError = err?.fieldErrors['summary.workCompleted']?.[0];
      if (reason === ATTENDANCE_REASONS.officeCheckFailed) {
        setPhase('failed');
      } else if (reason === ATTENDANCE_REASONS.correctionRequired) {
        // D5: an earlier-day or missing-checkout session is closed through a correction request.
        setAlertText('This session can no longer be checked out here. Send a correction request with your checkout time from My Attendance.');
        setPhase('error');
        onChanged();
      } else if (summaryFieldError) {
        setSummaryError(summaryFieldError);
        setPhase('form');
      } else if (err?.isVersionConflict || err?.code === 'STATE_CONFLICT') {
        setAlertText('This session changed while you were checking out. Your summary is kept; review it and try again.');
        setPhase('stale');
        onChanged();
      } else {
        setAlertText(offlineSaveMessage(e) ?? 'Something went wrong and nothing was recorded. Your summary is kept. Try again.');
        setPhase('error');
      }
    }
  }, [session, summary, onChanged]);

  return {
    phase,
    summary,
    setSummary: (v: string) => {
      setSummary(v);
      if (summaryError) setSummaryError(null);
    },
    summaryError,
    result,
    submit: () => void submit(),
    alertText,
  };
}

function SummaryPolicyNote() {
  return <NoticePolicy dec="D6" body={`“Work completed” is required: at least ${SUMMARY_MIN_CHARS} characters, not counting spaces.`} />;
}

/** D5 (approved): what a checkout does when the office check fails. */
function FailedCheckoutNote() {
  return (
    <NoticePolicy
      dec="D5"
      body="If the office check fails, Check out is still recorded at the time the server received it, marked provisional, and the Owner reviews it."
    />
  );
}

function ResultView({ result, time }: { result: CheckOutResult; time: CompanyTime }) {
  const s = result.session;
  const at = s.effectiveCheckOutAt ? time.formatTime(s.effectiveCheckOutAt) : s.checkoutAttemptedAt ? time.formatTime(s.checkoutAttemptedAt) : '';
  const duration = formatHM(s.durationMinutes);
  return (
    <div className="space-y-4">
      {result.outcome === 'closed' ? (
        <Alert tone="success" title={`Checked out at ${at}`} body={`${duration} recorded · ${verificationText(s.verification.checkOut)}. Summary saved.`} />
      ) : result.outcome === 'closed_provisional' ? (
        <Alert tone="warning" title={`Checked out provisionally at ${at}`} body="Recorded with a failed office check. The Owner reviews it; your hours may change." />
      ) : (
        <Alert tone="warning" title="Check out held for Owner review" body="The session closes after the Owner reviews the failed office check." />
      )}
      <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
        <dt className="text-text-secondary">Check-in</dt>
        <dd className="text-text-primary">{time.formatTime(s.effectiveCheckInAt)}</dd>
        <dt className="text-text-secondary">Checkout</dt>
        <dd className="text-text-primary">
          {at}
          {result.outcome === 'closed_provisional' ? ' · provisional' : ''}
        </dd>
        <dt className="text-text-secondary">Duration</dt>
        <dd className="text-text-primary">
          {duration}
          {result.outcome !== 'closed' ? ' (pending review)' : ''}
        </dd>
      </dl>
      {result.outcome !== 'closed' && (
        <div className="space-y-2">
          <Badge tone="warning">Provisional · Owner review</Badge>
          <NoticePolicy dec="F-02" body="Your work summary is saved with the provisional checkout." />
        </div>
      )}
    </div>
  );
}

/** Body of the check-out drawer and of the deep-link page. */
export function CheckOutBody({ flow, today, onClose }: { flow: CheckOutFlowState; today: AttendanceTodayDto; onClose: () => void }) {
  const time = useCompanyTime();
  const session = today.session;
  const elapsed = useElapsedSeconds(session);
  const workday = session?.requiredMinutes ?? 540;

  if (flow.phase === 'done' && flow.result) {
    return (
      <div className="flex flex-col gap-4 h-full">
        <ResultView result={flow.result} time={time} />
        <div className="mt-auto flex justify-end pt-2">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  const submitting = flow.phase === 'submitting';
  const failed = flow.phase === 'failed';

  return (
    <form
      className="flex flex-col gap-4 h-full"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        flow.submit();
      }}
    >
      {session && (
        <CardInset className="space-y-2">
          <p className="text-[13px] text-text-secondary">
            Checked in {time.formatTime(session.effectiveCheckInAt)} · now {time.formatTime(new Date(Date.parse(session.effectiveCheckInAt) + elapsed * 1000))}
          </p>
          <ProgressBar
            percent={(elapsed / 60 / workday) * 100}
            label="Toward 9 h workday"
            value={`${formatHM(elapsed / 60)} of ${Math.round(workday / 60)}h`}
          />
        </CardInset>
      )}

      {flow.alertText && <Alert tone={flow.phase === 'stale' ? 'warning' : 'danger'} title={flow.phase === 'stale' ? 'Session changed' : 'Check-out not recorded'} body={flow.alertText} />}

      <Textarea
        label="Work summary"
        required
        rows={4}
        maxLength={SUMMARY_MAX}
        placeholder="What did you work on today?"
        value={flow.summary}
        counter={`${flow.summary.length} / ${SUMMARY_MAX}`}
        helperText="Shown to the Owner in reports."
        error={flow.summaryError ?? undefined}
        onChange={(e) => flow.setSummary(e.target.value)}
      />

      <SummaryPolicyNote />

      {failed ? (
        <div className="space-y-3">
          <Alert tone="danger" title="Office check failed" body="Connect to the office network, then retry. Your summary is kept on this screen." icon={<Icon name="x-circle" size={18} />} />
          <Button variant="secondary" fullWidth leadingIcon={<Icon name="refresh" size={16} />} onClick={flow.submit}>
            Retry check
          </Button>
          <div className="flex flex-wrap gap-2">
            <PolicyPendingChip dec="DEC-009" demo />
            <PolicyPendingChip dec="DEC-010" demo />
          </div>
          <FailedCheckoutNote />
        </div>
      ) : (
        <>
          <p className="text-[13px] text-text-muted">The office check runs when you press Check out.</p>
          <div className="flex flex-wrap gap-2">
            <PolicyPendingChip dec="DEC-009" demo />
          </div>
        </>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={submitting}>
          {submitting ? 'Checking out…' : 'Check out'}
        </Button>
      </div>
    </form>
  );
}

function CheckOutDrawerInner({ today, onClose, onChanged }: { today: AttendanceTodayDto; onClose: () => void; onChanged: () => void }) {
  const time = useCompanyTime();
  const flow = useCheckOutFlow({ today, onChanged });
  const session = today.session;
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title="Check out"
      subtitle={session ? `${dayLabel(today.date, 'short')} · checked in ${time.formatTime(session.effectiveCheckInAt)}` : undefined}
    >
      <CheckOutBody flow={flow} today={today} onClose={onClose} />
    </Drawer>
  );
}

/** SCR-SHR-003 as a drawer over My Day. Mounted only while open, so the summary starts empty each time. */
export function CheckOutDrawer({ isOpen, today, onClose, onChanged }: { isOpen: boolean; today: AttendanceTodayDto | undefined; onClose: () => void; onChanged: () => void }) {
  if (!isOpen || !today?.session) return null;
  return <CheckOutDrawerInner today={today} onClose={onClose} onChanged={onChanged} />;
}
