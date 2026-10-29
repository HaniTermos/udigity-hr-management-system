'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox, Select } from '@/components/ui/Input';
import { ApiError } from '@/lib/api/client';
import { employeeScheduleKey, getEmployeeSchedule, putEmployeeSchedule, type EmployeeScheduleDto } from '@/lib/api/attendance';

const DAYS = [
  { id: 'MON', label: 'Mon' },
  { id: 'TUE', label: 'Tue' },
  { id: 'WED', label: 'Wed' },
  { id: 'THU', label: 'Thu' },
  { id: 'FRI', label: 'Fri' },
  { id: 'SAT', label: 'Sat' },
  { id: 'SUN', label: 'Sun' },
];

/** Half-hour start times 06:00–12:00. The shift always lasts 9 h. */
const STARTS = Array.from({ length: 13 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  const v = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { value: v, label: v };
});

/**
 * Owner decision 2026-10-29: an employee's own start time and working days (the 9 h duration, grace,
 * holidays and timezone stay company-wide). Saving applies from today; earlier sessions keep their schedule.
 * Rendered inside the employee form, so it uses buttons only (no nested form).
 */
export function AttendanceEmployeeSchedule({ employeeId }: { employeeId: string }) {
  const { data, error, mutate } = useSWR(employeeScheduleKey(employeeId), () => getEmployeeSchedule(employeeId), { revalidateOnFocus: false });
  if (error) return <p className="text-[13px] text-text-secondary">The work schedule could not be loaded.</p>;
  if (!data) return <p className="text-[13px] text-text-muted">Loading the work schedule…</p>;
  return <ScheduleEditor key={data.history[0]?.id ?? 'none'} data={data} employeeId={employeeId} onSaved={() => void mutate()} />;
}

function ScheduleEditor({ data, employeeId, onSaved }: { data: EmployeeScheduleDto; employeeId: string; onSaved: () => void }) {
  const [useDefault, setUseDefault] = useState(data.override === null);
  const [start, setStart] = useState(data.effective.shiftStart || data.company.shiftStart);
  const [days, setDays] = useState<string[]>(data.effective.workingDays);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const toggle = (d: string) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const save = async () => {
    if (busy || (!useDefault && days.length === 0)) return;
    setBusy(true);
    setMessage(null);
    try {
      await putEmployeeSchedule(
        employeeId,
        useDefault
          ? { useCompanyDefault: true }
          : {
              shiftStart: start === data.company.shiftStart ? null : start,
              workingDays: DAYS.map((d) => d.id).filter((d) => days.includes(d)),
            }
      );
      setMessage({ tone: 'success', text: 'Schedule saved. It applies from today.' });
      onSaved();
    } catch (err) {
      setMessage({ tone: 'danger', text: err instanceof ApiError ? err.message : 'The schedule was not saved. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const end = (() => {
    const [h, m] = start.split(':').map(Number);
    const t = (h * 60 + m + 540) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  })();

  return (
    <section className="space-y-3 pt-4 border-t border-border-subtle" aria-labelledby="emp-schedule">
      <div>
        <h3 id="emp-schedule" className="ds-overline text-text-secondary">
          Schedule
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Company default: {data.company.shiftStart}–{data.company.shiftEnd}, {data.company.workingDays.join(', ') || 'no working days set'}.
        </p>
      </div>
      {message && <Alert tone={message.tone} title={message.tone === 'success' ? 'Saved' : 'Not saved'} body={message.text} />}
      <Checkbox label="Use company default" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} />
      {!useDefault && (
        <div className="space-y-3">
          <Select label="Start time" value={start} onChange={(e) => setStart(e.target.value)} options={STARTS} helperText={`Shift ends at ${end} (9 h).`} />
          <fieldset>
            <legend className="text-xs font-semibold text-text-primary mb-2">Working days</legend>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((d) => (
                <Checkbox key={d.id} label={d.label} checked={days.includes(d.id)} onChange={() => toggle(d.id)} />
              ))}
            </div>
            {days.length === 0 && <p className="text-[13px] text-text-muted mt-1">Choose at least one working day.</p>}
          </fieldset>
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={() => void save()} isLoading={busy} disabled={busy || (!useDefault && days.length === 0)}>
        Save schedule
      </Button>
    </section>
  );
}
