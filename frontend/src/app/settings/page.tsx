'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EnrollmentTokenPanel } from '@/components/owner/EnrollmentTokenPanel';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Checkbox, Input, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/State';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import {
  adminPaths,
  attendanceSettingsPath,
  patchSettings,
  putAttendanceSettings,
  type AttendanceSettingsDto,
  type SettingsDto,
  type WeekdayCode } from '@/lib/api/admin';
import { identityPaths, type TwoFactorStatusDto } from '@/lib/api/identity';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks/useApi';

type TabId = 'schedule' | 'company' | 'security' | 'access';

const TABS = [
  { id: 'schedule', label: 'Working Hours & Shifts' },
  { id: 'company', label: 'Company Information' },
  { id: 'access', label: 'Roles & Access Control' },
  { id: 'security', label: 'Security & 2FA' },
];

/** Ids are the backend enum values (`WEEKDAYS` in attendance/time.ts). Displayed Monday first. */
const WEEKDAY_OPTIONS: { id: WeekdayCode; label: string }[] = [
  { id: 'MON', label: 'Monday' },
  { id: 'TUE', label: 'Tuesday' },
  { id: 'WED', label: 'Wednesday' },
  { id: 'THU', label: 'Thursday' },
  { id: 'FRI', label: 'Friday' },
  { id: 'SAT', label: 'Saturday' },
  { id: 'SUN', label: 'Sunday' },
];

const COMMON_TIMEZONES = [
  { value: 'Asia/Beirut', label: 'Asia/Beirut (UTC+2 / UTC+3)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
  { value: 'Europe/London', label: 'Europe/London (GMT / BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET / CEST)' },
  { value: 'America/New_York', label: 'America/New York (EST / EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST / PDT)' },
];

/** D1: shift end = start + 9 h (display only; the server derives it the same way). */
function shiftEndOf(start: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(start);
  if (!m) return '';
  const t = (Number(m[1]) * 60 + Number(m[2]) + 9 * 60) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function saveErrorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const first = Object.entries(err.fieldErrors)[0];
    if (first) return `${first[0]}: ${first[1][0]}`;
    return err.message;
  }
  return fallback;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('schedule');
  const att = useApi<AttendanceSettingsDto>(attendanceSettingsPath, { revalidateOnFocus: false, refreshInterval: 0 });
  const company = useApi<SettingsDto>(adminPaths.settings, { revalidateOnFocus: false, refreshInterval: 0 });

  // A 403 on either read means this account may not open Settings at all.
  const denied = [att.route, company.route].find((r) => r?.kind === 'permission-denied' || r?.kind === 'session-ended' || r?.kind === 'owner-2fa-required');

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <div className="pb-4 border-b border-border-subtle">
          <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text-primary">System Settings</h1>
          <p className="text-xs text-text-secondary mt-1">
            Organization preferences, working hours, attendance policies and security controls.
          </p>
        </div>

        {denied ? (
          <ApiErrorView route={denied} area="Settings" />
        ) : (
          <>
            <Tabs items={TABS} activeId={tab} onChange={(id) => setTab(id as TabId)} />
            {tab === 'schedule' && (
              <section aria-label="Working hours">
                {att.error && !att.data ? (
                  <ApiErrorView error={att.error} route={att.route} onRetry={() => void att.retry()} size="inline" what="the working hours" area="Settings" />
                ) : !att.data ? (
                  <FormSkeleton />
                ) : (
                  <AttendanceForm
                    // A new server version remounts the form so it starts from what is saved.
                    key={att.data.current.versionNo ?? 0}
                    data={att.data}
                    onSaved={async () => {
                      await Promise.all([att.mutate(), company.mutate()]);
                    }}
                    onReload={async () => {
                      await att.mutate();
                    }}
                  />
                )}
              </section>
            )}
            {tab === 'company' && (
              <section aria-label="Company information">
                {company.error && !company.data ? (
                  <ApiErrorView error={company.error} route={company.route} onRetry={() => void company.retry()} size="inline" what="the company profile" area="Settings" />
                ) : !company.data ? (
                  <FormSkeleton />
                ) : (
                  <CompanyForm key={company.data.version} data={company.data} onSaved={async () => void (await company.mutate())} onReload={async () => void (await company.mutate())} />
                )}
              </section>
            )}
            {tab === 'access' && <AccessTab />}
            {tab === 'security' && <SecurityTab />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" className="space-y-4">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ attendance */

function AttendanceForm({
  data,
  onSaved,
  onReload,
}: {
  data: AttendanceSettingsDto;
  onSaved: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const c = data.current;
  const [workingDays, setWorkingDays] = useState<WeekdayCode[]>(c.workingDays ?? []);
  const [shiftStart, setShiftStart] = useState(c.shiftStart ?? '');
  const [graceMinutes, setGraceMinutes] = useState(String(c.graceMinutes ?? 0));
  const [timezone, setTimezone] = useState(c.timezone ?? '');
  const [officeIps, setOfficeIps] = useState((c.officeIps ?? []).join(', '));
  const [officeHostnames, setOfficeHostnames] = useState((c.officeHostnames ?? []).join(', '));
  // D1: the Owner states the holiday list (possibly empty) and confirms it; nothing is assumed.
  const [holidays, setHolidays] = useState((c.holidays ?? []).join(', '));
  const [holidaysConfirmed, setHolidaysConfirmed] = useState(Boolean(c.holidaysConfirmed));
  // Break limits per session (Owner decision 2026-10-29: 60 minutes, at most 3 breaks by default).
  const [breakMinutes, setBreakMinutes] = useState(String(data.breaks?.allowanceMinutes ?? 60));
  const [maxBreaks, setMaxBreaks] = useState(String(data.breaks?.maxPerSession ?? 3));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const timezones =
    timezone && !COMMON_TIMEZONES.some((t) => t.value === timezone) ? [{ value: timezone, label: timezone }, ...COMMON_TIMEZONES] : COMMON_TIMEZONES;
  const toggleDay = (d: WeekdayCode) => setWorkingDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const grace = Number(graceMinutes);
  const shiftEnd = shiftEndOf(shiftStart);
  const problems: string[] = [];
  if (workingDays.length === 0) problems.push('Choose at least one working day.');
  if (!shiftStart) problems.push('Set the shift start.');
  if (!Number.isInteger(grace) || grace < 0 || grace > 240) problems.push('Grace period must be a whole number from 0 to 240.');
  if (!timezone) problems.push('Choose the company timezone.');
  const ips = officeIps.split(',').map((s) => s.trim()).filter(Boolean);
  const hosts = officeHostnames.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (ips.length === 0 && hosts.length === 0) problems.push('Add an office public IP / CIDR range or the dynamic DNS name of the office router.');
  if (hosts.length > 5) problems.push('At most 5 office hostnames.');
  const holidayList = holidays.split(',').map((s) => s.trim()).filter(Boolean);
  if (holidayList.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) problems.push('Write holidays as YYYY-MM-DD, separated by commas.');
  if (!holidaysConfirmed) problems.push('Confirm the holiday calendar (it may be empty).');
  const breakMin = Number(breakMinutes);
  const breakMax = Number(maxBreaks);
  if (!Number.isInteger(breakMin) || breakMin < 0 || breakMin > 480) problems.push('Break time must be a whole number of minutes from 0 to 480.');
  if (!Number.isInteger(breakMax) || breakMax < 1 || breakMax > 20) problems.push('Breaks per session must be a whole number from 1 to 20.');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problems.length > 0 || saving) return;
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      // D1: every company value is sent explicitly (the first save may not rely on defaults). Flag hours are kept.
      await putAttendanceSettings({
        version: c.versionNo ?? 0,
        timezone,
        workingDays,
        shiftStart,
        graceMinutes: grace,
        verificationMode: 'ip',
        officeIps: ips,
        officeHostnames: hosts,
        holidays: holidayList,
        holidaysConfirmed,
        breakAllowanceMinutes: breakMin,
        maxBreaksPerSession: breakMax,
        reason: 'Updated in Settings',
      });
      await onSaved();
      toast.show({ tone: 'success', title: 'Working hours saved', body: 'The new schedule applies to future sessions.' });
    } catch (err) {
      if (err instanceof ApiError && err.isVersionConflict) setConflict(true);
      else setError(saveErrorText(err, 'Could not save the working hours. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {!data.configured && (
        <Alert
          tone="info"
          title="Attendance not configured"
          body="Check-in, lateness and attendance alerts stay off until you save the working days, start time, timezone, office IPs and the confirmed holiday calendar. The values shown are suggestions only."
        />
      )}
      {conflict && (
        <Alert tone="warning" title="Someone else changed these settings" body="Your edits were not saved. Load the latest settings, then make your change again.">
          <div className="mt-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void onReload()}>
              Load latest
            </Button>
          </div>
        </Alert>
      )}
      {error && <Alert tone="danger" title="Could not save" body={error} role="alert" />}

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text-primary flex flex-wrap items-center gap-2">
            Working days & shift hours
          </h2>
          <p className="text-xs text-text-secondary mt-1">Scheduled working days, shift times and the grace allowance for punctuality.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-text-primary mb-2">Official working days</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {WEEKDAY_OPTIONS.map((w) => {
              const on = workingDays.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(w.id)}
                  className={`p-2.5 min-h-[44px] rounded-lg border text-xs font-medium text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    on
                      ? 'bg-brand-primary text-text-on-primary border-brand-primary'
                      : 'bg-surface-default border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Shift start (24h)" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} required helperText="Check-ins after this time plus grace are marked late." />
          <Input label="Shift end (24h)" type="time" value={shiftEnd} readOnly disabled helperText="Always the start plus the 9-hour workday." />
          <Input
            label="Late grace period (minutes)"
            type="number"
            min={0}
            max={240}
            value={graceMinutes}
            onChange={(e) => setGraceMinutes(e.target.value)}
            required
            helperText="Allowance before a check-in counts as late."
          />
        </div>

        <Select
          label="Company timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          options={timezones}
          placeholder="Choose a timezone"
          required
          helperText="Attendance days, sessions and dashboard figures use this timezone."
        />
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary flex flex-wrap items-center gap-2">
            Office verification
          </h2>
          <p className="text-xs text-text-secondary mt-1">Check-in and check-out require the office network (its public IP). Remote work needs an exception per employee.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Office IP addresses (comma-separated)"
            value={officeIps}
            onChange={(e) => setOfficeIps(e.target.value)}
            placeholder="e.g. 203.0.113.7, 198.51.100.0/24"
            helperText="Public IP addresses or CIDR ranges of the office."
          />
          <Input
            label="Office hostnames (comma-separated)"
            value={officeHostnames}
            onChange={(e) => setOfficeHostnames(e.target.value)}
            placeholder="e.g. office.ddns.net"
            helperText="Dynamic DNS name of the office router, e.g. office.ddns.net"
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Company holidays</h2>
          <p className="text-xs text-text-secondary mt-1">No missing check-in alerts and no attendance obligation on these dates.</p>
        </div>
        <Input
          label="Holidays (YYYY-MM-DD, comma-separated)"
          value={holidays}
          onChange={(e) => setHolidays(e.target.value)}
          placeholder="e.g. 2026-12-25, 2027-01-01"
          helperText="Leave empty if there are none yet; you can add them later."
        />
        <Checkbox
          label="I confirm this holiday calendar (it may be empty)"
          checked={holidaysConfirmed}
          onChange={(e) => setHolidaysConfirmed(e.target.checked)}
        />
      </Card>

      {data.breaks?.enabled !== false && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Breaks</h2>
            <p className="text-xs text-text-secondary mt-1">Limits per attendance session. Breaks do not reduce the recorded working time.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Total break time (minutes)"
              type="number"
              min={0}
              max={480}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              helperText="Going over is allowed but flagged."
            />
            <Input
              label="Breaks per session"
              type="number"
              min={1}
              max={20}
              value={maxBreaks}
              onChange={(e) => setMaxBreaks(e.target.value)}
              helperText="A new break is refused once this is reached."
            />
          </div>
        </Card>
      )}

      {problems.length > 0 && (
        <ul className="text-xs text-text-secondary list-disc pl-5 space-y-0.5" aria-label="Fix before saving">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-end">
        <Button type="submit" isLoading={saving} disabled={saving || problems.length > 0} leadingIcon={<Icon name="check" size={16} />}>
          Save working hours
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ company */

function CompanyForm({ data, onSaved, onReload }: { data: SettingsDto; onSaved: () => Promise<void>; onReload: () => Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState(String(data.company['company.name'] ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const { user } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      await patchSettings({ version: data.version, company: { 'company.name': name.trim() } });
      await onSaved();
      toast.show({ tone: 'success', title: 'Company name saved' });
    } catch (err) {
      if (err instanceof ApiError && err.isVersionConflict) setConflict(true);
      else setError(saveErrorText(err, 'Could not save the company name. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {conflict && (
        <Alert tone="warning" title="Someone else changed these settings" body="Your edit was not saved. Load the latest settings, then try again.">
          <div className="mt-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void onReload()}>
              Load latest
            </Button>
          </div>
        </Alert>
      )}
      {error && <Alert tone="danger" title="Could not save" body={error} role="alert" />}
      <Card className="p-6 space-y-4 max-w-xl">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Company profile</h2>
          <p className="text-xs text-text-secondary mt-1">The organization name used in emails and exports.</p>
        </div>
        <Input label="Company name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
        <Input label="Your account email" type="email" value={user?.email ?? ''} readOnly disabled helperText="The address you sign in with." />
        <div className="pt-2 flex items-center justify-end">
          <Button type="submit" isLoading={saving} disabled={saving || !name.trim() || name.trim() === String(data.company['company.name'] ?? '')} leadingIcon={<Icon name="check" size={16} />}>
            Save company name
          </Button>
        </div>
      </Card>
    </form>
  );
}

/* ------------------------------------------------------------------ access + security */

function AccessTab() {
  return (
    <Card className="p-6 space-y-4 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Roles & permissions</h2>
        {/* Fixed v1 scope (approved 2026-10-29): four fixed roles, no custom-role management (no studio link). */}
        <p className="text-xs text-text-secondary mt-1">Udigity v1 has four fixed roles: Owner, Data Entry, Call Center and Developer. Custom roles are not part of v1.</p>
      </div>
      <div className="p-4 bg-surface-subtle border border-border-subtle rounded-xl space-y-1">
        <div className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <Icon name="shield" size={16} className="text-brand-primary" />
          Fixed roles
        </div>
        <p className="text-xs text-text-secondary">Assign a role from the employee record. What each role can see and do is set by the approved policy.</p>
      </div>
    </Card>
  );
}

function SecurityTab() {
  const status = useApi<TwoFactorStatusDto>(identityPaths.twoFactorStatus, { revalidateOnFocus: false, refreshInterval: 0 });
  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Your two-factor sign-in</h2>
          <p className="text-xs text-text-secondary mt-1">Owners must verify with an authenticator app every time they sign in.</p>
        </div>
        {status.error && !status.data ? (
          <ApiErrorView error={status.error} route={status.route} onRetry={() => void status.retry()} size="inline" what="your two-factor status" />
        ) : !status.data ? (
          <Skeleton className="h-10 rounded-md" />
        ) : (
          <div className="divide-y divide-border-subtle text-xs">
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="font-semibold text-text-primary">Authenticator app</div>
              <Badge tone={status.data.enrolled ? 'success' : 'warning'}>{status.data.enrolled ? 'Set up' : 'Not set up'}</Badge>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="font-semibold text-text-primary">Recovery codes left</div>
              <span className="text-text-primary tabular-nums">{status.data.recoveryCodesRemaining}</span>
            </div>
          </div>
        )}
      </Card>
      <Card className="p-6">
        <EnrollmentTokenPanel />
      </Card>
    </div>
  );
}
