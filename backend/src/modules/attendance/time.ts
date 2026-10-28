/**
 * MOD-attendance — pure helpers (no I/O): company-time conversion, punctuality, duration and the
 * office IP check. Owner: BE1. Unit-tested in time.test.ts (timezone/day boundaries, DST, spoofing).
 *
 * Every policy value used here (schedule, grace, office IPs, mode) is a Demonstration alternative —
 * not approved (docs/policy-defaults.md DEC-007/008/009/022). The 9 h workday is Confirmed.
 */
import net from 'net';

export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Confirmed: 9 h workday (DEC-007). */
export const REQUIRED_MINUTES = 540;

export const VERIFICATION_MODES = ['ip', 'geofence', 'ipOrLocation', 'ipAndLocation', 'disabled'] as const;
export type VerificationMode = (typeof VERIFICATION_MODES)[number];

/** The effective attendance schedule (a settings version, or the env defaults). */
export interface Schedule {
  /** '' = Not configured. */
  timezone: string;
  workingDays: string[];
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  verificationMode: VerificationMode;
  officeIps: string[];
  holidays: string[];
  summaryRequired: boolean;
  summaryMinLength: number;
  missingCheckoutFlagHours: number;
}

export interface LocalParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  weekday: Weekday;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    fmtCache.set(timeZone, f);
  }
  return f;
}

function parts(instant: Date, timeZone: string) {
  const out: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) out[p.type] = p.value;
  return out;
}

/** Company-local date/time/weekday of an instant. Throws on an invalid zone. */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const p = parts(instant, timeZone);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    weekday: p.weekday.toUpperCase().slice(0, 3) as Weekday,
  };
}

/** UTC offset of `timeZone` at `instant`, in minutes (local = UTC + offset). */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const p = parts(instant, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The instant of company-local wall time `date` + `hhmm` in `timeZone`. DST: a time that does not
 * exist (spring gap) resolves to the instant just after the gap; an ambiguous time (autumn) to the
 * first occurrence.
 */
export function zonedToUtc(date: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off1 = offsetMinutes(new Date(guess), timeZone);
  let t = guess - off1 * 60_000;
  const off2 = offsetMinutes(new Date(t), timeZone);
  if (off2 !== off1) {
    const t2 = guess - off2 * 60_000;
    // Keep the candidate whose local reading is the requested wall time when one exists.
    t = localParts(new Date(t2), timeZone).time === hhmm ? t2 : Math.max(t, t2);
  }
  return new Date(t);
}

/** Add whole days to a YYYY-MM-DD date (calendar arithmetic, no timezone). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Company-local work date of an instant; UTC date while the timezone is not configured. */
export function workDateOf(instant: Date, timeZone: string): string {
  return timeZone ? localParts(instant, timeZone).date : instant.toISOString().slice(0, 10);
}

export type NonWorkingReason = 'weekend' | 'holiday' | null;

/** DEC-022: scheduled working day = listed weekday and not a company holiday. */
export function nonWorkingReason(date: string, s: Pick<Schedule, 'workingDays' | 'holidays'>): NonWorkingReason {
  if (s.holidays.includes(date)) return 'holiday';
  if (!s.workingDays.includes(weekdayOf(date))) return 'weekend';
  return null;
}

export type Punctuality = 'on_time' | 'late' | 'unclassified' | 'non_working_day';

/**
 * DEC-007/008 punctuality, derived (never stored). Minute granularity: with shift 09:00 and grace 10,
 * 09:10:59 is On time and 09:11:00 is Late (AC-ATT-002). Unclassified while the timezone is missing.
 */
export function punctualityOf(
  effectiveCheckIn: Date,
  workDate: string,
  s: Pick<Schedule, 'timezone' | 'workingDays' | 'holidays' | 'shiftStart' | 'graceMinutes'>
): { punctuality: Punctuality; lateMinutes: number } {
  if (!s.timezone) return { punctuality: 'unclassified', lateMinutes: 0 };
  if (nonWorkingReason(workDate, s)) return { punctuality: 'non_working_day', lateMinutes: 0 };
  const start = zonedToUtc(workDate, s.shiftStart, s.timezone);
  const minutesAfter = Math.floor((effectiveCheckIn.getTime() - start.getTime()) / 60_000);
  if (minutesAfter > s.graceMinutes) return { punctuality: 'late', lateMinutes: minutesAfter };
  return { punctuality: 'on_time', lateMinutes: 0 };
}

/** Shift end + D5 flag hours on the session's work date; null while the timezone is missing. */
export function missingCheckoutDueAt(workDate: string, s: Pick<Schedule, 'timezone' | 'shiftEnd' | 'missingCheckoutFlagHours'>): Date | null {
  if (!s.timezone) return null;
  return new Date(zonedToUtc(workDate, s.shiftEnd, s.timezone).getTime() + s.missingCheckoutFlagHours * 3_600_000);
}

// ---------------------------------------------------------------------------
// Office IP check (DEC-009). The client IP is ALWAYS `req.ip`: Express derives it from the socket,
// or, only when TRUST_PROXY=true (`trust proxy` = 1 hop, app.ts), from the right-most
// X-Forwarded-For entry appended by our own reverse proxy. A client-supplied X-Forwarded-For entry
// is never trusted by itself (ADR-016). This module never reads forwarding headers.
// ---------------------------------------------------------------------------

/** `::ffff:1.2.3.4` → `1.2.3.4`; trims; strips an IPv6 zone id. */
export function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let v = ip.trim();
  const zone = v.indexOf('%');
  if (zone > 0) v = v.slice(0, zone);
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(v);
  if (mapped) v = mapped[1];
  return net.isIP(v) ? v : null;
}

/** An allowlist entry: an IPv4/IPv6 address or CIDR (`203.0.113.0/24`, `2001:db8::/48`). */
export function parseIpEntry(entry: string): { address: string; prefix: number; family: 'ipv4' | 'ipv6' } | null {
  const [addrRaw, prefixRaw, extra] = entry.trim().split('/');
  if (extra !== undefined) return null;
  const address = normalizeIp(addrRaw);
  if (!address) return null;
  const family = net.isIPv4(address) ? 'ipv4' : 'ipv6';
  const max = family === 'ipv4' ? 32 : 128;
  if (prefixRaw === undefined) return { address, prefix: max, family };
  if (!/^\d{1,3}$/.test(prefixRaw)) return null;
  const prefix = Number(prefixRaw);
  if (prefix < 0 || prefix > max) return null;
  return { address, prefix, family };
}

/** Allowlist entries that match `clientIp` (empty = no match). */
export function matchingEntries(clientIp: string | null | undefined, allowlist: readonly string[]): string[] {
  const ip = normalizeIp(clientIp);
  if (!ip) return [];
  const family = net.isIPv4(ip) ? 'ipv4' : 'ipv6';
  const out: string[] = [];
  for (const entry of allowlist) {
    const e = parseIpEntry(entry);
    if (!e || e.family !== family) continue;
    const list = new net.BlockList();
    list.addSubnet(e.address, e.prefix, e.family);
    if (list.check(ip, family)) out.push(entry);
  }
  return out;
}

export type CheckResult = 'passed' | 'failed' | 'disabled' | 'not_configured';

/** Has the chosen mode a verifier in v1? Location modes have none (no geofence verifier yet). */
export function verifierMissing(s: Pick<Schedule, 'verificationMode' | 'officeIps'>): 'officeIps' | 'location' | null {
  if (s.verificationMode === 'disabled') return null;
  if (s.verificationMode === 'ip') return s.officeIps.length === 0 ? 'officeIps' : null;
  return 'location';
}

/** Settings that are still "Not configured" (AC-SET-001): checks stay inactive until all are set. */
export function missingSettings(s: Schedule): string[] {
  const missing: string[] = [];
  if (!s.timezone) missing.push('company.timezone');
  const v = verifierMissing(s);
  if (v === 'officeIps') missing.push('attendance.officeIps');
  if (v === 'location') missing.push('attendance.verificationMode');
  return missing;
}

/** DEC-009 office check. Not configured → inactive (`not_configured`), never a silent pass label. */
export function officeCheck(clientIp: string | null | undefined, s: Schedule): { result: CheckResult; mode: VerificationMode } {
  const mode = s.verificationMode;
  if (missingSettings(s).length > 0) return { result: 'not_configured', mode };
  if (mode === 'disabled') return { result: 'disabled', mode };
  return { result: matchingEntries(clientIp, s.officeIps).length > 0 ? 'passed' : 'failed', mode };
}
