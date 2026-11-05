import type { AttendanceCorrectionDto, AttendanceSessionDto, Punctuality, SessionState, VerificationDto } from '@/lib/api/attendance';
import type { BadgeTone } from '@/components/ui/Badge';

/** `5h 34m`, `9h 09m`, `0h 00m`. */
export function formatHM(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** `05:34:14` from whole seconds. */
export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export const PUNCTUALITY_LABEL: Record<Punctuality, string> = {
  on_time: 'On time',
  late: 'Late',
  unclassified: 'Unclassified',
  non_working_day: 'Non-working day',
};

export const PUNCTUALITY_TONE: Record<Punctuality, BadgeTone> = {
  on_time: 'neutral',
  late: 'warning',
  unclassified: 'neutral',
  non_working_day: 'neutral',
};

export const STATE_LABEL: Record<SessionState, string> = {
  open: 'Open',
  closed: 'Closed',
  closed_provisional: 'Provisional',
  pending_review: 'Pending review',
};

const MODE_LABEL: Record<string, string> = {
  none: 'no check',
  ip: 'office network',
  location: 'location',
  either: 'network or location',
  both: 'network and location',
};

/**
 * How a verification is worded (AC-ATT-015): "Recorded · mode …", never "Passed". The server records what it
 * checked; the screen does not claim the person was verified.
 */
export function verificationText(v: VerificationDto | null | undefined): string {
  if (!v) return 'Not recorded';
  const mode = v.mode ? (MODE_LABEL[v.mode] ?? v.mode) : null;
  switch (v.result) {
    case 'passed':
      return mode ? `Checked from the ${mode}` : 'Recorded';
    case 'failed':
      return mode ? `Not on the ${mode}` : 'Office check failed';
    case 'remote':
      return 'Remote exception recorded';
    case 'retroactive':
      return 'Entered by the Owner';
    case 'disabled':
      return 'Office check is off';
    case 'not_configured':
    default:
      return 'Office check not configured';
  }
}

/** The row status the table shows (a correction outcome wins over the plain session state). */
export interface RowStatus {
  label: string;
  tone: BadgeTone;
}

export function rowStatus(s: AttendanceSessionDto, isToday: boolean, correction?: AttendanceCorrectionDto): RowStatus {
  if (s.pendingCorrectionId || correction?.status === 'submitted') return { label: 'Correction pending', tone: 'warning' };
  if (correction?.status === 'rejected' && !s.adjusted) return { label: 'Correction rejected', tone: 'danger' };
  if (s.adjusted) return { label: 'Corrected', tone: 'success' };
  if (s.state === 'open' && (s.missingCheckout || !isToday)) return { label: 'Forgotten checkout', tone: 'warning' };
  if (s.state === 'open') return { label: 'Open', tone: 'info' };
  if (s.state === 'closed_provisional') return { label: 'Provisional', tone: 'warning' };
  if (s.state === 'pending_review') return { label: 'Pending review', tone: 'warning' };
  return { label: 'Closed', tone: 'neutral' };
}

/* ------------------------------------------------------------------ time zones */

function partsIn(ts: number, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(ts))) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

/** Offset (ms) of `timeZone` from UTC at instant `ts`. */
function offsetMs(ts: number, timeZone: string): number {
  const p = partsIn(ts, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
}

/**
 * Turn a company-time wall clock (`YYYY-MM-DD` + `HH:MM`) into an ISO instant. With no configured
 * timezone it uses the browser zone, the same fallback `useCompanyTime` reports as "Not configured".
 */
export function zonedToIso(day: string, hm: string, timeZone: string | null): string {
  const [y, m, d] = day.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  if (!timeZone) return new Date(y, m - 1, d, h, mi).toISOString();
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let ts = wall - offsetMs(wall, timeZone);
  ts = wall - offsetMs(ts, timeZone);
  return new Date(ts).toISOString();
}

/** `HH:MM` of an instant in the company zone, for time inputs. */
export function isoToHm(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

/** A `YYYY-MM-DD` work date as text, independent of any timezone (a date, not an instant). */
export function dayLabel(day: string, style: 'long' | 'short' = 'long'): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' };
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(date).replace(',', '');
}

export type Period = 'week' | 'month' | 'last30' | 'custom';

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Inclusive `from`/`to` work dates for a period, anchored on the company's current work date. */
export function periodRange(period: Exclude<Period, 'custom'>, anchor: string): { from: string; to: string } {
  const [y, m, d] = anchor.split('-').map(Number);
  if (period === 'last30') return { from: addDays(anchor, -29), to: anchor };
  if (period === 'month') {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
  }
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  return { from: addDays(anchor, -dow), to: addDays(anchor, 6 - dow) };
}
