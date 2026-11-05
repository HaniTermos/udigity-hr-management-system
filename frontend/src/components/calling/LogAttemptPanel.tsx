'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge, OutcomeBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSection } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import { Checkbox, DateInput, Input, Textarea } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { useErrorRouter } from '@/lib/hooks/useErrorRouter';
import {
  logAttempt,
  type CallOutcome,
  type FollowUpInput,
  type LogAttemptBody,
  type LogAttemptResultDto,
  type ReservationLostDetails,
  type ReservationLostReason,
  type WorkspaceDto } from '@/lib/api/calling';
import { OUTCOME_LABEL, useCallingFormat } from './format';
import type { ContactSession } from './hooks';

/** Four equal-weight outcomes, no default (Phase 6 rule). Pending is a system state, not selectable. */
const CHOICES: { id: CallOutcome; label: string; dot: string }[] = [
  { id: 'on_hold', label: 'On hold — no answer', dot: 'bg-status-warning-solid' },
  { id: 'needs_another_call', label: 'Needs another call — call later', dot: 'bg-status-info-solid' },
  { id: 'rejected', label: 'Rejected — do not call', dot: 'bg-status-danger-solid' },
  { id: 'accepted', label: 'Accepted — creates opportunity', dot: 'bg-status-success-solid' },
];

type FollowMode = 'none' | 'now' | 'later';

interface Draft {
  outcome: CallOutcome;
  keep: boolean;
  followMode: FollowMode;
  when: string;
  purpose: string;
  notes: string;
  rejectionReason: string;
  clientNeeds: string;
  serviceInterest: string;
  fulfils: boolean;
  /** After a stale-follow-up conflict: keep the follow-up someone else set, or replace it with mine. */
  keepLatestFollowUp: boolean;
}

/** Pure: the BE3-C1 request body for a draft. U-01: keepReservation is never sent as true for Rejected. */
export function buildAttemptBody(
  d: Draft,
  ctx: { businessId: string; reservationId: string; leaseToken: string; stateVersion: number; toIso: (local: string) => string; latestFollowUp: { scheduledFor: string; purpose: string | null } | null; fulfilsId: string | null }
): LogAttemptBody {
  const common = {
    businessId: ctx.businessId,
    reservationId: ctx.reservationId,
    leaseToken: ctx.leaseToken,
    stateVersion: ctx.stateVersion,
    ...(d.notes.trim() ? { notes: d.notes.trim() } : {}),
    ...(d.fulfils && ctx.fulfilsId ? { fulfilsFollowUpId: ctx.fulfilsId } : {}),
    keepReservation: d.outcome === 'rejected' ? false : d.keep,
  };
  const followUp = (): FollowUpInput | undefined => {
    if (d.keepLatestFollowUp && ctx.latestFollowUp) {
      return { scheduledFor: ctx.latestFollowUp.scheduledFor, ...(ctx.latestFollowUp.purpose ? { purpose: ctx.latestFollowUp.purpose } : {}) };
    }
    if (d.followMode === 'now' && d.when) return { scheduledFor: ctx.toIso(d.when), ...(d.purpose.trim() ? { purpose: d.purpose.trim() } : {}) };
    return undefined;
  };
  switch (d.outcome) {
    case 'on_hold': {
      const fu = followUp();
      return { ...common, outcome: 'on_hold', ...(fu ? { followUp: fu } : {}) };
    }
    case 'needs_another_call': {
      const fu = followUp();
      return fu ? { ...common, outcome: 'needs_another_call', followUp: fu } : { ...common, outcome: 'needs_another_call', callbackToBeScheduled: true };
    }
    case 'rejected':
      return { ...common, outcome: 'rejected', rejectionReason: d.rejectionReason.trim() };
    case 'accepted':
      return {
        ...common,
        outcome: 'accepted',
        clientNeedsNote: d.clientNeeds.trim(),
        ...(d.serviceInterest.trim() ? { serviceInterest: d.serviceInterest.trim() } : {}),
      };
  }
}

/** The reason an RESERVATION_LOST response carries, for the banner copy. */
function lostReasonOf(e: ApiError | null): ReservationLostReason {
  return ((e?.details as ReservationLostDetails | undefined)?.reason ?? 'lease_elapsed') as ReservationLostReason;
}

/**
 * SCR-CC-003 log attempt panel, wired to POST /api/calling/attempts (Idempotency-Key kept across retries of the same
 * save, new key per new save). U-01 (the only approved rule): "Save, keep reservation" is offered for every outcome
 * except Rejected, read from `workspace.allowed.keepReservation`. Draft text is never cleared by a failed save.
 */
export function LogAttemptPanel({
  w,
  session,
  saved,
  onSaved,
  onDismissSaved,
  onRefresh,
  onCancel,
}: {
  w: WorkspaceDto;
  session: ContactSession;
  saved: LogAttemptResultDto | null;
  onSaved: (r: LogAttemptResultDto) => void;
  onDismissSaved: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}) {
  const f = useCallingFormat();
  const toast = useToast();
  const routeError = useErrorRouter();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>('now');
  const [when, setWhen] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [clientNeeds, setClientNeeds] = useState('');
  const [serviceInterest, setServiceInterest] = useState('');
  const dueFollowUp = w.openFollowUp && (w.openFollowUp.due || w.openFollowUp.overdue) ? w.openFollowUp : null;
  const [fulfils, setFulfils] = useState(true);
  const [choice, setChoice] = useState<'latest' | 'mine' | null>(null);
  const [attemptOnly, setAttemptOnly] = useState(false);
  const [openedFollowUpVersion] = useState(w.openFollowUp ? `${w.openFollowUp.id}:${w.openFollowUp.version}` : null);

  const lease = session.lease;
  const policy = w.policy;

  const hook = useVersionedSave<{ draft: Draft }, LogAttemptResultDto>(
    async ({ draft }, ctx) => {
      if (!lease) throw new ApiError(409, { code: 'RESERVATION_LOST', error: 'No reservation', details: { reason: 'token_mismatch' } });
      return logAttempt(
        buildAttemptBody(draft, {
          businessId: w.businessId,
          reservationId: lease.id,
          leaseToken: lease.leaseToken,
          stateVersion: ctx.version,
          toIso: f.toIso,
          latestFollowUp: w.openFollowUp ? { scheduledFor: w.openFollowUp.scheduledFor, purpose: w.openFollowUp.purpose } : null,
          fulfilsId: dueFollowUp?.id ?? null,
        }),
        ctx.idempotencyKey
      );
    },
    {
      onSaved: (r) => {
        if (r.warning === 'outcome_not_applied' || r.reservation === 'lost') {
          // Save-after-loss, keepAttemptOnly branch (Demonstration alternative — not approved): attempt stored, outcome not.
          setAttemptOnly(true);
          if (session.phase !== 'lost') session.markLost(session.lostReason ?? 'lease_elapsed');
          toast.show({ tone: 'warning', title: 'Attempt saved, outcome not applied', body: 'Reopen the contact and apply the outcome again.' });
          onRefresh();
          return;
        }
        if (r.reservation === 'kept' && r.reservationLease) session.applyLease(r.reservationLease);
        else session.clear();
        toast.show({ tone: 'success', title: 'Attempt saved', body: r.reservation === 'kept' ? 'The reservation was kept.' : undefined });
        onSaved(r);
      },
    }
  );

  const { status, error, route, conflict } = hook;

  // 409 version conflict: reload the workspace; the draft stays in the form (nothing was saved).
  useEffect(() => {
    if (status === 'conflict') onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // RESERVATION_LOST (flag `reject`): the draft is kept, the banner explains, the agent reopens the contact.
  const lostError = error?.code === 'RESERVATION_LOST' ? error : null;
  useEffect(() => {
    if (lostError && session.phase === 'active') session.markLost(lostReasonOf(lostError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lostError]);

  useEffect(() => {
    if (route && route.kind === 'session-ended') routeError(error);
  }, [route, error, routeError]);

  const followUpChanged =
    status === 'conflict' || (openedFollowUpVersion !== null && w.openFollowUp !== null && openedFollowUpVersion !== `${w.openFollowUp.id}:${w.openFollowUp.version}`);
  const needsChoice = followUpChanged && !!w.openFollowUp && outcome === 'needs_another_call' && followMode === 'now' && !!when;

  const lost = session.phase === 'lost';
  const offline = session.offlineSince !== null;
  const allowedOutcomes = CHOICES.filter((c) => w.allowed.outcomes.includes(c.id));

  const whenPast = when !== '' && f.isPast(when);
  const followValid = followMode === 'later' || (when !== '' && !whenPast);
  const minLen = policy.acceptedNoteMinLength;
  const valid =
    outcome !== null &&
    (outcome === 'needs_another_call'
      ? followValid
      : outcome === 'on_hold'
        ? followMode !== 'now' || followValid
        : outcome === 'rejected'
          ? rejectionReason.trim().length >= 3
          : clientNeeds.trim().length >= minLen) &&
    (!needsChoice || choice !== null);

  const blockedByLoss = lost && policy.saveAfterReservationLoss === 'reject';
  const busy = status === 'saving';
  const canSubmit = valid && !busy && !offline && !blockedByLoss && !!lease;
  const keepOffered = !lost && (outcome === null || w.allowed.keepReservation[outcome]);
  const timing = session.timing;
  const expiring = session.phase === 'active' && !!timing && (timing.idleWarning || timing.maxTotalWarning);

  const submit = (keep: boolean) => {
    if (!outcome) return;
    const draft: Draft = {
      outcome,
      keep,
      followMode,
      when,
      purpose,
      notes,
      rejectionReason,
      clientNeeds,
      serviceInterest,
      fulfils,
      keepLatestFollowUp: needsChoice && choice === 'latest',
    };
    void hook.save({ draft }, w.state.version);
  };

  if (saved) return <SavedSummary r={saved} onClose={onDismissSaved} />;

  return (
    <CardSection
      title="Log call attempt"
      subtitle={`Attempt: ${f.dateLabel(new Date())} · ${f.time(new Date().toISOString())}`}
      action={
        expiring ? (
          <button type="button" onClick={() => void session.renewNow(true)} className="text-text-primary cursor-pointer hover:underline">
            Keep reservation
          </button>
        ) : (
          <button type="button" onClick={onCancel} className="text-text-primary cursor-pointer hover:underline">
            Cancel contact
          </button>
        )
      }
    >
      {attemptOnly && (
        <Alert
          tone="warning"
          title="Attempt saved, outcome not applied"
          body="The reservation had ended, so the attempt and your notes were stored but the outcome, follow-up and deal were not changed. Reopen the contact and apply the outcome again."
        />
      )}
      {status === 'conflict' && (
        <Alert
          tone="warning"
          title={w.openFollowUp ? 'Changed during your call. Nothing was saved.' : 'This business changed during your call. Nothing was saved.'}
          body={
            conflict?.currentVersion !== undefined
              ? 'The latest version is loaded. Your draft is kept; review it, then save again.'
              : 'Your draft is kept; review it, then save again.'
          }
        />
      )}
      {lost && !attemptOnly && (
        <Alert
          tone="warning"
          title={
            policy.saveAfterReservationLoss === 'reject'
              ? 'Saving is blocked until you reopen the contact'
              : 'You can still save, but the outcome will not be applied'
          }
          body={
            policy.saveAfterReservationLoss === 'reject'
              ? 'Your draft is kept. Reopen the contact, then save.'
              : 'Only the attempt and notes are stored. Reopen the contact to apply the outcome.'
          }
        />
      )}
      {error && !lostError && status === 'failed' && <SaveFailure error={error} route={route} onRetry={() => void hook.retry()} />}
      {lostError && <Alert tone="warning" title="Nothing was saved: the reservation ended" body="Your draft is kept. Reopen the contact, then save again." />}

      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary mb-1">
          Outcome <span aria-hidden>*</span>
        </legend>
        {allowedOutcomes.map((c) => (
          <React.Fragment key={c.id}>
            <label
              className={cn(
                'flex items-center gap-3 min-h-11 rounded-lg border bg-surface-default px-3 text-sm text-text-primary cursor-pointer hover:bg-surface-hover focus-within:ring-2 focus-within:ring-focus-ring',
                outcome === c.id ? 'border-border-selected bg-surface-selected ring-1 ring-border-selected' : 'border-border-default'
              )}
            >
              <input type="radio" name="outcome" className="accent-brand-accent" checked={outcome === c.id} onChange={() => {
                  setOutcome(c.id);
                  setFollowMode(c.id === 'on_hold' ? 'none' : 'now');
                }}
              />
              <span className={cn('h-2 w-2 rounded-full', c.dot)} aria-hidden />
              {c.label}
            </label>
            {outcome === c.id && c.id === 'needs_another_call' && (
              <FollowUpFields mode={followMode} onMode={setFollowMode} when={when} onWhen={setWhen} purpose={purpose} onPurpose={setPurpose} past={whenPast} later />
            )}
            {outcome === c.id && c.id === 'on_hold' && (
              <FollowUpFields mode={followMode === 'later' ? 'none' : followMode} onMode={setFollowMode} when={when} onWhen={setWhen} purpose={purpose} onPurpose={setPurpose} past={whenPast} optional />
            )}
            {outcome === c.id && c.id === 'rejected' && (
              <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 flex flex-col gap-2">
                <Textarea label="Reason for rejecting" required rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} helperText="At least 3 characters. The business moves to the do-not-call list; open follow-ups are cancelled." />
              </div>
            )}
            {outcome === c.id && c.id === 'accepted' && (
              <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 flex flex-col gap-3">
                <Textarea
                  label="What the client needs"
                  required
                  rows={3}
                  value={clientNeeds}
                  onChange={(e) => setClientNeeds(e.target.value)}
                  helperText={`At least ${minLen} characters (${policy.label}). Creates the opportunity for the developer.`}
                  counter={`${clientNeeds.trim().length}/${minLen}`}
                />
                <Input label="Service interest" value={serviceInterest} onChange={(e) => setServiceInterest(e.target.value)} />
                <p className="text-[13px] text-text-muted">Developer not yet assigned. The Owner or Call Center assigns one afterwards.</p>
              </div>
            )}
          </React.Fragment>
        ))}
      </fieldset>

      {needsChoice && w.openFollowUp && (
        <fieldset className="rounded-lg border border-border-subtle bg-surface-subtle p-3 flex flex-col gap-2 text-sm text-text-primary">
          <legend className="font-medium px-1">Which follow-up stays open? *</legend>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="fu-choice" className="accent-brand-accent" checked={choice === 'latest'} onChange={() => setChoice('latest')} />
            Keep latest · {f.weekdayTime(w.openFollowUp.scheduledFor)} ({w.openFollowUp.responsibleName})
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="fu-choice" className="accent-brand-accent" checked={choice === 'mine'} onChange={() => setChoice('mine')} />
            Replace with my draft · {when ? f.weekdayTime(f.toIso(when)) : ''}
          </label>
        </fieldset>
      )}

      {dueFollowUp && outcome !== null && (
        <Checkbox
          label={`This call fulfils the follow-up due ${f.weekdayTime(dueFollowUp.scheduledFor)}`}
          checked={fulfils}
          onChange={(e) => setFulfils(e.target.checked)}
        />
      )}

      <Textarea label="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-border-subtle">
        {offline ? (
          <Button variant="ghost" onClick={() => void session.renewNow(false)} leadingIcon={<Icon name="refresh" size={16} />}>
            Retry now
          </Button>
        ) : (
          keepOffered && (
            <Button variant="ghost" disabled={!canSubmit} onClick={() => submit(true)}>
              Save, keep reservation
            </Button>
          )
        )}
        <Button disabled={!canSubmit} isLoading={busy} onClick={() => submit(false)}>
          {lost && policy.saveAfterReservationLoss === 'keepAttemptOnly' ? 'Save attempt only' : status === 'conflict' ? 'Save again' : 'Save attempt'}
        </Button>
      </div>
      <p className="text-[13px] text-text-muted">
        {offline
          ? 'Saving is paused until the connection is back. Nothing is lost.'
          : status === 'conflict'
            ? 'One open follow-up either way; the reservation is released only after the save succeeds.'
            : 'Reservation is released only after the save succeeds.'}
      </p>
    </CardSection>
  );
}

function FollowUpFields({
  mode,
  onMode,
  when,
  onWhen,
  purpose,
  onPurpose,
  past,
  later,
  optional,
}: {
  mode: FollowMode;
  onMode: (m: FollowMode) => void;
  when: string;
  onWhen: (v: string) => void;
  purpose: string;
  onPurpose: (v: string) => void;
  past: boolean;
  later?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-primary">Follow-up{optional ? ' (optional)' : ''}</span>
        <Tabs
          style="segmented"
          activeId={mode}
          onChange={(id) => onMode(id as FollowMode)}
          items={
            later
              ? [
                  { id: 'now', label: 'Set now' },
                  { id: 'later', label: 'Set later' },
                ]
              : [
                  { id: 'none', label: 'None' },
                  { id: 'now', label: 'Set now' },
                ]
          }
        />
      </div>
      {mode === 'now' && (
        <>
          <DateInput
            kind="datetime"
            label="Date and time (company timezone)"
            required
            value={when}
            onChange={(e) => onWhen(e.target.value)}
            error={past ? 'Choose a time in the future. Past times are rejected.' : undefined}
          />
          <Input label="Purpose" value={purpose} onChange={(e) => onPurpose(e.target.value)} placeholder="What will you discuss?" />
        </>
      )}
      {mode === 'later' && <p className="text-[13px] text-text-muted">The business stays in “Callback to be scheduled” until you set a time.</p>}
    </div>
  );
}

function SaveFailure({ error, route, onRetry }: { error: ApiError; route: ReturnType<typeof useVersionedSave>['route']; onRetry: () => void }) {
  const kind = route?.kind;
  if (kind === 'permission-denied' || kind === 'owner-2fa-required')
    return <Alert tone="danger" title="You do not have permission to save this attempt" body="Nothing was saved. Your draft is kept." />;
  if (kind === 'hidden-by-policy' || kind === 'not-found')
    return <Alert tone="danger" title="This business is no longer available to you" body="Nothing was saved. Return to the queue." />;
  const retryable = kind === 'offline' || kind === 'error' || kind === 'rate-limited';
  const title =
    kind === 'offline'
      ? 'Saving failed: you are offline'
      : error.code === 'STATE_CONFLICT'
        ? 'This save is not allowed right now'
        : kind === 'validation'
          ? 'Check the highlighted details'
          : 'The attempt could not be saved';
  return (
    <Alert tone="danger" title={title} body={kind === 'offline' ? 'Your draft is kept. Retry when the connection returns; the same save is not duplicated.' : error.message}>
      {retryable && (
        <div className="mt-2">
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
      {error.requestId && <div className="mt-1 text-[11px] opacity-80">Reference {error.requestId}</div>}
    </Alert>
  );
}

/** SCR-CC-003 success (mobile preview): what the save did. */
function SavedSummary({ r, onClose }: { r: LogAttemptResultDto; onClose: () => void }) {
  const f = useCallingFormat();
  return (
    <CardSection title="Attempt saved" subtitle={`${f.dayTime(r.attempt.attemptedAt)} · ${r.attempt.agentName}`}>
      <Alert tone="success" title="Saved" body="The attempt and outcome were recorded together." />
      <ul className="flex flex-col gap-2 text-sm text-text-secondary">
        <li className="flex items-center gap-2">
          Outcome <OutcomeBadge outcome={OUTCOME_LABEL[r.state.outcome]} />
        </li>
        {r.followUp && <li>Follow-up scheduled for {f.weekdayTime(r.followUp.scheduledFor)}.</li>}
        {r.completedFollowUpId && <li>The follow-up this call fulfilled is completed.</li>}
        {r.cancelledFollowUpIds.length > 0 && <li>{r.cancelledFollowUpIds.length} open follow-up(s) cancelled.</li>}
        {r.state.callbackMarker && <li>Callback to be scheduled: set a time from Follow-ups.</li>}
        {r.dealId && (
          <li className="flex flex-wrap items-center gap-2">
            Opportunity created.{' '}
            <Badge tone={r.developerAssigned ? 'success' : 'warning'}>{r.developerAssigned ? 'Developer assigned' : 'Developer not yet assigned'}</Badge>
          </li>
        )}
        {r.reservation === 'kept' && <li>Reservation kept.</li>}
        {r.reservation === 'released' && <li>Reservation released.</li>}
        {r.reservation === 'release_failed' && <li>The reservation could not be released and will lapse at the end of its lease.</li>}
      </ul>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle">
        <Link href="/queue">
          <Button variant="secondary" tabIndex={-1}>
            Back to queue
          </Button>
        </Link>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </CardSection>
  );
}
