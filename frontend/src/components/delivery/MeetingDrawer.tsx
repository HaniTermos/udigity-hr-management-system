'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { DateInput, Select, Textarea } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { cancelMeeting, recordMeetingOutcome, rescheduleMeeting, type Meeting } from '@/lib/api/meetings';
import { ActionError, fieldMessage, fmtDayMonth, fmtTime, MEETING_STATUS_LABEL, MEETING_TONE, toLocalInput } from './shared';

type Mode = 'outcome' | 'reschedule' | 'cancel';

/** Fields compared on a 409 (SCR-SHR-014). */
export const MEETING_CONFLICT_LABELS = [
  { key: 'status', label: 'Status' },
  { key: 'time', label: 'Time' },
  { key: 'notes', label: 'Outcome notes' },
];

export function describeMeeting(m: Meeting): Record<string, string> {
  return {
    status: MEETING_STATUS_LABEL[m.status],
    time: `${fmtDayMonth(m.startsAt)} ${fmtTime(m.startsAt)}${m.endsAt ? `–${fmtTime(m.endsAt)}` : ''}`,
    notes: m.discoveryNotes ?? m.cancelReason ?? '',
  };
}

type Send =
  | { mode: 'outcome'; outcome: 'held'; discoveryNotes: string; mine: Record<string, string> }
  | { mode: 'outcome'; outcome: 'missed'; note?: string; mine: Record<string, string> }
  | { mode: 'reschedule'; startsAt: string; endsAt?: string; reason?: string; mine: Record<string, string> }
  | { mode: 'cancel'; reason: string; mine: Record<string, string> };

/** SCR-DEV-004: record outcome, reschedule, cancel. Buttons come from `meeting.allowed`. Schedule-new is a separate drawer. */
export function MeetingDrawer({
  meeting,
  onClose,
  onChanged,
  onConflict,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onChanged: () => void;
  onConflict: (meeting: Meeting, mine: Record<string, string>) => void;
}) {
  if (!meeting) return null;
  // Keyed so the form state resets whenever a different meeting (or version) is opened.
  return <MeetingDrawerBody key={`${meeting.id}:${meeting.version}`} meeting={meeting} onClose={onClose} onChanged={onChanged} onConflict={onConflict} />;
}

function MeetingDrawerBody({
  meeting: m,
  onClose,
  onChanged,
  onConflict,
}: {
  meeting: Meeting;
  onClose: () => void;
  onChanged: () => void;
  onConflict: (meeting: Meeting, mine: Record<string, string>) => void;
}) {
  const toast = useToast();
  const modes: { id: Mode; label: string }[] = [
    ...(m.allowed.recordOutcome ? [{ id: 'outcome' as const, label: 'Record outcome' }] : []),
    ...(m.allowed.reschedule ? [{ id: 'reschedule' as const, label: 'Reschedule' }] : []),
    ...(m.allowed.cancel ? [{ id: 'cancel' as const, label: 'Cancel' }] : []),
  ];
  const [mode, setMode] = useState<Mode>(modes[0]?.id ?? 'reschedule');
  const [outcome, setOutcome] = useState<'held' | 'missed'>('held');
  const [note, setNote] = useState(m.discoveryNotes ?? '');
  const [start, setStart] = useState(toLocalInput(m.startsAt));
  const [end, setEnd] = useState(m.endsAt ? toLocalInput(m.endsAt) : '');
  const [reason, setReason] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});

  const label = (s: Send) => (s.mode === 'outcome' ? 'Outcome saved' : s.mode === 'cancel' ? 'Meeting cancelled' : 'Meeting rescheduled');
  const { status, conflict, fieldErrors, error, route, save, retry } = useVersionedSave<Send, Meeting>(
    async (s, ctx) => {
      if (s.mode === 'outcome') {
        return recordMeetingOutcome(
          m.id,
          s.outcome === 'held'
            ? { version: ctx.version, outcome: 'held', discoveryNotes: s.discoveryNotes }
            : { version: ctx.version, outcome: 'missed', note: s.note }
        );
      }
      if (s.mode === 'cancel') return cancelMeeting(m.id, { version: ctx.version, reason: s.reason });
      return rescheduleMeeting(m.id, { version: ctx.version, startsAt: s.startsAt, endsAt: s.endsAt, reason: s.reason });
    }
  );

  const reported = useRef<unknown>(null);
  useEffect(() => {
    if (conflict && reported.current !== conflict) {
      reported.current = conflict;
      onConflict(m, conflict.attempted.mine);
      onClose();
    }
  }, [conflict, m, onConflict, onClose]);

  const busy = status === 'saving';

  async function submit() {
    const next: Record<string, string> = {};
    let send: Send | null = null;
    if (mode === 'outcome') {
      if (outcome === 'held' && !note.trim()) next.discoveryNotes = 'Add the discovery notes.';
      send =
        outcome === 'held'
          ? { mode, outcome, discoveryNotes: note.trim(), mine: { status: MEETING_STATUS_LABEL.held, notes: note.trim() } }
          : { mode, outcome, note: note.trim() || undefined, mine: { status: MEETING_STATUS_LABEL.missed } };
    } else if (mode === 'cancel') {
      if (reason.trim().length < 3) next.reason = 'A cancel reason of at least 3 characters is required.';
      send = { mode, reason: reason.trim(), mine: { status: MEETING_STATUS_LABEL.cancelled, notes: reason.trim() } };
    } else {
      if (!start) next.startsAt = 'Choose a start time.';
      else if (new Date(start).getTime() < Date.now()) next.startsAt = 'The new time cannot be in the past.';
      if (end && start && new Date(end) <= new Date(start)) next.endsAt = 'End must be after start.';
      send = {
        mode,
        startsAt: start ? new Date(start).toISOString() : '',
        endsAt: end ? new Date(end).toISOString() : undefined,
        reason: reason.trim() || undefined,
        mine: { time: `${fmtDayMonth(start)} ${fmtTime(start)}${end ? `–${fmtTime(end)}` : ''}` },
      };
    }
    setLocal(next);
    if (Object.keys(next).length > 0 || !send) return;
    const saved = await save(send, m.version);
    if (saved) {
      toast.show({ tone: 'success', title: label(send) });
      onChanged();
      onClose();
    }
  }

  const err = (key: string, ...alt: string[]) => local[key] ?? fieldMessage(fieldErrors, key, ...alt);
  const actionable = modes.length > 0;

  return (
    <Drawer
      isOpen
      onClose={busy ? () => undefined : onClose}
      title={m.businessName ?? m.dealCode ?? 'Meeting'}
      subtitle={`${m.title ?? 'Meeting'} · ${fmtDayMonth(m.startsAt)} · ${fmtTime(m.startsAt)}${m.endsAt ? `–${fmtTime(m.endsAt)}` : ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {actionable && (
            <Button variant={mode === 'cancel' ? 'destructive' : 'primary'} onClick={() => void submit()} isLoading={busy} disabled={busy}>
              {mode === 'outcome' ? 'Save outcome' : mode === 'cancel' ? 'Cancel meeting' : 'Save new time'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={MEETING_TONE[m.status]} hasDot>
            {MEETING_STATUS_LABEL[m.status]}
          </Badge>
          {m.awaitingOutcome && (
            <Badge tone="danger" derived>
              Outcome due
            </Badge>
          )}
          <span className="text-[13px] text-text-muted">
            {m.dealCode} · {m.attendees.length} attendee{m.attendees.length === 1 ? '' : 's'}
            {m.rescheduleCount > 0 ? ` · rescheduled ${m.rescheduleCount}×` : ''}
          </span>
        </div>
        {(m.location || m.agenda) && (
          <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3.5 space-y-1 text-text-secondary">
            {m.location && <p>Location: {m.location}</p>}
            {m.agenda && <p>{m.agenda}</p>}
          </div>
        )}
        {m.attendees.length > 0 && <p className="text-[13px] text-text-muted">{m.attendees.map((a) => a.fullName).join(', ')}</p>}

        {actionable ? (
          <>
            {modes.length > 1 && <Tabs style="segmented" activeId={mode} onChange={(id) => setMode(id as Mode)} items={modes} />}
            {mode === 'outcome' && (
              <div className="space-y-3">
                <Select
                  label="Outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as 'held' | 'missed')}
                  options={[
                    { value: 'held', label: 'Held' },
                    { value: 'missed', label: 'Missed' },
                  ]}
                />
                <Textarea
                  label={outcome === 'held' ? 'Discovery notes' : 'Note (optional)'}
                  required={outcome === 'held'}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  error={err('discoveryNotes', 'note')}
                />
              </div>
            )}
            {mode === 'reschedule' && (
              <div className="space-y-3">
                <DateInput kind="datetime" label="Start" required value={start} onChange={(e) => setStart(e.target.value)} error={err('startsAt')} />
                <DateInput kind="datetime" label="End (optional)" value={end} onChange={(e) => setEnd(e.target.value)} error={err('endsAt')} />
                <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} error={err('reason')} />
                <p className="text-[13px] text-text-muted">The previous time stays in the meeting history.</p>
              </div>
            )}
            {mode === 'cancel' && (
              <div className="space-y-2">
                <Textarea label="Cancel reason" required value={reason} onChange={(e) => setReason(e.target.value)} error={err('reason')} />
                <p className="text-[13px] text-text-muted">Cancelling is final: a cancelled meeting cannot be reopened.</p>
              </div>
            )}
            <ActionError route={route} error={error} onRetry={() => void retry()} />
          </>
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3.5 space-y-1 text-text-secondary">
            {m.allowed.viewNotes && m.discoveryNotes && <p>{m.discoveryNotes}</p>}
            {m.cancelReason && <p>Cancelled: {m.cancelReason}</p>}
            {!m.discoveryNotes && !m.cancelReason && <p>No further actions on a {MEETING_STATUS_LABEL[m.status].toLowerCase()} meeting.</p>}
          </div>
        )}
      </div>
    </Drawer>
  );
}
