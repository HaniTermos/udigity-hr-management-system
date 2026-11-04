'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { DateInput, Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { useApi, usePage } from '@/lib/hooks/useApi';
import { buildQuery } from '@/lib/api/client';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { dealsPaths, type DealListItem } from '@/lib/api/deals';
import { meetingsPaths, scheduleMeeting, type Meeting, type ScheduleMeetingInput } from '@/lib/api/meetings';
import { useCallingFormat } from '@/components/calling/format';
import { ActionError, fieldMessage, toLocalInput } from './shared';

export interface ScheduleDeal {
  id: string;
  label: string;
  assignedDeveloperId: string | null;
}

/** Next whole hour, as a datetime-local value. */
function nextHour(plusHours = 1): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + plusHours);
  return toLocalInput(d.toISOString());
}

function roleLabel(role: string): string {
  const t = role.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function ScheduleMeetingDrawer({
  deal,
  onClose,
  onScheduled,
}: {
  /** Fixed deal (from the deal detail). Without it the drawer lets the user choose a business / deal. */
  deal?: ScheduleDeal;
  onClose: () => void;
  onScheduled: (m: Meeting) => void;
}) {
  const toast = useToast();
  const fmt = useCallingFormat();
  const { user } = useAuth();

  const [selectedTarget, setSelectedTarget] = useState(deal?.id ? `deal:${deal.id}` : '');
  const [hostChoice, setHostChoice] = useState('');
  // Host defaults to the signed-in user until another staff member is chosen.
  const hostId = hostChoice || user?.id || '';
  const setHostId = setHostChoice;
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(nextHour(1));
  const [end, setEnd] = useState(nextHour(2));
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});

  // 1. A meeting needs an open deal (the server rejects a business without one), so the picker lists exactly
  //    the open deals the user can see, by business name. No free search.
  const choices = usePage<DealListItem>(deal ? null : dealsPaths.list, { tab: 'accepted', pageSize: 100 });
  const openDeals = useMemo(
    () => choices.items.filter((d) => d.stage !== 'closed' && d.stage !== 'not_proceeding'),
    [choices.items]
  );

  // 2. Staff picker: the purpose-built attendee list (`meeting.create`), which every role that can schedule may call.
  //    The server narrows it for non-owners; the form still works if the list is unavailable (host = you).
  //    It accepts `fullName` (current) or `name` (minimal list) so either backend shape works.
  const employeesRes = useApi<{ items: { id: string; fullName?: string; name?: string; role: string }[] }>(
    `${meetingsPaths.attendeeOptions}${buildQuery({ dealId: deal?.id ?? (selectedTarget.startsWith('deal:') ? selectedTarget.slice(5) : undefined) })}`,
    { shouldRetryOnError: false }
  );
  const activeEmployees = useMemo(
    () => (employeesRes.data?.items ?? []).map((e) => ({ id: e.id, fullName: e.fullName ?? e.name ?? '', role: e.role })),
    [employeesRes.data?.items]
  );
  const staffAvailable = Boolean(employeesRes.data) && !employeesRes.error;

  // One option per open deal, sorted by business name. The deal code is added only when a business has
  // more than one open deal, so every option names exactly one business and deal.
  const targetOptions = useMemo(() => {
    if (deal) return [{ value: `deal:${deal.id}`, label: deal.label }];
    const nameOf = (d: DealListItem) => d.businessName ?? d.code;
    const perName = new Map<string, number>();
    for (const d of openDeals) perName.set(nameOf(d), (perName.get(nameOf(d)) ?? 0) + 1);
    return [...openDeals]
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      .map((d) => ({ value: `deal:${d.id}`, label: (perName.get(nameOf(d)) ?? 0) > 1 ? `${nameOf(d)} · ${d.code}` : nameOf(d) }));
  }, [deal, openDeals]);

  const { status, fieldErrors, error, route, save, retry } = useVersionedSave<ScheduleMeetingInput, Meeting>(
    (input, ctx) => scheduleMeeting(input, ctx.idempotencyKey),
    {
      onSaved: (m) => {
        toast.show({ tone: 'success', title: 'Meeting scheduled successfully' });
        onScheduled(m);
        onClose();
      },
    }
  );
  const busy = status === 'saving';

  function submit() {
    const next: Record<string, string> = {};
    if (!selectedTarget) next.target = 'Choose a business.';
    if (!hostId) next.hostId = 'Select the employee responsible for this meeting.';
    if (!start) next.startsAt = 'Choose a start time.';
    else if (new Date(fmt.toIso(start)).getTime() < Date.now()) next.startsAt = 'The start time cannot be in the past.';
    if (end && start && new Date(fmt.toIso(end)) <= new Date(fmt.toIso(start))) next.endsAt = 'End must be after start.';
    if (!user) next.target = 'Your session is not ready. Reload and try again.';
    setLocal(next);
    if (Object.keys(next).length > 0 || !user) return;

    const targetDealId = deal ? deal.id : selectedTarget.replace('deal:', '');

    // Attendees: Current user scheduling + selected host employee
    const attendeeIds = Array.from(new Set([user.id, hostId]));

    void save(
      {
        dealId: targetDealId,
        title: title.trim() || undefined,
        startsAt: fmt.toIso(start),
        endsAt: end ? fmt.toIso(end) : undefined,
        location: location.trim() || undefined,
        agenda: agenda.trim() || undefined,
        attendeeIds,
      },
      1
    );
  }

  const err = (key: string, ...alt: string[]) => local[key] ?? fieldMessage(fieldErrors, key, ...alt);

  return (
    <Drawer
      isOpen
      onClose={busy ? () => undefined : onClose}
      title="Schedule meeting"
      subtitle={deal?.label ?? 'Schedule a meeting with a business that has an open deal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={busy} disabled={busy}>
            Schedule meeting
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">

        {!deal && (
          <Select
            label="Business"
            required
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            placeholder={choices.isLoading ? 'Loading businesses…' : targetOptions.length === 0 ? 'No business has an open deal' : 'Choose a business'}
            options={targetOptions}
            error={err('target', 'dealId', 'businessId')}
            helperText="Businesses with an open deal. A business gets a deal when a call is logged as Accepted."
          />
        )}

        {staffAvailable ? (
          <>
            <Select
              label="Meeting host"
              required
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              placeholder="Choose staff member"
              options={[
                ...(user && !activeEmployees.some((e) => e.id === user.id) ? [{ value: user.id, label: `${user.fullName} (you)` }] : []),
                ...activeEmployees.map((e) => ({ value: e.id, label: `${e.fullName} (${roleLabel(e.role)})` })),
              ]}
              error={err('hostId')}
              helperText="The meeting will be added to this employee’s calendar and meetings page."
            />
          </>
        ) : (
          <Input
            label="Host"
            value={user ? `${user.fullName} (you)` : ''}
            readOnly
            helperText={employeesRes.isLoading ? 'Loading staff…' : 'You host this meeting. The staff list is not available.'}
            error={err('hostId')}
          />
        )}

        <Input
          label="Title (optional)"
          placeholder="e.g. Discovery Call / Project Demo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          error={err('title')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateInput kind="datetime" label="Start" required value={start} onChange={(e) => setStart(e.target.value)} error={err('startsAt')} />
          <DateInput kind="datetime" label="End (optional)" value={end} onChange={(e) => setEnd(e.target.value)} error={err('endsAt')} />
        </div>

        <Input
          label="Location (optional)"
          placeholder="e.g. Google Meet, Zoom, or Office"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={300}
          error={err('location')}
        />

        <Textarea
          label="Agenda (optional)"
          placeholder="Key topics to discuss…"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          maxLength={4000}
          error={err('agenda')}
        />

        <ActionError route={route} error={error} onRetry={() => void retry()} />
      </div>
    </Drawer>
  );
}
