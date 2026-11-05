import useSWR from 'swr';
import { adminPaths, type SettingsDto } from '@/lib/api/admin';
import { swrFetcher } from '@/lib/api/client';
import type { Role } from '@/lib/api/types';

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner/Admin',
  data_entry: 'Data Entry',
  call_center: 'Call Center',
  developer: 'Developer',
};

export function formatRoleName(role: string): string {
  return ROLE_LABEL[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value: value as Role, label }));

/** Company timezone from settings (plan §9: times render in company time); UTC until it is configured. */
export function useCompanyTimezone(): string {
  const { data } = useSWR<SettingsDto>(adminPaths.settings, swrFetcher, { revalidateOnFocus: false });
  const tz = data?.company?.['company.timezone'];
  return typeof tz === 'string' && tz ? tz : 'UTC';
}

function fmt(iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, ...opts }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(iso));
  }
}

export const formatClock = (iso: string, tz: string) => fmt(iso, tz, { hour: '2-digit', minute: '2-digit', hour12: false });
export const formatDayTime = (iso: string, tz: string) =>
  fmt(iso, tz, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
export const formatDay = (iso: string, tz: string) => fmt(iso, tz, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatWeekdayDay = (iso: string, tz: string) => fmt(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' });

/** `YYYY-MM-DD` of an instant in a timezone. */
export function dateInZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return parts;
}

/** `HH:MM` of an instant in a timezone. */
export function timeInZone(iso: string, timeZone: string): string {
  return formatClock(iso, timeZone);
}

/** Convert a company-time date (`YYYY-MM-DD`) and time (`HH:MM`) to a UTC ISO string. */
export function zonedToIso(date: string, time: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const utcGuess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  try {
    const offsetAt = (ms: number) => {
      const d = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).formatToParts(new Date(ms));
      const g = (k: string) => Number(d.find((p) => p.type === k)?.value);
      return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ms;
    };
    let ms = utcGuess - offsetAt(utcGuess);
    ms = utcGuess - offsetAt(ms);
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}
