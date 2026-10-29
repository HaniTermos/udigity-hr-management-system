/**
 * MOD-attendance — pure helpers (no I/O): company-time conversion, punctuality, duration and the
 * office IP check. Owner: BE1. Unit-tested in time.test.ts (timezone/day boundaries, DST, spoofing).
 *
 * Policy (docs/policy-baseline-2026-10-29.md D1/D2): 9 h workday, shift end = start + 9 h, late strictly
 * after start + grace. Company values (working days, start, timezone, office IPs, holidays) come only
 * from an Owner-saved settings version; env/registry defaults never make attendance "configured".
 */
import net from 'net';

export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Confirmed: 9 h workday (DEC-007). */
export const REQUIRED_MINUTES = 540;

/**
 * D2: office verification is the IP/CIDR allowlist only. `disabled` (allow all) and the location modes
 * are not accepted; a stored legacy value counts as "Not configured".
 */
export const VERIFICATION_MODES = ['ip'] as const;
export type VerificationMode = (typeof VERIFICATION_MODES)[number];

/** D6: "Work completed" needs at least this many non-whitespace characters (not switchable off). */
export const SUMMARY_MIN_CHARS = 10;

/** D6: characters that count toward the summary minimum (all whitespace removed). */
export function summaryCharCount(text: string): number {
  return text.replace(/\s+/g, '').length;
}

/** The effective attendance schedule (a settings version, or the env pre-fill suggestions). */
export interface Schedule {
  /** '' = Not configured. */
  timezone: string;
  workingDays: string[];
  shiftStart: string;
  graceMinutes: number;
  /** Stored value; anything but 'ip' (legacy rows) is "Not configured". */
  verificationMode: string;
  officeIps: string[];
  /** Owner decision 2026-10-29: dynamic-DNS names of the office router (resolved by officeDns.ts). */
  officeHostnames: string[];
  holidays: string[];
  /** D1: the Owner explicitly confirmed the holiday list (possibly empty). */
  holidaysConfirmed: boolean;
  /** True only for an Owner-saved settings version; env/registry values are suggestions. */
  saved: boolean;
  missingCheckoutFlagHours: number;
}

/**
 * Owner decision 2026-10-29 (supersedes D1 "per-employee schedules out of scope"): an employee may have
 * their own start time and/or working days. null = the company value. Duration (9 h), grace, holidays and
 * the timezone stay company-wide.
 */
export interface EmployeeOverride {
  shiftStart: string | null;
  workingDays: string[] | null;
}

/** The company schedule with an employee's override applied (no override → unchanged). */
export function withOverride(s: Schedule, o: EmployeeOverride | null): Schedule {
  if (!o) return s;
  return { ...s, shiftStart: o.shiftStart ?? s.shiftStart, workingDays: o.workingDays ?? s.workingDays };
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
 * D1 punctuality, derived (never stored). Late strictly after start + grace, millisecond precision:
 * with shift 09:00 and grace 10, 09:10:00.000 is On time and 09:10:00.001 is Late (approved policy
 * change 2026-10-29; it replaces the earlier minute granularity of AC-ATT-002). Unclassified until the
 * schedule is configured.
 */
export function punctualityOf(effectiveCheckIn: Date, workDate: string, s: Schedule): { punctuality: Punctuality; lateMinutes: number } {
  if (missingSettings(s).length > 0) return { punctuality: 'unclassified', lateMinutes: 0 };
  if (nonWorkingReason(workDate, s)) return { punctuality: 'non_working_day', lateMinutes: 0 };
  const start = zonedToUtc(workDate, s.shiftStart, s.timezone).getTime();
  const t = effectiveCheckIn.getTime();
  if (t > start + s.graceMinutes * 60_000) return { punctuality: 'late', lateMinutes: Math.floor((t - start) / 60_000) };
  return { punctuality: 'on_time', lateMinutes: 0 };
}

/** D1: shift end = scheduled start + 9 h (HH:MM, wraps past midnight). Display only. */
export function shiftEndOf(shiftStart: string): string {
  const [h, m] = shiftStart.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const t = (h * 60 + m + REQUIRED_MINUTES) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** D1: the scheduled shift end instant (start + 9 h) on a work date; null until configured. */
export function shiftEndAt(workDate: string, s: Schedule): Date | null {
  if (missingSettings(s).length > 0) return null;
  return new Date(zonedToUtc(workDate, s.shiftStart, s.timezone).getTime() + REQUIRED_MINUTES * 60_000);
}

/** D5: shift end + flag hours (6) on the session's work date; null until configured. */
export function missingCheckoutDueAt(workDate: string, s: Schedule): Date | null {
  const end = shiftEndAt(workDate, s);
  return end ? new Date(end.getTime() + s.missingCheckoutFlagHours * 3_600_000) : null;
}

// ---------------------------------------------------------------------------
// Office IP check (D2). The client IP is ALWAYS `req.ip`: Express derives it from the socket, or,
// only through hops listed in TRUSTED_PROXY_CIDRS (`trust proxy`, app.ts), from the X-Forwarded-For
// entry appended by our own reverse proxy. A client-supplied X-Forwarded-For entry is never trusted by
// itself (ADR-016). This module never reads forwarding headers.
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

export type CheckResult = 'passed' | 'failed' | 'not_configured';

/**
 * Settings that are still "Not configured" (AC-SET-001; D1 "do not activate enforcement using assumed
 * values"): lateness, J-04 alerts and check-in/out stay inactive until an Owner-saved version holds a
 * timezone, working days, a start time, the office IP/CIDR list and an explicit holiday confirmation.
 */
export function missingSettings(s: Schedule): string[] {
  const missing: string[] = [];
  if (!s.saved) missing.push('attendance.settings');
  if (!s.timezone) missing.push('company.timezone');
  if (s.workingDays.length === 0) missing.push('attendance.workingDays');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.shiftStart)) missing.push('attendance.shiftStart');
  if (s.verificationMode !== 'ip') missing.push('attendance.verificationMode');
  else if (s.officeIps.length === 0 && s.officeHostnames.length === 0) missing.push('attendance.officeIps');
  if (!s.holidaysConfirmed) missing.push('attendance.holidays');
  return missing;
}

/**
 * D2 office check against the explicit IP/CIDR list ∪ `resolvedIps` (the addresses the office hostnames
 * resolve to). Not configured → inactive (`not_configured`), never a silent pass label.
 */
export function officeCheck(
  clientIp: string | null | undefined,
  s: Schedule,
  resolvedIps: readonly string[] = []
): { result: CheckResult; mode: VerificationMode } {
  if (missingSettings(s).length > 0) return { result: 'not_configured', mode: 'ip' };
  return { result: matchingEntries(clientIp, [...s.officeIps, ...resolvedIps]).length > 0 ? 'passed' : 'failed', mode: 'ip' };
}
