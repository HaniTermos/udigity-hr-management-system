'use client';

import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Select, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/State';
import { ApiErrorView } from '@/components/states';
import {
  getReassignImpact,
  overrideReservation,
  reassignBusiness,
  unassignBusiness,
  type AssignmentListItem,
  type FollowUpChoice,
  type ReassignImpactDto } from '@/lib/api/assignments';
import { ApiError } from '@/lib/api/client';
import { classifyError, type ErrorRoute } from '@/lib/errorRouting';
import { cn } from '@/lib/utils';
import { formatDayTime } from './format';

export interface AgentOption {
  id: string;
  name: string;
}

export interface ReassignImpactDialogProps {
  mode: 'reassign' | 'unassign';
  row: AssignmentListItem | null;
  agents: AgentOption[];
  timeZone: string;
  /** "2 of 5" when several businesses are unassigned one after another. */
  progress?: string;
  onClose: () => void;
  /** Saved (message for the toast). */
  onDone: (message: string, businessId: string) => void;
  /** The preview or a 409 showed a live reservation for this business. */
  onReservationSeen?: (businessId: string) => void;
}

type ReservationChoice = '' | 'wait' | 'override';
type ChoiceValue = '' | 'transfer' | 'cancel' | 'keep';

/** Codes that do not block an unassign (they describe the *new* assignee, which an unassign does not have). */
const ASSIGNEE_ONLY_CODES = new Set(['same_assignee', 'assignee_ineligible']);
const MIN_REASON = 3;

export function ReassignImpactDialog(props: ReassignImpactDialogProps) {
  // Keyed remount resets every choice when a different business (or mode) opens.
  if (!props.row) return null;
  return <DialogBody key={`${props.row.businessId}:${props.mode}`} {...props} />;
}

function DialogBody({ mode, row, agents, timeZone, progress, onClose, onDone, onReservationSeen }: ReassignImpactDialogProps) {
  const current = row?.assignment ?? null;
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [choices, setChoices] = useState<Record<string, ChoiceValue>>({});
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [reservationChoice, setReservationChoice] = useState<ReservationChoice>('');
  const [step, setStep] = useState<'form' | 'override'>('form');
  const [overrideReason, setOverrideReason] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ title: string; body?: string } | null>(null);
  const [conflict, setConflict] = useState(false);

  const businessId = row?.businessId ?? null;
  const previewAssigneeId = mode === 'unassign' ? current?.assigneeId ?? '' : newAssigneeId;

  const impactState = useSWR<ReassignImpactDto, ApiError>(
    businessId && previewAssigneeId ? ['reassign-impact', businessId, previewAssigneeId] : null,
    () => getReassignImpact({ businessId: businessId as string, newAssigneeId: previewAssigneeId }),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const impact = impactState.data ?? null;
  const loading = impactState.isLoading;
  const loadRoute: ErrorRoute | null = impactState.error ? classifyError(impactState.error) : null;
  const loadImpact = () => impactState.mutate();

  const reservationFound = impact?.activeReservation ? businessId : null;
  useEffect(() => {
    if (reservationFound) onReservationSeen?.(reservationFound);
  }, [reservationFound, onReservationSeen]);

  const blockers = useMemo(
    () => (impact?.ineligible ?? []).filter((i) => mode === 'reassign' || !ASSIGNEE_ONLY_CODES.has(i.code)),
    [impact, mode]
  );
  const followUps = impact?.openFollowUps ?? [];
  const reservation = impact?.activeReservation ?? null;

  const choiceOptions =
    mode === 'reassign'
      ? [
          { value: 'transfer', label: `Transfer to ${agents.find((a) => a.id === newAssigneeId)?.name ?? 'new assignee'}` },
          { value: 'cancel', label: 'Cancel (reason required)' },
          { value: 'keep', label: `Keep with ${current?.assigneeName ?? 'current assignee'} (warning)` },
        ]
      : [
          { value: 'cancel', label: 'Cancel (reason required)' },
          { value: 'keep', label: `Keep with ${current?.assigneeName ?? 'current assignee'} (warning)` },
        ];

  const followUpsComplete = followUps.every((f) => {
    const c = choices[f.id];
    if (!c) return false;
    return c !== 'cancel' || (cancelReasons[f.id] ?? '').trim().length >= MIN_REASON;
  });
  const reservationResolved = !reservation || reservationChoice === 'override';
  const reasonOk = reason.trim().length >= MIN_REASON;
  const ready =
    Boolean(impact) &&
    !loading &&
    blockers.length === 0 &&
    followUpsComplete &&
    reasonOk &&
    reservationResolved &&
    (mode === 'unassign' || Boolean(newAssigneeId));

  const missing: string[] = [];
  if (mode === 'reassign' && !newAssigneeId) missing.push('the new assignee');
  if (reservation && reservationChoice !== 'override') missing.push('the reservation');
  if (followUps.some((f) => !choices[f.id])) missing.push('each follow-up');
  if (!reasonOk) missing.push('a reason');

  function buildChoices(): FollowUpChoice[] {
    return followUps.map((f) => {
      const c = choices[f.id];
      if (c === 'cancel') return { followUpId: f.id, action: 'cancel', reason: (cancelReasons[f.id] ?? '').trim() };
      return { followUpId: f.id, action: c === 'transfer' ? 'transfer' : 'keep' };
    });
  }

  async function submit(overrideFirst: boolean) {
    if (!row || !current || !impact) return;
    setSaving(true);
    setSaveError(null);
    setConflict(false);
    try {
      let overrideId: string | undefined;
      if (overrideFirst && reservation) {
        await overrideReservation(reservation.id, overrideReason.trim());
        overrideId = reservation.id;
      }
      if (mode === 'reassign') {
        await reassignBusiness({
          businessId: row.businessId,
          newAssigneeId,
          version: current.version,
          reason: reason.trim(),
          followUps: buildChoices(),
          reservationOverrideId: overrideId,
        });
        const to = agents.find((a) => a.id === newAssigneeId)?.name ?? 'the new assignee';
        onDone(`${row.businessName} reassigned to ${to}`, row.businessId);
      } else {
        await unassignBusiness({ businessId: row.businessId, version: current.version, reason: reason.trim(), followUps: buildChoices() });
        onDone(`${row.businessName} unassigned`, row.businessId);
      }
    } catch (e) {
      setStep('form');
      const err = e instanceof ApiError ? e : null;
      if (err?.isVersionConflict) {
        setConflict(true);
      } else if (err?.code === 'STATE_CONFLICT' && (err.details as { reason?: string } | undefined)?.reason === 'reservation_active') {
        setSaveError({ title: 'A call started on this contact', body: 'Someone is working on it now. Choose Wait or Override, then save again.' });
        void loadImpact();
      } else if (err?.status === 422 || err?.code === 'RULE_VIOLATION') {
        setSaveError({ title: 'This change cannot be saved', body: err.message });
      } else {
        const route = classifyError(e);
        setSaveError({
          title: route.kind === 'offline' ? 'You are offline' : 'Could not save',
          body: route.kind === 'offline' ? 'Nothing was saved. Try again when your connection returns.' : 'Nothing was saved. Try again.',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const title = row ? `${mode === 'reassign' ? 'Reassign' : 'Unassign'} ${row.businessName}` : '';
  const holder = reservation?.holderName ?? '';

  if (step === 'override' && reservation) {
    const valid = overrideReason.trim().length >= MIN_REASON;
    return (
      <Dialog
        isOpen={Boolean(row)}
        onClose={saving ? () => undefined : () => setStep('form')}
        title={`Override ${holder}'s reservation?`}
        description={`${holder}'s contact on ${row?.businessName} ends now and they see an "overridden by Owner" notice.`}
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStep('form')} disabled={saving}>
              Back
            </Button>
            <Button variant="destructive" onClick={() => void submit(true)} disabled={!valid} isLoading={saving}>
              {mode === 'reassign' ? 'Override and reassign' : 'Override and unassign'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="Reason"
            required
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            helperText="Recorded with the override and the change."
            rows={3}
          />
          {saveError && <Alert tone="danger" title={saveError.title} body={saveError.body} />}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      isOpen={Boolean(row)}
      onClose={saving ? () => undefined : onClose}
      title={title}
      description={
        current
          ? mode === 'reassign'
            ? `From ${current.assigneeName}${newAssigneeId ? ` to ${agents.find((a) => a.id === newAssigneeId)?.name ?? ''}` : ''}. Choose what happens to each item before saving.${progress ? ` (${progress})` : ''}`
            : `Currently ${current.assigneeName}. The business returns to the unassigned pool. Choose what happens to each item before saving.${progress ? ` (${progress})` : ''}`
          : undefined
      }
      maxWidth="lg"
      footer={
        <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-text-muted">
            {ready ? 'Every choice is made.' : `${mode === 'reassign' ? 'Reassign' : 'Unassign'} stays disabled until you choose ${missing.join(', ') || '…'}.`}
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={!ready}
              isLoading={saving}
              onClick={() => (reservation ? setStep('override') : void submit(false))}
            >
              {mode === 'reassign' ? 'Reassign' : 'Unassign'}
            </Button>
          </div>
        </div>
      }
    >
      {row && current && (
        <div className="space-y-5">
          {mode === 'reassign' && (
            <Select
              label="New assignee"
              required
              value={newAssigneeId}
              onChange={(e) => setNewAssigneeId(e.target.value)}
              placeholder="Choose an active Call Center agent…"
              options={agents.filter((a) => a.id !== current.assigneeId).map((a) => ({ value: a.id, label: a.name }))}
            />
          )}

          {!previewAssigneeId ? (
            <p className="text-[13px] text-text-secondary">Choose the new assignee to preview what the change affects.</p>
          ) : loading && !impact ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : loadRoute ? (
            <ApiErrorView route={loadRoute} onRetry={() => void loadImpact()} what="the reassignment preview" size="inline" area="Calling assignments" />
          ) : impact ? (
            <>
              {conflict && (
                <Alert tone="warning" role="alert" title="This assignment changed while you were editing" body="Someone else saved a change. Nothing was overwritten and your choices are kept. Reload the latest assignment, then save again.">
                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setConflict(false);
                        onClose();
                      }}
                    >
                      Reload latest
                    </Button>
                  </div>
                </Alert>
              )}
              {saveError && <Alert tone="danger" role="alert" title={saveError.title} body={saveError.body} />}

              {blockers.length > 0 && (
                <Alert tone="warning" title="This business cannot be changed" >
                  <ul className="mt-1 list-disc pl-5 text-[13px]">
                    {blockers.map((b) => (
                      <li key={b.code}>{b.message}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {reservation && (
                <section aria-label="Active reservation" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">Active reservation</h3>
                  </div>
                  <p className="flex items-center gap-2 text-[13px] text-text-primary">
                    <Icon name="lock" size={14} className="text-icon-default" />
                    Reserved by {reservation.holderName} until {formatDayTime(reservation.leaseExpiresAt, timeZone)} — a call is in progress.
                  </p>
                  <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
                    <legend className="sr-only">Reservation choice</legend>
                    {(
                      [
                        { v: 'wait', label: 'Wait — save nothing now' },
                        { v: 'override', label: 'Override the reservation (reason next)' },
                      ] as const
                    ).map((o) => (
                      <label key={o.v} className="inline-flex items-center gap-2 text-[13px] text-text-primary cursor-pointer">
                        <input
                          type="radio"
                          name="reservation-choice"
                          className="h-4 w-4 accent-[var(--brand-accent)]"
                          checked={reservationChoice === o.v}
                          onChange={() => {
                            setReservationChoice(o.v);
                            if (o.v === 'wait') onClose();
                          }}
                        />
                        {o.label}
                      </label>
                    ))}
                  </fieldset>
                </section>
              )}

              <section aria-label="Open follow-ups" className="space-y-3 border-t border-border-subtle pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">Open follow-ups · {followUps.length}</h3>
                </div>
                {followUps.length === 0 ? (
                  <p className="text-[13px] text-text-secondary">No open follow-ups. Nothing to decide.</p>
                ) : (
                  <ul className="space-y-3">
                    {followUps.map((f) => {
                      const responsible = f.responsibleId === current.assigneeId ? current.assigneeName : 'Another agent';
                      return (
                        <li key={f.id} className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(0,16rem)] gap-2 sm:gap-4 sm:items-start">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-text-primary">Follow-up · {formatDayTime(f.scheduledFor, timeZone)}</div>
                            <div className="text-xs text-text-muted">Owner: {responsible}</div>
                          </div>
                          <div className="space-y-2">
                            <Select
                              aria-label={`Choice for follow-up on ${formatDayTime(f.scheduledFor, timeZone)}`}
                              value={choices[f.id] ?? ''}
                              onChange={(e) => setChoices((prev) => ({ ...prev, [f.id]: e.target.value as ChoiceValue }))}
                              placeholder="Choose…"
                              options={choiceOptions}
                            />
                            {choices[f.id] === 'cancel' && (
                              <Textarea
                                aria-label="Reason for cancelling this follow-up"
                                placeholder="Reason for cancelling (required)"
                                rows={2}
                                value={cancelReasons[f.id] ?? ''}
                                onChange={(e) => setCancelReasons((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              />
                            )}
                            {choices[f.id] === 'keep' && (
                              <p className="text-xs text-status-warning-fg">
                                The follow-up stays with {current.assigneeName}, who no longer owns this business.
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <dl className={cn('grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-3 border-t border-border-subtle pt-4 text-[13px]')}>
                <dt className="text-text-secondary">&ldquo;Callback to be scheduled&rdquo; marker</dt>
                <dd className="text-text-primary">
                  {impact.callbackMarker
                    ? `Present · ${mode === 'reassign' ? `shows in ${agents.find((a) => a.id === newAssigneeId)?.name ?? 'the new assignee'}'s queue` : 'returns to the pool with the business'}`
                    : 'Not set'}
                </dd>
              </dl>


              <Textarea
                label="Reason"
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                helperText="Recorded in the audit log with the change."
              />
            </>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
