'use client';

import React, { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardInset } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { DateInput, Textarea } from '@/components/ui/Input';
import { NoticePolicy } from '@/components/ui/NoticePolicy';
import { ApiError } from '@/lib/api';
import {
  ATTENDANCE_REASONS,
  attendanceReason,
  submitCorrection,
  withdrawCorrection,
  type AttendanceCorrectionDto,
  type AttendanceSessionDto,
} from '@/lib/api/attendance';
import { useCompanyTime, type CompanyTime } from '@/lib/hooks/useCompanyTime';
import { dayLabel, isoToHm, verificationText, zonedToIso } from './format';

const REASON_MAX = 500;

const toMinutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

function SessionFacts({ session, time }: { session: AttendanceSessionDto; time: CompanyTime }) {
  return (
    <CardInset>
      <dl className="grid grid-cols-[130px_1fr] gap-y-3 text-sm">
        <dt className="text-text-secondary">Session</dt>
        <dd className="text-text-primary">{dayLabel(session.workDate)}</dd>
        <dt className="text-text-secondary">Recorded check-in</dt>
        <dd className="text-text-primary">
          {time.formatTime(session.effectiveCheckInAt)}
          {session.adjusted && session.checkInAt !== session.effectiveCheckInAt && (
            <span className="block text-[13px] text-text-muted">Original {time.formatTime(session.checkInAt)}</span>
          )}
        </dd>
        <dt className="text-text-secondary">Recorded check-out</dt>
        <dd className={session.effectiveCheckOutAt ? 'text-text-primary' : 'text-text-secondary'}>
          {session.effectiveCheckOutAt ? time.formatTime(session.effectiveCheckOutAt) : session.checkOutUnknown ? 'Unknown' : 'Not recorded'}
          {session.adjusted && session.checkOutAt && session.checkOutAt !== session.effectiveCheckOutAt && (
            <span className="block text-[13px] text-text-muted">Original {time.formatTime(session.checkOutAt)}</span>
          )}
        </dd>
        <dt className="text-text-secondary">Office check</dt>
        <dd className="text-text-primary">{verificationText(session.verification.checkIn)}</dd>
      </dl>
    </CardInset>
  );
}

const OUTCOME_TONE = { submitted: 'warning', approved: 'success', applied: 'success', rejected: 'danger', withdrawn: 'neutral' } as const;
const OUTCOME_LABEL = { submitted: 'Correction pending', approved: 'Corrected', applied: 'Corrected', rejected: 'Correction rejected', withdrawn: 'Withdrawn' } as const;

/** The outcome of an earlier request: pending, approved or rejected. The original record is always kept. */
function CorrectionOutcome({
  correction,
  time,
  onWithdraw,
  withdrawing,
  withdrawError,
}: {
  correction: AttendanceCorrectionDto;
  time: CompanyTime;
  onWithdraw?: () => void;
  withdrawing?: boolean;
  withdrawError?: string | null;
}) {
  const decider = correction.decidedByName ?? 'The Owner';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge tone={OUTCOME_TONE[correction.status]}>{OUTCOME_LABEL[correction.status]}</Badge>
        <span className="text-[13px] text-text-secondary">
          Request sent {time.format(correction.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      </div>
      {(correction.status === 'approved' || correction.status === 'applied') && (
        <Alert
          tone="success"
          title="Your correction was applied"
          body={`${decider} approved it. The original record is kept${correction.previousCheckOutAt ? ` (check-out was ${time.formatTime(correction.previousCheckOutAt)})` : ''}.`}
        />
      )}
      {correction.status === 'rejected' && (
        <Alert
          tone="danger"
          title="Your correction was rejected"
          body={`${decider} rejected it${correction.decisionReason ? `: ${correction.decisionReason}` : '.'} The session is unchanged.`}
        />
      )}
      {correction.status === 'submitted' && (
        <Alert tone="warning" title="Waiting for the Owner" body="You can’t send another request for this session until this one is decided." />
      )}
      {withdrawError && <Alert tone="danger" title="Not withdrawn" body={withdrawError} />}
      <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-sm">
        <dt className="text-text-secondary">Proposed check-in</dt>
        <dd className="text-text-primary">{correction.proposedCheckInAt ? time.formatTime(correction.proposedCheckInAt) : 'No change'}</dd>
        <dt className="text-text-secondary">Proposed check-out</dt>
        <dd className="text-text-primary">{correction.proposedCheckOutAt ? time.formatTime(correction.proposedCheckOutAt) : 'No change'}</dd>
        <dt className="text-text-secondary">Your reason</dt>
        <dd className="text-text-primary whitespace-pre-wrap break-words">{correction.reason}</dd>
      </dl>
      {correction.status === 'submitted' && onWithdraw && (
        <Button variant="secondary" onClick={onWithdraw} isLoading={withdrawing}>
          Withdraw request
        </Button>
      )}
    </div>
  );
}

const RULE_TEXT: Record<string, { field: 'checkOut' | 'checkIn'; text: string }> = {
  [ATTENDANCE_REASONS.checkoutBeforeCheckin]: { field: 'checkOut', text: 'Check-out must be after check-in.' },
  [ATTENDANCE_REASONS.inFuture]: { field: 'checkOut', text: 'That time is in the future.' },
  [ATTENDANCE_REASONS.overlap]: { field: 'checkIn', text: 'These times overlap another session.' },
};

function CorrectionForm({
  session,
  time,
  onClose,
  onSubmitted,
}: {
  session: AttendanceSessionDto;
  time: CompanyTime;
  onClose: () => void;
  onSubmitted: (c: AttendanceCorrectionDto) => void;
}) {
  const [checkIn, setCheckIn] = useState(isoToHm(session.effectiveCheckInAt, time.timezone));
  const [checkOut, setCheckOut] = useState(session.effectiveCheckOutAt ? isoToHm(session.effectiveCheckOutAt, time.timezone) : '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ checkIn?: string; checkOut?: string; reason?: string }>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = session.state === 'open';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const next: typeof errors = {};
    if (!/^\d{2}:\d{2}$/.test(checkIn)) next.checkIn = 'Enter the check-in time.';
    if (!/^\d{2}:\d{2}$/.test(checkOut)) next.checkOut = 'Enter the check-out time.';
    else if (!next.checkIn && toMinutes(checkOut) <= toMinutes(checkIn)) next.checkOut = `Check-out must be after check-in (${checkIn}).`;
    if (!reason.trim()) next.reason = 'Add a reason for the Owner.';
    setErrors(next);
    if (next.checkIn || next.checkOut || next.reason) return;

    setBusy(true);
    try {
      const created = await submitCorrection({
        sessionId: session.id,
        proposedCheckInAt: zonedToIso(session.workDate, checkIn, time.timezone),
        proposedCheckOutAt: zonedToIso(session.workDate, checkOut, time.timezone),
        reason: reason.trim(),
      });
      onSubmitted(created);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      const fe = apiErr?.fieldErrors ?? {};
      const rule = apiErr ? RULE_TEXT[attendanceReason(apiErr) ?? ''] : undefined;
      if (fe.proposedCheckInAt || fe.proposedCheckOutAt || fe.reason) {
        setErrors({ checkIn: fe.proposedCheckInAt?.[0], checkOut: fe.proposedCheckOutAt?.[0], reason: fe.reason?.[0] });
      } else if (rule) {
        setErrors({ [rule.field]: rule.text });
      } else if (apiErr?.status === 403) {
        setAlert('Correction requests are off in this demonstration setting. The Owner corrects sessions.');
      } else if (apiErr?.status === 409) {
        setAlert('This session changed or already has a pending request. Close this panel and check My Attendance.');
      } else {
        setAlert('Your request was not sent. Your entries are kept. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <NoticePolicy dec="DEC-011" demo body="This request exists only if Alt B (employee request) is chosen. Here it is a demonstration setting." />
      <SessionFacts session={session} time={time} />
      {open && (
        <NoticePolicy
          dec="F-01"
          body="If you propose a check-out for a session that is still open, it closes provisionally and you can check in again. The Owner decides the request."
        />
      )}
      {alert && <Alert tone="danger" title="Request not sent" body={alert} />}
      <DateInput kind="time" label="Proposed check-in" value={checkIn} error={errors.checkIn} onChange={(e) => setCheckIn(e.target.value)} />
      <DateInput kind="time" label="Proposed check-out" value={checkOut} error={errors.checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      <Textarea
        label="Reason"
        required
        rows={3}
        maxLength={REASON_MAX}
        value={reason}
        counter={`${reason.length} / ${REASON_MAX}`}
        helperText="The Owner sees this with your request."
        error={errors.reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <p className="text-[13px] text-text-muted">The original record is kept beside any correction.</p>
      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={busy}>
          Submit request
        </Button>
      </div>
    </form>
  );
}

function CorrectionDrawerInner({
  session,
  correction,
  employeeRequests,
  onClose,
  onSubmitted,
}: {
  session: AttendanceSessionDto;
  correction: AttendanceCorrectionDto | undefined;
  employeeRequests: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const time = useCompanyTime();
  const [sent, setSent] = useState<AttendanceCorrectionDto | null>(null);
  const [withdrawn, setWithdrawn] = useState<AttendanceCorrectionDto | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const existing = withdrawn ?? sent ?? correction;
  const pending = existing?.status === 'submitted' || Boolean(session.pendingCorrectionId && !existing);
  const canRequest = employeeRequests && !pending && existing?.status !== 'approved' && existing?.status !== 'applied';
  const [requesting, setRequesting] = useState(!existing && employeeRequests && !session.pendingCorrectionId);

  const withdraw = async () => {
    if (!existing) return;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      setWithdrawn(await withdrawCorrection(existing));
      onSubmitted();
    } catch {
      setWithdrawError('The request was not withdrawn. It may have been decided already. Close this panel and check My Attendance.');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={requesting ? 'Request attendance correction' : 'Attendance session'}
      subtitle={`${dayLabel(session.workDate)}${session.effectiveCheckOutAt ? '' : ' · session without checkout'}`}
    >
      {sent && !withdrawn ? (
        <div className="space-y-4">
          <Alert tone="success" title="Request sent" body="The Owner will decide. Your session shows Correction pending until then." />
          <CorrectionOutcome correction={sent} time={time} onWithdraw={() => void withdraw()} withdrawing={withdrawing} withdrawError={withdrawError} />
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : requesting ? (
        <CorrectionForm
          session={session}
          time={time}
          onClose={onClose}
          onSubmitted={(c) => {
            setSent(c);
            setRequesting(false);
            onSubmitted();
          }}
        />
      ) : (
        <div className="space-y-4">
          <SessionFacts session={session} time={time} />
          {existing ? (
            <CorrectionOutcome correction={existing} time={time} onWithdraw={() => void withdraw()} withdrawing={withdrawing} withdrawError={withdrawError} />
          ) : session.pendingCorrectionId ? (
            <Alert tone="warning" title="Waiting for the Owner" body="A correction request for this session is pending." />
          ) : (
            !employeeRequests && (
              <NoticePolicy dec="DEC-011" demo body="Demonstration setting: the Owner corrects forgotten check-outs and you are notified. You cannot send a request." />
            )
          )}
          <div className="flex items-center justify-between border-t border-border-subtle pt-4">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {canRequest && <Button onClick={() => setRequesting(true)}>Request correction</Button>}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/** SCR-SHR-005: view a session and, when allowed, send a correction request. Mounted per opening. */
export function CorrectionDrawer({
  session,
  correction,
  employeeRequests,
  onClose,
  onSubmitted,
}: {
  /** null = closed. */
  session: AttendanceSessionDto | null;
  /** The latest request for this session, if any. */
  correction: AttendanceCorrectionDto | undefined;
  employeeRequests: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  if (!session) return null;
  return (
    <CorrectionDrawerInner
      key={session.id}
      session={session}
      correction={correction}
      employeeRequests={employeeRequests}
      onClose={onClose}
      onSubmitted={onSubmitted}
    />
  );
}
