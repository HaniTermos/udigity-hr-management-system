'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { DateInput, Select, Textarea } from '@/components/ui/Input';
import { ApiError } from '@/lib/api/client';
import { cancelDayOff, createDayOff, daysOffKey, listDaysOff, type DayOffDto } from '@/lib/api/attendance';

const REASON_MAX = 500;

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.isVersionConflict) return 'This day off changed meanwhile. Close the panel and try again.';
    const reason = (err.details as { reason?: string } | undefined)?.reason;
    if (reason === 'OVERLAP') return 'These dates overlap another approved day off for this employee.';
    const first = Object.values(err.fieldErrors)[0];
    if (first?.[0]) return first[0];
  }
  return fallback;
}

const range = (d: DayOffDto) => (d.startDate === d.endDate ? d.startDate : `${d.startDate} – ${d.endDate}`);

/**
 * D1 approved employee days off (Owner): current and upcoming days off from `fromDate`, add and cancel.
 * A day off suppresses the missing check-in alert and shows as non-working for that employee.
 */
export function AttendanceDaysOff({
  fromDate,
  employees,
  onChanged,
}: {
  fromDate: string;
  employees: { value: string; label: string }[];
  onChanged: () => void;
}) {
  const query = { from: fromDate, pageSize: 50 };
  const { data, error, mutate } = useSWR(daysOffKey(query), () => listDaysOff(query), { revalidateOnFocus: false });
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<DayOffDto | null>(null);
  const changed = () => {
    void mutate();
    onChanged();
  };

  return (
    <Card className="p-5 space-y-4" aria-labelledby="days-off-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="days-off-title" className="text-base font-semibold text-text-primary">
          Approved days off
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          Add day off
        </Button>
      </div>
      {error ? (
        <p className="text-[13px] text-text-secondary">Days off could not be loaded.</p>
      ) : !data ? (
        <p className="text-[13px] text-text-muted">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No current or upcoming days off.</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-text-primary truncate">{d.employeeName}</div>
                <div className="text-xs text-text-secondary tabular-nums">{range(d)}</div>
                <div className="text-xs text-text-muted break-words">{d.reason}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setCancelling(d)}>
                Cancel
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddDayOffDrawer employees={employees} defaultDate={fromDate} onClose={() => setAdding(false)} onSaved={changed} />}
      {cancelling && <CancelDayOffDrawer dayOff={cancelling} onClose={() => setCancelling(null)} onSaved={changed} />}
    </Card>
  );
}

function AddDayOffDrawer({
  employees,
  defaultDate,
  onClose,
  onSaved,
}: {
  employees: { value: string; label: string }[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const problem = !employeeId
    ? 'Choose the employee.'
    : !startDate
      ? 'Choose the first day.'
      : endDate && endDate < startDate
        ? 'The last day is before the first day.'
        : !reason.trim()
          ? 'Add a reason.'
          : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      await createDayOff({ employeeId, startDate, endDate: endDate || undefined, reason: reason.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setAlert(errorText(err, 'The day off was not saved. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer isOpen onClose={onClose} title="Add approved day off" subtitle="No missing check-in alert for these dates">
      <form onSubmit={submit} noValidate className="space-y-4">
        {alert && <Alert tone="danger" title="Not saved" body={alert} />}
        <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Choose an employee" options={employees} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateInput label="First day" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <DateInput label="Last day" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          counter={`${reason.length} / ${REASON_MAX}`}
          onChange={(e) => setReason(e.target.value)}
        />
        {problem && <p className="text-[13px] text-text-muted">{problem}</p>}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy} disabled={Boolean(problem)}>
            Save day off
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function CancelDayOffDrawer({ dayOff, onClose, onSaved }: { dayOff: DayOffDto; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      await cancelDayOff(dayOff, reason.trim());
      onSaved();
      onClose();
    } catch (err) {
      setAlert(errorText(err, 'The day off was not cancelled. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer isOpen onClose={onClose} title="Cancel day off" subtitle={`${dayOff.employeeName} · ${range(dayOff)}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {alert && <Alert tone="danger" title="Not cancelled" body={alert} />}
        <p className="text-sm text-text-secondary">The record is kept and marked cancelled. Missing check-in alerts apply again for these dates.</p>
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          counter={`${reason.length} / ${REASON_MAX}`}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Keep day off
          </Button>
          <Button type="submit" variant="destructive" isLoading={busy} disabled={!reason.trim()}>
            Cancel day off
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
