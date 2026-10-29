'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardSection } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Drawer } from '@/components/ui/Drawer';
import { DateInput, Input, Select, Textarea } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  newIdempotencyKey,
  D2_REPLACEMENT_REQUIRED,
  updateFollowUp,
  type FollowUpDto,
  type FollowUpReplacement } from '@/lib/api/calling';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks/useApi';
import { addDaysKey, useCallingFormat } from './format';

/* -------------------------------------------------------------- helpers */

/** A user-facing message for a failed follow-up command; a 409 means someone else changed the record. */
function commandError(e: unknown): { message: string; conflict: boolean; d2: boolean } {
  if (e instanceof ApiError) {
    if (e.isVersionConflict) return { message: 'Someone else changed this follow-up. The latest version is loaded; nothing was saved.', conflict: true, d2: false };
    const d2 = (e.details as { code?: string } | undefined)?.code === D2_REPLACEMENT_REQUIRED;
    if (e.isPermissionDenied || e.status === 403) return { message: 'You do not have permission to change this follow-up.', conflict: false, d2: false };
    if (e.status === 404 || e.isHiddenByPolicy) return { message: 'This follow-up is no longer available to you.', conflict: false, d2: false };
    if (e.status === 0) return { message: 'You are offline. Nothing was saved; try again when the connection returns.', conflict: false, d2: false };
    return { message: e.message, conflict: false, d2 };
  }
  return { message: 'The follow-up could not be saved.', conflict: false, d2: false };
}

function stateBadge(fu: FollowUpDto) {
  if (fu.state === 'completed') return { label: 'Completed', tone: 'success' as const };
  if (fu.state === 'cancelled') return { label: 'Cancelled', tone: 'neutral' as const };
  return { label: 'Scheduled', tone: 'brand' as const };
}

/* ----------------------------------------------------------------- rows */

export function FollowUpRow({
  f,
  onReschedule,
  onComplete,
  onCancel,
}: {
  f: FollowUpDto;
  onReschedule: (f: FollowUpDto) => void;
  onComplete: (f: FollowUpDto) => void;
  onCancel: (f: FollowUpDto) => void;
}) {
  const fmt = useCallingFormat();
  const s = stateBadge(f);
  const open = f.state === 'scheduled';
  return (
    <li className="py-3 border-t border-border-subtle first:border-t-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
      <div className="md:w-36 shrink-0 text-sm text-text-primary">{fmt.weekdayTime(f.scheduledFor)}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">{f.businessName}</div>
        <p className="text-[13px] leading-[18px] text-text-muted">
          {f.purpose ?? 'No purpose recorded'} · {f.responsibleName}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone={s.tone}>{s.label}</Badge>
          {open && f.overdue && (
            <Badge tone="warning" derived>
              Overdue
            </Badge>
          )}
          {open && f.due && !f.overdue && (
            <Badge tone="neutral" derived>
              Due now
            </Badge>
          )}
          {f.responsibleInactive && (
            <Badge tone="warning" derived>
              Responsible user inactive
            </Badge>
          )}
        </div>
      </div>
      {open && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="touch" leadingIcon={<Icon name="clock" size={16} />} onClick={() => onReschedule(f)}>
            Reschedule
          </Button>
          <Button variant="ghost" size="touch" leadingIcon={<Icon name="check" size={16} />} onClick={() => onComplete(f)}>
            Complete
          </Button>
          <Button variant="ghost" size="touch" onClick={() => onCancel(f)}>
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

export function FollowUpGroups({
  items,
  completedCount,
  callbackBusinesses = [],
  flat = false,
  onScheduleCallback,
  onReschedule,
  onComplete,
  onCancel,
}: {
  items: FollowUpDto[];
  completedCount: number | null;
  /** Businesses flagged "Callback to be scheduled" (D2): no open follow-up, waiting for a time. */
  callbackBusinesses?: { id: string; name: string }[];
  /** Completed / Cancelled / All views: one list, no due-date grouping. */
  flat?: boolean;
  onScheduleCallback?: (businessId: string) => void;
  onReschedule: (f: FollowUpDto) => void;
  onComplete: (f: FollowUpDto) => void;
  onCancel: (f: FollowUpDto) => void;
}) {
  const fmt = useCallingFormat();
  const today = fmt.todayKey();
  const overdue = items.filter((i) => i.overdue);
  const dueToday = items.filter((i) => !i.overdue && fmt.dayKey(i.scheduledFor) <= today);
  const upcoming = items.filter((i) => !i.overdue && fmt.dayKey(i.scheduledFor) > today);
  const groups = [
    { id: 'overdue', title: 'Overdue', sub: 'Scheduled and past due', rows: overdue },
    { id: 'today', title: 'Due today', sub: 'Scheduled for today (derived, company timezone)', rows: dueToday },
    { id: 'upcoming', title: 'Upcoming', sub: 'Scheduled for later', rows: upcoming },
  ];
  return (
    <div className="flex flex-col gap-4">
      {callbackBusinesses.length > 0 && (
        <CardSection title={`Callback to be scheduled · ${callbackBusinesses.length}`} subtitle="Needs another call, no time set yet">
          <ul>
            {callbackBusinesses.map((b) => (
              <li key={b.id} className="py-3 border-t border-border-subtle first:border-t-0 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-primary">{b.name}</span>
                <Button variant="secondary" size="touch" onClick={() => onScheduleCallback?.(b.id)} leadingIcon={<Icon name="calendar" size={16} />}>
                  Schedule
                </Button>
              </li>
            ))}
          </ul>
        </CardSection>
      )}
      {flat && (
        <CardSection title={`Follow-ups · ${items.length}`}>
          <ul>
            {items.map((f) => (
              <FollowUpRow key={f.id} f={f} onReschedule={onReschedule} onComplete={onComplete} onCancel={onCancel} />
            ))}
          </ul>
        </CardSection>
      )}
      {!flat && groups.map((g) =>
        g.rows.length === 0 ? null : (
          <CardSection key={g.id} title={`${g.title} · ${g.rows.length}`} subtitle={g.sub}>
            <ul>
              {g.rows.map((f) => (
                <FollowUpRow key={f.id} f={f} onReschedule={onReschedule} onComplete={onComplete} onCancel={onCancel} />
              ))}
            </ul>
          </CardSection>
        )
      )}
      {!flat && completedCount !== null && (
        <div className="rounded-lg border border-border-subtle bg-surface-default px-4 py-2 text-center text-[13px] text-text-muted">
          Completed follow-ups: {completedCount}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ day agenda */

export function DayAgenda({ items }: { items: FollowUpDto[] }) {
  const fmt = useCallingFormat();
  const today = fmt.todayKey();
  const todays = items.filter((i) => i.state !== 'cancelled' && fmt.dayKey(i.scheduledFor) === today);
  const hours = Array.from(new Set(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', ...todays.map((i) => `${fmt.time(i.scheduledFor).slice(0, 2)}:00`)])).sort();
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">{fmt.dateLabel(new Date())}</h2>
        <Badge tone="brand" hasDot>
          Today
        </Badge>
      </div>
      <ul>
        {hours.map((h) => {
          const events = todays.filter((i) => fmt.time(i.scheduledFor).slice(0, 2) === h.slice(0, 2));
          return (
            <li key={h} className="flex gap-3 px-4 py-2.5 border-t border-border-subtle first:border-t-0 min-h-11">
              <span className="w-12 shrink-0 text-[13px] text-text-muted tabular-nums">{h}</span>
              <div className="flex-1 flex flex-col gap-1">
                {events.map((e) => (
                  <div key={e.id} className="rounded-sm border-l-4 border-border-selected bg-status-brand-bg px-2 py-1 text-[13px] text-text-primary">
                    <span className="text-status-brand-fg text-xs">{fmt.time(e.scheduledFor)}</span>
                    <div>{e.businessName}</div>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------ week grid */

function dayHeading(key: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
}

/** SCR-CC-004 week calendar: Monday to Sunday, company timezone; cancelled follow-ups are not drawn. */
export function WeekGrid({ items, weekStart, onOpen }: { items: FollowUpDto[]; weekStart: string; onOpen: (f: FollowUpDto) => void }) {
  const fmt = useCallingFormat();
  const today = fmt.todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const events = items.filter((i) => i.state !== 'cancelled');
  const hourOf = (iso: string) => Number(fmt.time(iso).slice(0, 2));
  const hs = events.map((e) => hourOf(e.scheduledFor));
  const first = Math.min(9, ...hs);
  const last = Math.max(17, ...hs);
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return (
    <div className="rounded-xl border border-border-default bg-surface-default overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border-subtle">
          <div />
          {days.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-[13px] text-text-secondary border-l border-border-subtle">
              {d === today ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded-full bg-brand-primary px-2 py-0.5 text-xs font-medium text-text-on-primary">{dayHeading(d)}</span>
                  <span className="text-status-brand-fg text-xs">Today</span>
                </span>
              ) : (
                dayHeading(d)
              )}
            </div>
          ))}
        </div>
        {hours.map((h) => (
          <div key={h} className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-t border-border-subtle first:border-t-0 min-h-[56px]">
            <div className="px-2 py-1 text-[13px] text-text-muted tabular-nums">{String(h).padStart(2, '0')}:00</div>
            {days.map((d) => (
              <div key={d} className="border-l border-border-subtle p-1 flex flex-col gap-1">
                {events
                  .filter((e) => fmt.dayKey(e.scheduledFor) === d && hourOf(e.scheduledFor) === h)
                  .map((e) => {
                    const done = e.state === 'completed';
                    const bad = e.state === 'scheduled' && e.overdue;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onOpen(e)}
                        className={cn(
                          'text-left rounded-sm border-l-4 px-2 py-1 text-[12px] leading-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                          done
                            ? 'bg-surface-sunken border-border-strong text-text-secondary'
                            : bad
                              ? 'bg-status-danger-bg border-status-danger-solid text-status-danger-fg'
                              : 'bg-status-brand-bg border-border-selected text-text-primary'
                        )}
                      >
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <Icon name={done ? 'check' : bad ? 'alert-circle' : 'phone'} size={11} />
                          {fmt.time(e.scheduledFor)}
                          {done ? ' · completed' : bad ? ' · overdue' : ''}
                        </span>
                        <div className="truncate">{e.businessName}</div>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- drawer */

/** SCR-CC-006 create / reschedule drawer, wired to POST /api/follow-ups and PATCH /api/follow-ups/:id. */
export function FollowUpDrawer({
  mode,
  target,
  businesses,
  callbackIds = [],
  presetBusinessId,
  onClose,
  onChanged,
}: {
  mode: 'create' | 'reschedule' | null;
  target: FollowUpDto | null;
  businesses: { id: string; name: string }[];
  /** Businesses carrying the "Callback to be scheduled" marker; creating one clears it. */
  callbackIds?: string[];
  presetBusinessId?: string;
  onClose: () => void;
  /** After a save or a conflict, so the lists reload. */
  onChanged: () => void;
}) {
  if (mode === null) return null;
  return <DrawerBody mode={mode} target={target} businesses={businesses} callbackIds={callbackIds} presetBusinessId={presetBusinessId} onClose={onClose} onChanged={onChanged} />;
}

function DrawerBody({
  mode,
  target,
  businesses,
  callbackIds,
  presetBusinessId,
  onClose,
  onChanged,
}: {
  mode: 'create' | 'reschedule';
  target: FollowUpDto | null;
  businesses: { id: string; name: string }[];
  callbackIds: string[];
  presetBusinessId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const fmt = useCallingFormat();
  const toast = useToast();
  const resched = mode === 'reschedule' && target !== null;
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [businessId, setBusinessId] = useState(target?.businessId ?? presetBusinessId ?? '');
  const [responsibleId, setResponsibleId] = useState(target?.responsibleId ?? '');
  const [note, setNote] = useState('');
  const keyRef = useRef<{ key: string; sig: string } | null>(null);
  // Only the Owner may name another agent (server rule); everyone else is the responsible person.
  const agents = useApi<{ items: { id: string; fullName: string; isActive?: boolean }[] }>(isOwner ? '/api/employees?role=call_center&pageSize=100' : null);
  const [when, setWhen] = useState(target ? fmt.toLocal(target.scheduledFor) : '');
  const [purpose, setPurpose] = useState(target?.purpose ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const past = when !== '' && fmt.isPast(when);
  const valid = when !== '' && !past && (resched ? reason.trim().length >= 3 : businessId !== '');

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (resched && target) {
        await updateFollowUp(target.id, {
          version: target.version,
          scheduledFor: fmt.toIso(when),
          reason: reason.trim(),
          ...(isOwner && responsibleId && responsibleId !== target.responsibleId ? { responsibleId } : {}),
        });
        toast.show({ tone: 'success', title: 'Follow-up rescheduled', body: `${target.businessName} · ${fmt.weekdayTime(fmt.toIso(when))}` });
      } else {
        // The API has one free-text field (500 chars): purpose and note travel together.
        const text = [purpose.trim(), note.trim()].filter(Boolean).join(' — ').slice(0, 500);
        const body = {
          businessId,
          scheduledFor: fmt.toIso(when),
          ...(text ? { purpose: text } : {}),
          ...(isOwner && responsibleId ? { responsibleId } : {}),
        };
        const sig = JSON.stringify(body);
        if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { key: newIdempotencyKey(), sig };
        const r = await createFollowUp(body, keyRef.current.key);
        keyRef.current = null;
        toast.show(
          r.rescheduled
            ? { tone: 'info', title: 'Existing follow-up rescheduled', body: 'A business has one open follow-up, so the open one moved to the new time.' }
            : { tone: 'success', title: 'Follow-up scheduled', body: `${r.followUp.businessName} · ${fmt.weekdayTime(r.followUp.scheduledFor)}` }
        );
      }
      onChanged();
      onClose();
    } catch (e) {
      const c = commandError(e);
      setError(c);
      if (c.conflict) onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={resched ? 'Reschedule follow-up' : 'Schedule follow-up'}
      subtitle={resched && target ? `${target.businessName} · was ${fmt.weekdayTime(target.scheduledFor)}` : 'Pick the business and the time of the next call'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} isLoading={busy} onClick={submit}>
            {resched ? 'Save new time' : 'Schedule follow-up'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone={error.conflict ? 'warning' : 'danger'} title={error.conflict ? 'Save conflict' : 'Not saved'} body={error.message} />}
        {!resched && (
          <Select
            label="Business"
            required
            placeholder="Choose a business"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            options={businesses.map((b) => ({ value: b.id, label: b.name }))}
            helperText="A business has one open follow-up; scheduling another moves the open one."
          />
        )}
        <DateInput
          kind="datetime"
          label="Date and time (company timezone)"
          required
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          error={past ? 'Choose a time in the future. Past times are rejected.' : undefined}
        />
        {!resched && callbackIds.includes(businessId) && (
          <Alert tone="info" title="Clears “Callback to be scheduled”" body="Saving a time removes the callback marker from this business." />
        )}
        {isOwner ? (
          <Select
            label="Responsible"
            placeholder="Choose the responsible agent"
            value={responsibleId}
            onChange={(e) => setResponsibleId(e.target.value)}
            options={(agents.data?.items ?? []).filter((a) => a.isActive !== false).map((a) => ({ value: a.id, label: a.fullName }))}
            helperText="Defaults to you if left empty."
          />
        ) : (
          <Input label="Responsible" value={`${user?.fullName ?? 'You'} (you)`} readOnly helperText="Follow-ups are always yours; the Owner can reassign." />
        )}
        {!resched && <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What will you discuss?" />}
        {!resched && <Textarea label="Note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} helperText="Kept with the follow-up purpose." />}
        {resched && <Textarea label="Reason for rescheduling" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} helperText="At least 3 characters. Kept in the business history." />}
      </div>
    </Drawer>
  );
}

/* -------------------------------------------------- complete / cancel */

/**
 * Complete or cancel a follow-up. D2 guard: when it is the last open follow-up of a Needs-another-call business the server
 * answers 422 D2_REPLACEMENT_REQUIRED and the dialog then asks for a replacement time or the "callback to be scheduled" marker.
 */
export function FollowUpCommandDialog({
  command,
  target,
  onClose,
  onChanged,
}: {
  command: 'complete' | 'cancel';
  target: FollowUpDto | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!target) return null;
  return <CommandBody key={target.id + command} command={command} target={target} onClose={onClose} onChanged={onChanged} />;
}

function CommandBody({ command, target, onClose, onChanged }: { command: 'complete' | 'cancel'; target: FollowUpDto; onClose: () => void; onChanged: () => void }) {
  const fmt = useCallingFormat();
  const toast = useToast();
  const [text, setText] = useState('');
  const [needReplacement, setNeedReplacement] = useState(false);
  const [repMode, setRepMode] = useState<'time' | 'marker'>('time');
  const [repWhen, setRepWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const cancel = command === 'cancel';
  const repPast = repWhen !== '' && fmt.isPast(repWhen);
  const textOk = cancel ? text.trim().length >= 3 : text.trim().length >= 1;
  const repOk = !needReplacement || repMode === 'marker' || (repWhen !== '' && !repPast);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const replacement: FollowUpReplacement | undefined = needReplacement
      ? repMode === 'marker'
        ? 'callback_to_be_scheduled'
        : { scheduledFor: fmt.toIso(repWhen) }
      : undefined;
    try {
      if (cancel) await cancelFollowUp(target.id, { version: target.version, reason: text.trim(), ...(replacement ? { replacement } : {}) });
      else await completeFollowUp(target.id, { version: target.version, completionNote: text.trim(), ...(replacement ? { replacement } : {}) });
      toast.show({ tone: 'success', title: cancel ? 'Follow-up cancelled' : 'Follow-up completed', body: target.businessName });
      onChanged();
      onClose();
    } catch (e) {
      const c = commandError(e);
      if (c.d2) setNeedReplacement(true);
      else setError(c);
      if (c.conflict) onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={cancel ? 'Cancel this follow-up?' : 'Complete this follow-up?'}
      description={`${target.businessName} · ${fmt.weekdayTime(target.scheduledFor)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancel ? 'Keep follow-up' : 'Not yet'}
          </Button>
          <Button variant={cancel ? 'destructive' : 'primary'} disabled={!textOk || !repOk || busy} isLoading={busy} onClick={submit}>
            {cancel ? 'Cancel follow-up' : 'Mark completed'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {needReplacement && (
          <Alert
            tone="warning"
            title="This business still needs another call"
            body="A Needs-another-call business never goes without a follow-up. Set a new time, or mark the callback as to be scheduled."
          />
        )}
        <Textarea
          label={cancel ? 'Reason' : 'Completion note'}
          required
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          helperText={cancel ? 'At least 3 characters. The reason is kept in the business history.' : 'What happened at this follow-up.'}
        />
        {needReplacement && (
          <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 flex flex-col gap-3">
            <Tabs
              style="segmented"
              activeId={repMode}
              onChange={(id) => setRepMode(id as 'time' | 'marker')}
              items={[
                { id: 'time', label: 'New follow-up' },
                { id: 'marker', label: 'Callback to be scheduled' },
              ]}
            />
            {repMode === 'time' ? (
              <DateInput
                kind="datetime"
                label="Date and time (company timezone)"
                required
                value={repWhen}
                onChange={(e) => setRepWhen(e.target.value)}
                error={repPast ? 'Choose a time in the future.' : undefined}
              />
            ) : (
              <p className="text-[13px] text-text-muted">The business stays in “Callback to be scheduled” until you set a time.</p>
            )}
          </div>
        )}
        {error && <Alert tone={error.conflict ? 'warning' : 'danger'} title={error.conflict ? 'Save conflict' : 'Not saved'} body={error.message} />}
      </div>
    </Dialog>
  );
}
