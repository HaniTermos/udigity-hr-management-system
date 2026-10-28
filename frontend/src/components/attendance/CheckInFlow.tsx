'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardInset } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Input';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { Skeleton } from '@/components/ui/State';
import { ApiError } from '@/lib/api';
import {
  ATTENDANCE_REASONS,
  attendanceReason,
  checkIn,
  requestRemoteException,
  type AttendanceTodayDto,
  type CheckInResult,
} from '@/lib/api/attendance';
import { offlineSaveMessage } from '@/lib/errorRouting';
import { useCompanyTime, type CompanyTime } from '@/lib/hooks/useCompanyTime';
import { PUNCTUALITY_LABEL, dayLabel, verificationText } from './format';

type Phase = 'idle' | 'verifying' | 'done' | 'failed' | 'blocked' | 'not-configured' | 'error' | 'remote' | 'remote-sent';

export interface CheckInFlowState {
  phase: Phase;
  result: CheckInResult | null;
  /** The mode the server reported on a failed office check (for the message). */
  failedMode: string | null;
  remoteBusy: boolean;
  remoteError: string | null;
  /** Phase `error`: the offline copy when the connection was the cause (SHR-015), else null. */
  errorText: string | null;
  start: () => void;
  openRemoteRequest: () => void;
  sendRemoteRequest: (date: string, reason: string) => void;
}

/**
 * The check-in action (SCR-SHR-002). `autoStart` runs it on mount; the dialog does (the person just pressed
 * Check in), the deep-link page does not (opening a URL must never record attendance). The body is `{}`: the
 * server decides the time and the office check (BE1-C2).
 */
export function useCheckInFlow({ autoStart, onChanged }: { autoStart: boolean; onChanged: () => void }): CheckInFlowState {
  const [phase, setPhase] = useState<Phase>(autoStart ? 'verifying' : 'idle');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [failedMode, setFailedMode] = useState<string | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const started = useRef(false);

  const perform = useCallback(async () => {
    try {
      const res = await checkIn();
      setResult(res);
      setPhase('done');
      onChanged();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      const reason = err ? attendanceReason(err) : null;
      if (reason === ATTENDANCE_REASONS.officeCheckFailed) {
        const d = err?.details as { mode?: string } | undefined;
        setFailedMode(d?.mode ?? null);
        setPhase('failed');
      } else if (reason === ATTENDANCE_REASONS.policyNotConfigured) {
        setPhase('not-configured');
      } else if (reason === ATTENDANCE_REASONS.openSession) {
        setPhase('blocked');
        onChanged();
      } else {
        setErrorText(offlineSaveMessage(e));
        setPhase('error');
      }
    }
  }, [onChanged]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void perform();
    }
  }, [autoStart, perform]);

  const start = useCallback(() => {
    setPhase('verifying');
    void perform();
  }, [perform]);

  const sendRemoteRequest = useCallback((date: string, reason: string) => {
    setRemoteBusy(true);
    setRemoteError(null);
    requestRemoteException({ startDate: date, reason })
      .then(() => setPhase('remote-sent'))
      .catch((e) => {
        const err = e instanceof ApiError ? e : null;
        setRemoteError(
          err?.status === 403
            ? 'Remote requests are not available. The Owner records remote work.'
            : err?.fieldErrors.reason?.[0] ?? offlineSaveMessage(e) ?? 'Your request was not sent. Nothing was changed. Try again.'
        );
      })
      .finally(() => setRemoteBusy(false));
  }, []);

  return { phase, result, failedMode, remoteBusy, remoteError, errorText, start, openRemoteRequest: () => setPhase('remote'), sendRemoteRequest };
}

export function checkInTitle(phase: Phase) {
  if (phase === 'blocked') return 'Can’t check in yet';
  if (phase === 'remote' || phase === 'remote-sent') return 'Request remote exception';
  return 'Check in';
}

function DerivedCard({ result, time }: { result: CheckInResult | null; time: CompanyTime }) {
  const s = result?.session;
  return (
    <CardInset className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
        <Icon name="clock" size={16} className="text-icon-muted" />
        <span>Check-in {s ? time.formatTime(s.effectiveCheckInAt) : '—'}</span>
        {s && (
          <Badge derived>
            {PUNCTUALITY_LABEL[s.punctuality]}
            {s.punctuality === 'late' ? ` · ${s.lateMinutes} min` : ''}
          </Badge>
        )}
      </div>
      <p className="text-[13px] leading-[18px] text-text-secondary">
        Derived from the schedule and grace period. Possible results: On time · Late · Unclassified (no schedule) · Non-working day.
      </p>
    </CardInset>
  );
}

function RemoteRequestForm({ flow, today, onClose }: { flow: CheckInFlowState; today: AttendanceTodayDto | undefined; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Add a reason for the Owner.');
      return;
    }
    if (!today) return;
    setError(undefined);
    flow.sendRemoteRequest(today.date, reason.trim());
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-text-secondary">The Owner decides the request. You can check in after it is granted.</p>
      {flow.remoteError && <Alert tone="danger" title="Request not sent" body={flow.remoteError} />}
      <Textarea label="Reason" required rows={3} maxLength={500} value={reason} error={error} onChange={(e) => setReason(e.target.value)} />
      <PolicyPendingChip dec="DEC-010" demo />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={flow.remoteBusy}>
          Send request
        </Button>
      </div>
    </form>
  );
}

/** Body of the check-in dialog and of the deep-link page. */
export function CheckInBody({
  flow,
  today,
  onClose,
  onOpenWorkList,
  onViewAttendance,
}: {
  flow: CheckInFlowState;
  today: AttendanceTodayDto | undefined;
  onClose: () => void;
  onOpenWorkList: () => void;
  onViewAttendance: () => void;
}) {
  const time = useCompanyTime();
  const { phase, result } = flow;
  const earlier = today?.openSessionFromEarlierDay;

  if (phase === 'idle') {
    return (
      <div className="space-y-4">
        <CardInset className="space-y-1">
          <p className="text-sm font-medium text-text-primary">Office verification</p>
          <p className="text-[13px] leading-[18px] text-text-secondary">
            {today?.officeCheck.active ? 'We check that you are at the office when you check in.' : 'The office check is not active yet. Your check-in is recorded without it.'}
          </p>
        </CardInset>
        <PolicyPendingChip dec="DEC-009" demo />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Back to My Day
          </Button>
          <Button onClick={flow.start} disabled={today ? !today.canCheckIn : false}>
            Check in now
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'verifying') {
    return (
      <div role="status" aria-live="polite" className="space-y-3 py-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <p className="text-center text-[13px] text-text-muted">Verifying office check…</p>
      </div>
    );
  }

  if (phase === 'remote') return <RemoteRequestForm flow={flow} today={today} onClose={onClose} />;

  if (phase === 'remote-sent') {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Request sent" body="The Owner will decide. Nothing is recorded as attendance until you check in." />
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  if (phase === 'blocked') {
    return (
      <div className="space-y-4">
        <Alert
          tone="warning"
          title={earlier ? `Open session from ${dayLabel(earlier.workDate, 'short')}` : 'Open session from an earlier day'}
          body={`${earlier ? `Checked in ${time.formatTime(earlier.effectiveCheckInAt)} with no checkout. ` : ''}Check-in stays blocked until it is corrected.`}
        />
        <NoticePolicy
          dec="DEC-011"
          demo
          body={
            today?.employeeRequestsEnabled
              ? 'Demonstration setting: you send a correction request from My Attendance and the Owner decides it.'
              : 'Demonstration setting: the Owner corrects the session and you are notified.'
          }
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onViewAttendance}>View my attendance</Button>
        </div>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="Office check failed" body="You don’t appear to be at the office. Nothing was recorded." />
        {today?.remoteSelfRequestEnabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="link" onClick={flow.openRemoteRequest}>
              Request remote exception
            </Button>
            <PolicyPendingChip dec="DEC-010" demo />
          </div>
        ) : (
          <NoticePolicy dec="DEC-010" demo body="Demonstration setting: employees cannot request a remote exception. The Owner records remote work." />
        )}
        <NoticePolicy
          dec="DEC-009"
          demo
          body={`Which check applies (network, location, either or both) is undecided. Demonstration check: ${flow.failedMode ?? today?.officeCheck.mode ?? 'ip'}.`}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button leadingIcon={<Icon name="refresh" size={16} />} onClick={flow.start}>
            Retry check
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'not-configured') {
    return (
      <div className="space-y-4">
        <Alert tone="warning" title="Attendance verification is not configured" body="Ask the Owner to set up the office check. Nothing was recorded." />
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="Check-in not recorded" body={flow.errorText ?? 'Something went wrong and nothing was recorded. Try again.'} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={flow.start}>Try again</Button>
        </div>
      </div>
    );
  }

  const session = result?.session;
  const remote = Boolean(session?.remote);
  const at = session ? time.formatTime(session.effectiveCheckInAt) : '';
  return (
    <div className="space-y-4">
      <Alert
        tone={remote ? 'warning' : 'success'}
        title={remote ? `Checked in as remote · ${at}` : `Checked in${at ? ` at ${at}` : ''}`}
        body={session ? verificationText(session.verification.checkIn) : undefined}
        icon={remote ? <Icon name="shield" size={18} /> : undefined}
      />
      <DerivedCard result={result} time={time} />
      <NoticePolicy
        dec={remote ? 'DEC-010' : 'DEC-007/008'}
        demo
        body={
          remote
            ? 'Remote work and its fallback are undecided; this result exists only if remote exceptions are adopted.'
            : 'Schedule start and grace are demonstration values; the 9 h workday is confirmed.'
        }
      />
      {!remote && (
        <div className="flex flex-wrap gap-2">
          <PolicyPendingChip dec="DEC-009" demo />
          <PolicyPendingChip dec="DEC-022" demo />
          <PolicyPendingChip dec="R-11" demo />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onOpenWorkList}>Open my work list</Button>
      </div>
    </div>
  );
}

function CheckInDialogInner({
  today,
  onClose,
  onChanged,
  onOpenWorkList,
  onViewAttendance,
}: {
  today: AttendanceTodayDto | undefined;
  onClose: () => void;
  onChanged: () => void;
  onOpenWorkList: () => void;
  onViewAttendance: () => void;
}) {
  const flow = useCheckInFlow({ autoStart: true, onChanged });
  return (
    <Dialog isOpen onClose={onClose} title={checkInTitle(flow.phase)} description={today ? dayLabel(today.date) : undefined}>
      <CheckInBody flow={flow} today={today} onClose={onClose} onOpenWorkList={onOpenWorkList} onViewAttendance={onViewAttendance} />
    </Dialog>
  );
}

/** SCR-SHR-002 as a dialog over My Day. Mounted only while open, so each opening is one fresh attempt. */
export function CheckInDialog({
  isOpen,
  ...rest
}: {
  isOpen: boolean;
  today: AttendanceTodayDto | undefined;
  onClose: () => void;
  onChanged: () => void;
  onOpenWorkList: () => void;
  onViewAttendance: () => void;
}) {
  return isOpen ? <CheckInDialogInner {...rest} /> : null;
}
