'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { DateInput, Input, Select, Textarea } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { useApi, usePage } from '@/lib/hooks/useApi';
import { buildQuery } from '@/lib/api/client';
import { useVersionedSave } from '@/lib/hooks/useVersionedSave';
import { dealsPaths, type DealListItem } from '@/lib/api/deals';
import { scheduleMeeting, type Meeting, type ScheduleMeetingInput } from '@/lib/api/meetings';
import { type EmployeeRow } from '@/lib/api/employees';
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

  // 1. Search the directory (server side, 20 per search) instead of loading the first 100.
  const [bizSearch, setBizSearch] = useState('');
  const [bizQuery, setBizQuery] = useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setBizQuery(bizSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [bizSearch]);
  const businessesRes = useApi<{ items: { id: string; name: string }[]; total?: number }>(
    deal ? null : `/api/businesses${buildQuery({ pageSize: 20, q: bizQuery || undefined, sort: 'name' })}`
  );
  const allBusinesses = useMemo(() => businessesRes.data?.items ?? [], [businessesRes.data?.items]);
  const businessTotal = businessesRes.data?.total ?? allBusinesses.length;

  // 2. Load open deals for pre-closure matching
  const choices = usePage<DealListItem>(deal ? null : dealsPaths.list, { tab: 'accepted', pageSize: 100 });
  const openDeals = choices.items.filter((d) => d.stage !== 'closed' && d.stage !== 'not_proceeding');

  // 3. Staff picker. The employee list is Owner-only today, so for other roles the picker is optional: the host
  //    defaults to the signed-in user and the form never depends on the list.
  const [staffSearch, setStaffSearch] = useState('');
  const employeesRes = useApi<{ items: EmployeeRow[] }>(`/api/employees${buildQuery({ pageSize: 50, status: 'active', q: staffSearch.trim() || undefined })}`, {
    shouldRetryOnError: false,
  });
  const activeEmployees = useMemo(
    () => (employeesRes.data?.items ?? []).filter((e) => e.isActive),
    [employeesRes.data?.items]
  );
  const staffAvailable = Boolean(employeesRes.data) && !employeesRes.error;

  // Combined business / deal options
  const targetOptions = useMemo(() => {
    if (deal) {
      return [{ value: `deal:${deal.id}`, label: deal.label }];
    }

    const seenBusinessIds = new Set<string>();
    const options: { value: string; label: string }[] = [];

    // Open deals first
    for (const d of openDeals) {
      if (d.businessId) seenBusinessIds.add(d.businessId);
      options.push({
        value: `deal:${d.id}`,
        label: `${d.businessName ?? d.code} (Deal: ${d.code})`,
      });
    }

    // Then businesses without open deals
    for (const b of allBusinesses) {
      if (!seenBusinessIds.has(b.id)) {
        options.push({
          value: `biz:${b.id}`,
          label: `${b.name} (Direct / New Meeting)`,
        });
      }
    }

    return options;
  }, [deal, openDeals, allBusinesses]);

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
    if (!selectedTarget) next.target = 'Choose a business or deal.';
    if (!hostId) next.hostId = 'Select the employee responsible for this meeting.';
    if (!start) next.startsAt = 'Choose a start time.';
    else if (new Date(start).getTime() < Date.now()) next.startsAt = 'The start time cannot be in the past.';
    if (end && start && new Date(end) <= new Date(start)) next.endsAt = 'End must be after start.';
    if (!user) next.target = 'Your session is not ready. Reload and try again.';
    setLocal(next);
    if (Object.keys(next).length > 0 || !user) return;

    let targetDealId: string | undefined;
    let targetBusinessId: string | undefined;

    if (deal) {
      targetDealId = deal.id;
    } else if (selectedTarget.startsWith('deal:')) {
      targetDealId = selectedTarget.replace('deal:', '');
      const matchedDeal = openDeals.find((d) => d.id === targetDealId);
      if (matchedDeal?.businessId) targetBusinessId = matchedDeal.businessId;
    } else if (selectedTarget.startsWith('biz:')) {
      targetBusinessId = selectedTarget.replace('biz:', '');
    }

    // Attendees: Current user scheduling + selected host employee
    const attendeeIds = Array.from(new Set([user.id, hostId]));

    void save(
      {
        dealId: targetDealId,
        businessId: targetBusinessId,
        title: title.trim() || undefined,
        startsAt: new Date(start).toISOString(),
        endsAt: end ? new Date(end).toISOString() : undefined,
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
      subtitle={deal?.label ?? 'Schedule a meeting for a business or deal'}
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
        <PolicyPendingChip dec="DEC-005" demo />

        {!deal && (
          <Select
            label="Business / Client"
            required
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            placeholder={
              businessesRes.isLoading || choices.isLoading
                ? 'Loading directory businesses…'
                : targetOptions.length === 0
                ? 'No businesses found'
                : 'Choose a business or client'
            }
            options={targetOptions}
            error={err('target', 'dealId', 'businessId')}
            helperText={
              businessTotal > allBusinesses.length
                ? `Showing ${allBusinesses.length} of ${businessTotal} matches. Type in the search box to narrow the list.`
                : 'Select any business from the directory to book a meeting directly.'
            }
          />
        )}
        {!deal && (
          <Input
            label="Search businesses"
            placeholder="Search by name, phone or handle…"
            value={bizSearch}
            onChange={(e) => setBizSearch(e.target.value)}
          />
        )}

        {staffAvailable ? (
          <>
            <Input
              label="Search staff"
              placeholder="Search staff by name…"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
            <Select
              label="Assigned Host / Person Doing the Meeting"
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
            helperText={employeesRes.isLoading ? 'Loading staff…' : 'You host this meeting. Your role cannot browse the staff list.'}
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
