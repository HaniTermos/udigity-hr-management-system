'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, OutcomeBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSection } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import {
  logInboundRejection,
  newIdempotencyKey,
  overrideReservation,
  reopenBusiness,
  requeueBusiness,
  type CallAttemptDto,
  type ReservationLostReason,
  type WorkspaceDto,
} from '@/lib/api/calling';
import type { BusinessDetail } from '@/lib/api/businesses';
import { OUTCOME_LABEL, useCallingFormat } from './format';
import { useNow, type ContactSession } from './hooks';

/* ----------------------------------------------------------- business card */

export function BusinessCard({
  w,
  business,
  detailUnavailable,
  onRequestCorrection,
}: {
  w: WorkspaceDto;
  business?: BusinessDetail;
  detailUnavailable?: boolean;
  onRequestCorrection?: () => void;
}) {
  const assigned = w.assignment ? `Assigned to ${w.assignment.isMe ? 'you' : w.assignment.assigneeName}` : 'Not assigned';
  return (
    <CardSection
      title={w.businessName}
      subtitle={[business?.category, assigned].filter(Boolean).join(' · ')}
      action={
        onRequestCorrection ? (
          <button type="button" onClick={onRequestCorrection} className="inline-flex items-center gap-1 text-text-link hover:underline cursor-pointer">
            Request correction <Icon name="flag" size={14} />
          </button>
        ) : undefined
      }
    >
      {detailUnavailable && <p className="text-sm text-text-muted">Contact details are not available to you for this business.</p>}
      {business && business.phones.length === 0 && <p className="text-sm text-text-muted">No phone number on record.</p>}
      <ul className="flex flex-col gap-3">
        {business?.phones.map((p) => {
          const full = `${p.countryCode} ${p.number}`.trim();
          return (
            <li key={p.id} className="flex items-center gap-3">
              <Icon name="phone" size={16} className="text-icon-muted" />
              <span className="text-[15px] text-text-primary tabular-nums">{full}</span>
              <button
                type="button"
                aria-label={`Copy ${full}`}
                onClick={() => navigator.clipboard?.writeText(full)}
                className="ml-auto inline-flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-md text-icon-muted hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Icon name="copy" size={16} />
              </button>
            </li>
          );
        })}
        {business?.website && (
          <li className="flex items-center gap-3 text-sm">
            <span className="w-16 text-text-muted">Website</span>
            <span className="text-text-primary">{business.website}</span>
          </li>
        )}
      </ul>
    </CardSection>
  );
}

/* ------------------------------------------------------------ call history */

function HistoryRow({ a }: { a: CallAttemptDto }) {
  const f = useCallingFormat();
  const text = a.rejectionReason ?? a.clientNeedsNote ?? a.notes ?? 'No notes.';
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-icon-muted">
        <Icon name="phone" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 text-sm">
          <span className="font-medium text-text-primary">
            {a.channel === 'inbound_other' ? 'Inbound contact' : 'Call attempt'} · {a.agentName}
          </span>
          <span className="shrink-0 text-[13px] text-text-muted">{f.dayTime(a.attemptedAt)}</span>
        </div>
        <p className="text-sm text-text-secondary mt-0.5 whitespace-pre-line break-words">{text}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <OutcomeBadge outcome={OUTCOME_LABEL[a.outcome]} />
          {!a.outcomeApplied && (
            <Badge tone="warning" derived>
              Outcome not applied
            </Badge>
          )}
        </div>
      </div>
    </li>
  );
}

export function CallHistory({ w }: { w: WorkspaceDto }) {
  const f = useCallingFormat();
  const fu = w.openFollowUp;
  return (
    <CardSection
      title="Call history"
      subtitle={`${w.attempts.length} attempt${w.attempts.length === 1 ? '' : 's'} · newest first`}
      action={
        <Link href={`/businesses/${w.businessId}`} className="text-text-link hover:underline">
          Open full history
        </Link>
      }
    >
      {w.attempts.length === 0 && !fu ? (
        <p className="text-sm text-text-muted">No attempts yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {fu && (
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border-selected text-status-brand-fg">
                <Icon name="clock" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 text-sm">
                  <span className="font-medium text-text-primary">Follow-up · {f.weekdayTime(fu.scheduledFor)}</span>
                  <span className="shrink-0 text-[13px] text-text-muted">{fu.overdue ? 'Overdue' : fu.due ? 'Due now' : 'Scheduled'}</span>
                </div>
                <p className="text-sm text-text-secondary mt-0.5">{fu.purpose ?? 'No purpose recorded.'} Responsible: {fu.responsibleName}.</p>
              </div>
            </li>
          )}
          {w.attempts.map((a) => (
            <HistoryRow key={a.id} a={a} />
          ))}
        </ol>
      )}
    </CardSection>
  );
}

/* ------------------------------------------------- reservation banner */

const LOST_COPY: Record<ReservationLostReason, { title: string; body: string }> = {
  idle: { title: 'Your reservation expired', body: 'No activity for too long, so the idle rule ended it. Your draft is kept below.' },
  max_total: { title: 'Your reservation ended', body: 'The maximum contact time was reached. Your draft is kept below.' },
  lease_elapsed: { title: 'Your reservation expired', body: 'It was not renewed in time. Your draft is kept below.' },
  overridden: {
    title: 'Overridden by Owner',
    body: 'The Owner took over this contact and the reservation ended. This is the notice to you. Your draft is kept below.',
  },
  access_denied: { title: 'You no longer have access to this contact', body: 'The reservation ended because your access changed. Your draft is kept below.' },
  token_mismatch: { title: 'Your reservation ended', body: 'This contact was reopened elsewhere. Your draft is kept below.' },
  released: { title: 'Your reservation ended', body: 'The contact was released. Your draft is kept below.' },
};

export function ReservationBanner({
  w,
  session,
  isOwner,
  onOverride,
  onReopen,
}: {
  w: WorkspaceDto;
  session: ContactSession;
  isOwner: boolean;
  onOverride: () => void;
  onReopen: () => void;
}) {
  const f = useCallingFormat();
  const now = useNow(10_000, session.phase === 'active');

  if (session.phase === 'lost') {
    const copy = LOST_COPY[session.lostReason ?? 'lease_elapsed'];
    return (
      <Alert tone="warning" title={copy.title} body={copy.body} icon={<Icon name="clock" size={18} />}>
        <div className="mt-2">
          <Button size="sm" variant="secondary" onClick={onReopen} leadingIcon={<Icon name="refresh" size={14} />}>
            Reopen contact
          </Button>
        </div>
      </Alert>
    );
  }

  if (session.phase === 'active' && session.offlineSince) {
    return (
      <Alert
        tone="info"
        title={`You are offline · since ${f.time(session.offlineSince)}`}
        body="Renewals are failing and will retry. Notes stay in the form. If the lease ends before you reconnect, the reservation expires."
        icon={<Icon name="wifi" size={18} />}
      />
    );
  }

  if (session.phase === 'active' && session.timing) {
    const t = session.timing;
    const warn = t.maxTotalWarning || t.idleWarning;
    const deadline = t.maxTotalWarning ? t.maxTotalExpiresAt : t.idleExpiresAt;
    if (warn) {
      const mins = Math.max(0, Math.ceil((Date.parse(deadline) - (now || Date.parse(t.leaseExpiresAt))) / 60000));
      return (
        <Alert
          tone="warning"
          title={`Reservation ends in ${mins} min · ${f.time(deadline)}`}
          body={
            t.maxTotalWarning
              ? 'Maximum contact time is close (times illustrative). Save now, or keep the reservation.'
              : 'No recent activity, so renewal is paused (idle rule pending; times illustrative). Save now, or keep the reservation.'
          }
          icon={<Icon name="clock" size={18} />}
        />
      );
    }
    return (
      <Alert
        tone="success"
        title={`Reserved by you · since ${session.lease ? f.time(session.lease.acquiredAt) : ''}`}
        body={`Renews while this workspace is open; expires ${f.time(t.leaseExpiresAt)} if not renewed. Switching tabs does not release it.`}
        icon={<Icon name="lock" size={18} />}
      />
    );
  }

  const other = session.conflict
    ? { name: session.conflict.holderName, since: session.conflict.acquiredAt }
    : w.reservation.state === 'other'
      ? { name: w.reservation.holderName ?? 'another agent', since: w.reservation.acquiredAt }
      : null;
  if (other) {
    return (
      <Alert
        tone="warning"
        title={`Reserved by ${other.name}${other.since ? ` · since ${f.time(other.since)}` : ''}`}
        body="Only one agent can contact a business at a time. You can read the history but not start a contact until the reservation ends."
        icon={<Icon name="lock" size={18} />}
      >
        {isOwner && (
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={onOverride}>
              Override reservation…
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  if (w.reservation.state === 'mine') {
    return (
      <Alert
        tone="info"
        title="You hold this contact elsewhere"
        body="Your reservation is open in another tab or device. Start Contact brings it here."
        icon={<Icon name="lock" size={18} />}
      />
    );
  }
  return null;
}

/* ------------------------------------------------------------- dialogs */

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.code === 'OWNER_2FA_REQUIRED') return 'This action needs a completed two-factor sign-in.';
    if (e.isPermissionDenied || e.status === 403) return 'You do not have permission for this action.';
    if (e.isVersionConflict) return 'This business changed while you were working. Reload and try again.';
    return e.message || fallback;
  }
  return fallback;
}

/** Owner force override (SCR-CC-005): a reason is mandatory; the holder gets a notice. DEC-004 demonstration alternative. */
export function OverrideDialog({
  open,
  reservationId,
  holderName,
  onClose,
  onDone,
}: {
  open: boolean;
  reservationId: string | null;
  holderName: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };
  const submit = async () => {
    if (!reservationId) return;
    setBusy(true);
    setError(null);
    try {
      await overrideReservation(reservationId, reason.trim());
      toast.show({ tone: 'success', title: 'Reservation overridden', body: `${holderName ?? 'The holder'} will see a notice.` });
      setReason('');
      onDone();
    } catch (e) {
      setError(errorMessage(e, 'The reservation could not be overridden.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      isOpen={open}
      onClose={close}
      title="Override this reservation?"
      description={`${holderName ?? 'The holder'} is working on this business. Their draft stays on their screen and they are told why.`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Keep reservation
          </Button>
          <Button variant="destructive" disabled={reason.trim().length < 3 || busy} isLoading={busy} onClick={submit}>
            Override reservation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <PolicyPendingChip dec="DEC-004" demo />
        <Textarea label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} helperText="At least 3 characters. Recorded in the audit log." />
        {error && <Alert tone="danger" title={error} />}
      </div>
    </Dialog>
  );
}

/** Reopen (DEC-016, Owner-only demonstration alternative) and re-queue (B3-Q12). */
export function ReopenDialog({
  mode,
  target,
  onClose,
  onDone,
}: {
  mode: 'reopen' | 'requeue';
  target: { businessId: string; name: string; stateVersion: number } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = mode === 'reopen' ? 'Reopen' : 'Re-queue';
  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };
  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const body = { reason: reason.trim(), stateVersion: target.stateVersion };
      await (mode === 'reopen' ? reopenBusiness(target.businessId, body) : requeueBusiness(target.businessId, body));
      toast.show({ tone: 'success', title: `${target.name} ${mode === 'reopen' ? 'reopened' : 're-queued'}`, body: 'The outcome is now Pending. History is kept.' });
      setReason('');
      onDone();
    } catch (e) {
      setError(errorMessage(e, `The business could not be ${mode === 'reopen' ? 'reopened' : 're-queued'}.`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      isOpen={target !== null}
      onClose={close}
      title={`${label} ${target?.name ?? 'this business'}?`}
      description={
        mode === 'reopen'
          ? 'The outcome returns from Rejected to Pending and the business can be assigned and called again. The rejection stays in the history.'
          : 'The outcome returns from Accepted to Pending. Allowed only when the deal is Not proceeding. The history is kept.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button disabled={reason.trim().length < 3 || busy} isLoading={busy} onClick={submit}>
            {label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {mode === 'reopen' && <PolicyPendingChip dec="DEC-016" demo />}
        <Textarea label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} helperText="At least 3 characters. Recorded in the audit log." />
        {error && <Alert tone="danger" title={error} />}
      </div>
    </Dialog>
  );
}

/** Inbound do-not-call outside a call (B3-Q10): its own route, no reservation. */
export function InboundRejectionDialog({
  open,
  w,
  onClose,
  onDone,
}: {
  open: boolean;
  w: WorkspaceDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per user action: kept across retries of the same payload (timeout, 5xx, offline), renewed after
  // success, a definitive 4xx, or when the typed payload changed.
  const keyRef = useRef<{ key: string; sig: string } | null>(null);
  const close = () => {
    setError(null);
    onClose();
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    const body = { businessId: w.businessId, stateVersion: w.state.version, rejectionReason: reason.trim(), ...(notes.trim() ? { notes: notes.trim() } : {}) };
    const sig = JSON.stringify(body);
    if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { key: newIdempotencyKey(), sig };
    try {
      await logInboundRejection(body, keyRef.current.key);
      keyRef.current = null;
      toast.show({ tone: 'success', title: 'Marked do not call', body: `${w.businessName} is now on the do-not-call list.` });
      setReason('');
      setNotes('');
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) keyRef.current = null;
      setError(errorMessage(e, 'The rejection could not be saved.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      isOpen={open}
      onClose={close}
      title="Customer asked not to be called"
      description="Records an inbound do-not-call without starting a contact. The business leaves every calling bucket and open follow-ups are cancelled."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={reason.trim().length < 3 || busy} isLoading={busy} onClick={submit}>
            Mark do not call
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Textarea label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <Alert tone="danger" title={error} />}
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------- contact panel */

export function ContactPanel({
  w,
  session,
  isOwner,
  onStart,
  onReopen,
  onRequeue,
  onInbound,
  onRetry,
}: {
  w: WorkspaceDto;
  session: ContactSession;
  isOwner: boolean;
  /** Re-fetch the workspace (SCR-CC-005 Retry). */
  onRetry?: () => void;
  onStart: () => void;
  onReopen: () => void;
  onRequeue: () => void;
  onInbound: () => void;
}) {
  const f = useCallingFormat();
  const rejected = w.state.outcome === 'rejected';
  const other = w.reservation.state === 'other' || session.conflict !== null;
  const holder = session.conflict?.holderName ?? w.reservation.holderName ?? 'another agent';
  const canStart = w.allowed.startContact && !other && !w.archived;
  const reason = rejected
    ? 'Start Contact is disabled: this business is marked do not call.'
    : w.archived
      ? 'Start Contact is disabled: this business is archived.'
      : !w.assignment
        ? 'Start Contact is disabled: this business is not assigned to anyone.'
        : !w.assignment.isMe && !isOwner
          ? 'Start Contact is disabled: this business is not assigned to you.'
          : other
            ? `Start Contact is disabled while ${holder} holds the reservation.`
            : !w.allowed.startContact
              ? 'Start Contact is not available for this business right now.'
              : 'Opens the log-attempt panel. The reservation is released only after you save the attempt or cancel.';
  const fu = w.openFollowUp;
  const latest = w.attempts.find((a) => a.notes);
  const canInbound = !rejected && !w.archived && !!w.assignment && (w.assignment.isMe || isOwner);
  return (
    <CardSection title="Contact" subtitle={w.reservation.state === 'mine' ? 'Reserved by you' : 'Read mode · not reserved'}>
      {w.access.level === 'context_limited' && (
        <Alert tone="info" title="Limited view" body="You see only the fields needed for your work on this business." />
      )}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-text-secondary">Current outcome</span>
        <OutcomeBadge outcome={OUTCOME_LABEL[w.state.outcome]} />
      </div>
      {w.state.callbackMarker && (
        <Badge tone="warning" derived>
          Callback to be scheduled
        </Badge>
      )}
      {rejected && w.state.rejectionReason && <p className="text-sm text-text-secondary">Reason: {w.state.rejectionReason}</p>}
      {fu && (
        <div>
          <div className="text-sm text-text-secondary mb-1.5">Next follow-up</div>
          <div className="flex items-center gap-3 rounded-lg border border-border-subtle p-3">
            <Icon name="calendar" size={18} className="text-status-brand-fg" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-primary">{f.weekdayTime(fu.scheduledFor)}</div>
              <div className="text-[13px] text-text-muted">
                {fu.purpose ? `${fu.purpose} · ` : ''}
                {fu.responsibleName}
              </div>
            </div>
            {(fu.overdue || fu.due) && <Badge tone={fu.overdue ? 'danger' : 'warning'}>{fu.overdue ? 'Overdue' : 'Due now'}</Badge>}
          </div>
        </div>
      )}
      {latest && (
        <div>
          <div className="text-sm text-text-secondary mb-1.5">Latest note</div>
          <blockquote className="rounded-lg border-l-4 border-border-strong bg-surface-subtle p-3 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{latest.agentName}</span>{' '}
            <span className="text-text-muted text-[13px]">{f.dayTime(latest.attemptedAt)}</span>
            <p className="mt-1 whitespace-pre-line break-words">{latest.notes}</p>
          </blockquote>
        </div>
      )}
      {other && (
        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 space-y-2" aria-label="Reservation details">
          <div className="text-sm font-medium text-text-primary">Reserved by {holder}</div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-[13px]">
            <dt className="text-text-muted">Since</dt>
            <dd className="text-text-primary">{(session.conflict?.acquiredAt ?? w.reservation.acquiredAt) ? f.dayTime((session.conflict?.acquiredAt ?? w.reservation.acquiredAt) as string) : '—'}</dd>
            <dt className="text-text-muted">Lease ends</dt>
            <dd className="text-text-primary">{(session.conflict?.leaseExpiresAt ?? w.reservation.leaseExpiresAt) ? f.dayTime((session.conflict?.leaseExpiresAt ?? w.reservation.leaseExpiresAt) as string) : '—'}</dd>
            <dt className="text-text-muted">Your assignment</dt>
            <dd className="text-text-primary">{w.assignment ? (w.assignment.isMe ? 'Assigned to you' : `Assigned to ${w.assignment.assigneeName}`) : 'Not assigned'}</dd>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={onRetry} disabled={!onRetry} leadingIcon={<Icon name="refresh" size={14} />}>
              Retry
            </Button>
            <Link href="/queue" className="inline-flex items-center h-8 px-3 rounded-md text-sm font-medium text-text-link hover:underline">
              Back to queue
            </Link>
          </div>
        </div>
      )}
      <p className="text-[13px] text-text-muted">Calls are placed outside the app. Start Contact reserves this business so nobody else contacts it at the same time.</p>
      {session.startError && (
        <Alert
          tone="danger"
          title={
            session.startError.code === 'STATE_CONFLICT'
              ? 'This business can no longer be contacted'
              : session.startError.isPermissionDenied
                ? 'You do not have permission to start this contact'
                : 'The contact could not be started'
          }
          body={session.startError.message}
        />
      )}
      <div className="pt-2 border-t border-border-subtle flex flex-col gap-2">
        <Button fullWidth size="lg" disabled={!canStart || session.phase === 'starting'} isLoading={session.phase === 'starting'} onClick={onStart} leadingIcon={<Icon name="phone" size={16} />}>
          Start Contact
        </Button>
        <p className="text-[13px] text-text-muted">{reason}</p>
        {canInbound && (
          <Button variant="ghost" size="sm" onClick={onInbound} leadingIcon={<Icon name="ban" size={14} />}>
            Customer asked not to be called…
          </Button>
        )}
        {w.allowed.reopen && (
          <div className="flex flex-col gap-1">
            <Button variant="secondary" onClick={onReopen} leadingIcon={<Icon name="refresh" size={16} />}>
              Reopen…
            </Button>
            <PolicyPendingChip dec="DEC-016" demo />
          </div>
        )}
        {w.allowed.requeue && (
          <Button variant="secondary" onClick={onRequeue} leadingIcon={<Icon name="refresh" size={16} />}>
            Re-queue…
          </Button>
        )}
      </div>
    </CardSection>
  );
}
