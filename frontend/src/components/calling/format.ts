import { useMemo } from 'react';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';
import type { OutcomeType } from '@/components/ui/Badge';
import type { BusinessOutcome, QueueBucket } from '@/lib/api/calling';

/* ----------------------------------------------------------------- labels */

export const OUTCOME_LABEL: Record<BusinessOutcome, OutcomeType> = {
  pending: 'Pending',
  on_hold: 'On hold',
  needs_another_call: 'Needs another call',
  rejected: 'Rejected',
  accepted: 'Accepted',
};

export const BUCKET_TITLE: Record<QueueBucket, string> = {
  callback_due: 'Callbacks due today',
  overdue_follow_up: 'Overdue follow-ups',
  new_assigned: 'New assignments',
  callback_to_schedule: 'Callback to be scheduled',
  requires_contact: 'Requires contact',
  on_hold: 'On hold',
  upcoming_follow_up: 'Upcoming follow-ups',
};

export type QueueColumn = 'due-now' | 'to-start' | 'needs-attention';

export const BUCKET_COLUMN: Record<QueueBucket, QueueColumn> = {
  callback_due: 'due-now',
  overdue_follow_up: 'due-now',
  new_assigned: 'to-start',
  callback_to_schedule: 'to-start',
  requires_contact: 'needs-attention',
  on_hold: 'needs-attention',
  upcoming_follow_up: 'needs-attention',
};

/** Display order of buckets inside a column (and in the rail). */
export const BUCKET_ORDER: QueueBucket[] = [
  'callback_due',
  'overdue_follow_up',
  'new_assigned',
  'callback_to_schedule',
  'requires_contact',
  'on_hold',
  'upcoming_follow_up',
];

/* ------------------------------------------------------- timezone helpers */

const pad = (n: number) => String(n).padStart(2, '0');

function offsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** `YYYY-MM-DDTHH:mm` typed in the company timezone (browser zone when `tz` is null) -> ISO instant. */
export function zonedLocalToIso(local: string, tz: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return new Date(local).toISOString();
  if (!tz) return new Date(local).toISOString();
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let off = offsetMinutes(tz, new Date(guess));
  const first = guess - off * 60000;
  const off2 = offsetMinutes(tz, new Date(first));
  if (off2 !== off) off = off2;
  return new Date(guess - off * 60000).toISOString();
}

/** ISO instant -> `YYYY-MM-DDTHH:mm` in the company timezone (for datetime inputs). */
export function isoToZonedLocal(iso: string, tz: string | null): string {
  const d = new Date(iso);
  if (!tz) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const off = offsetMinutes(tz, d);
  const z = new Date(d.getTime() + off * 60000);
  return `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())}T${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}`;
}

/** Is the typed local datetime in the past? */
export function isPastLocal(local: string, tz: string | null): boolean {
  if (!local) return false;
  return new Date(zonedLocalToIso(local, tz)).getTime() <= Date.now();
}

/** Monday 00:00 of the week containing `dayKey` (`YYYY-MM-DD`), as a day key. Pure calendar arithmetic. */
export function weekStartKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

export function addDaysKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------ the hook */

export interface CallingFormat {
  timezone: string | null;
  /** `10:30` */
  time: (iso: string) => string;
  /** `13 Oct 15:10` */
  dayTime: (iso: string) => string;
  /** `Wed 21 Oct 09:00` */
  weekdayTime: (iso: string) => string;
  /** `Tue 20 Oct 2026` */
  dateLabel: (iso: string | Date) => string;
  dayKey: (iso: string | Date) => string;
  todayKey: () => string;
  toIso: (local: string) => string;
  toLocal: (iso: string) => string;
  isPast: (local: string) => boolean;
}

export function useCallingFormat(): CallingFormat {
  const ct = useCompanyTime();
  return useMemo<CallingFormat>(
    () => ({
      timezone: ct.timezone,
      time: (iso) => ct.formatTime(iso),
      dayTime: (iso) => ct.format(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ''),
      weekdayTime: (iso) =>
        ct.format(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ''),
      dateLabel: (iso) => ct.formatDate(iso).replace(',', ''),
      dayKey: (iso) => ct.dayKey(iso),
      todayKey: () => ct.dayKey(new Date()),
      toIso: (local) => zonedLocalToIso(local, ct.timezone),
      toLocal: (iso) => isoToZonedLocal(iso, ct.timezone),
      isPast: (local) => isPastLocal(local, ct.timezone),
    }),
    [ct]
  );
}
