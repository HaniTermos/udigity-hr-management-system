/**
 * MOD-attendance pure helpers (no DB): company-time conversion, day boundaries, DST, punctuality
 * (D1 grace boundary, ms precision), D1 shift end, D5 due time, D6 summary count, the D2 office IP check
 * (spoofing inputs) and the trusted-proxy list.
 */
import { describe, expect, it } from 'vitest';
import { parseTrustedProxies } from '../../config/index.js';
import {
  localParts,
  matchingEntries,
  missingCheckoutDueAt,
  missingSettings,
  nonWorkingReason,
  normalizeIp,
  officeCheck,
  parseIpEntry,
  punctualityOf,
  shiftEndAt,
  shiftEndOf,
  summaryCharCount,
  workDateOf,
  zonedToUtc,
  type Schedule,
} from './time.js';

const BEIRUT: Schedule = {
  timezone: 'Asia/Beirut',
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  shiftStart: '09:00',
  graceMinutes: 10,
  verificationMode: 'ip',
  officeIps: ['203.0.113.0/24', '2001:db8::/48', '198.51.100.7'],
  officeHostnames: [],
  holidays: ['2026-12-25'],
  holidaysConfirmed: true,
  saved: true,
  missingCheckoutFlagHours: 6,
};

describe('company time and day boundaries', () => {
  it('work date follows the company timezone, not UTC', () => {
    // 2026-10-22T21:30Z = 2026-10-23 00:30 in Beirut (UTC+3 in October).
    const t = new Date('2026-10-22T21:30:00Z');
    expect(workDateOf(t, 'Asia/Beirut')).toBe('2026-10-23');
    expect(workDateOf(t, 'America/New_York')).toBe('2026-10-22');
    // Not configured → UTC date.
    expect(workDateOf(t, '')).toBe('2026-10-22');
  });

  it('one second before and at local midnight', () => {
    expect(workDateOf(new Date('2026-10-22T20:59:59Z'), 'Asia/Beirut')).toBe('2026-10-22');
    expect(workDateOf(new Date('2026-10-22T21:00:00Z'), 'Asia/Beirut')).toBe('2026-10-23');
  });

  it('zonedToUtc round-trips and handles DST (Beirut: last Sunday of March / October)', () => {
    expect(zonedToUtc('2026-10-23', '09:00', 'Asia/Beirut').toISOString()).toBe('2026-10-23T06:00:00.000Z');
    // Winter time UTC+2.
    expect(zonedToUtc('2026-12-01', '09:00', 'Asia/Beirut').toISOString()).toBe('2026-12-01T07:00:00.000Z');
    // New York spring gap: 02:30 does not exist on 2026-03-08 → resolves after the gap.
    const gap = zonedToUtc('2026-03-08', '02:30', 'America/New_York');
    expect(localParts(gap, 'America/New_York').time >= '03:00').toBe(true);
    // Every ordinary wall time round-trips.
    for (const tz of ['Asia/Beirut', 'Europe/London', 'Asia/Kolkata', 'Pacific/Auckland']) {
      const d = zonedToUtc('2026-06-15', '09:00', tz);
      expect(localParts(d, tz)).toMatchObject({ date: '2026-06-15', time: '09:00' });
    }
  });

  it('working days and holidays (DEC-022)', () => {
    expect(nonWorkingReason('2026-10-23', BEIRUT)).toBeNull(); // Friday
    expect(nonWorkingReason('2026-10-24', BEIRUT)).toBe('weekend'); // Saturday
    expect(nonWorkingReason('2026-12-25', BEIRUT)).toBe('holiday');
  });
});

describe('punctuality (D1: 09:00 + grace 10, late strictly after, ms precision)', () => {
  const at = (hhmmss: string) => new Date(`2026-10-23T${hhmmss}+03:00`);
  // Approved policy change 2026-10-29 (baseline D1): late iff check-in > start + grace. This replaces
  // the earlier minute-granularity rule under which 09:10:59 counted as on time.
  it('09:10:00.000 is on time, 09:10:00.001 and 09:10:59 are late', () => {
    expect(punctualityOf(at('09:10:00.000'), '2026-10-23', BEIRUT)).toEqual({ punctuality: 'on_time', lateMinutes: 0 });
    expect(punctualityOf(at('09:10:00.001'), '2026-10-23', BEIRUT)).toEqual({ punctuality: 'late', lateMinutes: 10 });
    expect(punctualityOf(at('09:10:59'), '2026-10-23', BEIRUT)).toEqual({ punctuality: 'late', lateMinutes: 10 });
    expect(punctualityOf(at('09:11:00'), '2026-10-23', BEIRUT)).toEqual({ punctuality: 'late', lateMinutes: 11 });
    expect(punctualityOf(at('08:00:00'), '2026-10-23', BEIRUT).punctuality).toBe('on_time');
  });
  it('grace 0: exactly 09:00 is on time, 09:00:00.001 is late', () => {
    expect(punctualityOf(at('09:00:00'), '2026-10-23', { ...BEIRUT, graceMinutes: 0 }).punctuality).toBe('on_time');
    expect(punctualityOf(at('09:00:00.001'), '2026-10-23', { ...BEIRUT, graceMinutes: 0 }).punctuality).toBe('late');
  });
  it('non-working day and not-configured (no lateness on assumed values)', () => {
    expect(punctualityOf(new Date('2026-10-24T10:00:00+03:00'), '2026-10-24', BEIRUT).punctuality).toBe('non_working_day');
    expect(punctualityOf(at('11:00:00'), '2026-10-23', { ...BEIRUT, timezone: '' }).punctuality).toBe('unclassified');
    // Env/registry suggestions (not an Owner-saved version) never classify.
    expect(punctualityOf(at('11:00:00'), '2026-10-23', { ...BEIRUT, saved: false }).punctuality).toBe('unclassified');
    expect(punctualityOf(at('11:00:00'), '2026-10-23', { ...BEIRUT, holidaysConfirmed: false }).punctuality).toBe('unclassified');
  });
});

describe('shift end = start + 9 h (D1) and missing checkout due (D5: + 6 h)', () => {
  it('derives the end from the start', () => {
    expect(shiftEndOf('09:00')).toBe('18:00');
    expect(shiftEndOf('08:30')).toBe('17:30');
    expect(shiftEndOf('16:00')).toBe('01:00'); // wraps past midnight
    expect(shiftEndAt('2026-10-23', BEIRUT)!.toISOString()).toBe('2026-10-23T15:00:00.000Z');
    expect(shiftEndAt('2026-10-23', { ...BEIRUT, shiftStart: '10:00' })!.toISOString()).toBe('2026-10-23T16:00:00.000Z');
  });
  it('is 18:00 + 6 h company time on the work date; null until configured', () => {
    expect(missingCheckoutDueAt('2026-10-23', BEIRUT)!.toISOString()).toBe('2026-10-23T21:00:00.000Z'); // 18:00 +03:00 = 15:00Z, + 6 h
    expect(missingCheckoutDueAt('2026-10-23', { ...BEIRUT, timezone: '' })).toBeNull();
    expect(missingCheckoutDueAt('2026-10-23', { ...BEIRUT, saved: false })).toBeNull();
  });
});

describe('work summary (D6)', () => {
  it('counts non-whitespace characters only', () => {
    expect(summaryCharCount('Called 30 businesses')).toBe(18);
    expect(summaryCharCount(' a b c d e f g h i ')).toBe(9);
    expect(summaryCharCount('a\tb\nc d e f g h i j')).toBe(10);
  });
});

describe('office IP check (DEC-009) and spoofing inputs', () => {
  it('normalizes IPv4-mapped IPv6 and rejects garbage', () => {
    expect(normalizeIp('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(normalizeIp(' 198.51.100.7 ')).toBe('198.51.100.7');
    expect(normalizeIp('203.0.113.9, 10.0.0.1')).toBeNull(); // a forwarded list is never an IP
    expect(normalizeIp('not-an-ip')).toBeNull();
    expect(normalizeIp(null)).toBeNull();
  });
  it('parses entries and CIDR ranges', () => {
    expect(parseIpEntry('203.0.113.0/24')).toEqual({ address: '203.0.113.0', prefix: 24, family: 'ipv4' });
    expect(parseIpEntry('2001:db8::/48')?.family).toBe('ipv6');
    expect(parseIpEntry('203.0.113.0/33')).toBeNull();
    expect(parseIpEntry('203.0.113.0/24/1')).toBeNull();
    expect(parseIpEntry('example.com')).toBeNull();
  });
  it('matches exact addresses and ranges only', () => {
    expect(matchingEntries('203.0.113.200', BEIRUT.officeIps)).toEqual(['203.0.113.0/24']);
    expect(matchingEntries('::ffff:198.51.100.7', BEIRUT.officeIps)).toEqual(['198.51.100.7']);
    expect(matchingEntries('2001:db8:0:1::5', BEIRUT.officeIps)).toEqual(['2001:db8::/48']);
    expect(matchingEntries('203.0.114.1', BEIRUT.officeIps)).toEqual([]);
    expect(matchingEntries('198.51.100.8', BEIRUT.officeIps)).toEqual([]);
    // A header-style list containing an office IP never matches.
    expect(matchingEntries('203.0.113.5, 192.0.2.1', BEIRUT.officeIps)).toEqual([]);
  });
  it('mode results: passed / failed / not_configured; retired modes never pass (D2)', () => {
    expect(officeCheck('203.0.113.5', BEIRUT).result).toBe('passed');
    expect(officeCheck('192.0.2.1', BEIRUT).result).toBe('failed');
    // A stored legacy `disabled` (allow all) or location mode is Not configured, never a pass.
    expect(officeCheck('203.0.113.5', { ...BEIRUT, verificationMode: 'disabled' }).result).toBe('not_configured');
    expect(officeCheck('203.0.113.5', { ...BEIRUT, verificationMode: 'geofence' }).result).toBe('not_configured');
    expect(officeCheck('192.0.2.1', { ...BEIRUT, officeIps: [] }).result).toBe('not_configured');
    expect(officeCheck('192.0.2.1', { ...BEIRUT, timezone: '' }).result).toBe('not_configured');
  });
  it('lists what is not configured (AC-SET-001, D1)', () => {
    expect(missingSettings(BEIRUT)).toEqual([]);
    expect(missingSettings({ ...BEIRUT, timezone: '', officeIps: [] })).toEqual(['company.timezone', 'attendance.officeIps']);
    expect(missingSettings({ ...BEIRUT, saved: false })).toEqual(['attendance.settings']);
    expect(missingSettings({ ...BEIRUT, holidaysConfirmed: false, workingDays: [] })).toEqual(['attendance.workingDays', 'attendance.holidays']);
    expect(missingSettings({ ...BEIRUT, verificationMode: 'ipOrLocation' })).toEqual(['attendance.verificationMode']);
  });
});

describe('trusted proxies for req.ip (D2: TRUSTED_PROXY_CIDRS)', () => {
  it('parses IPs, CIDRs and the Express presets; unset is null', () => {
    expect(parseTrustedProxies(undefined)).toBeNull();
    expect(parseTrustedProxies('  ')).toBeNull();
    expect(parseTrustedProxies('172.18.0.0/16, 10.0.0.5,::1,fd00::/8,loopback')).toEqual(['172.18.0.0/16', '10.0.0.5', '::1', 'fd00::/8', 'loopback']);
  });
  it('refuses anything else (no hop counts, no host names, no bad prefixes)', () => {
    for (const bad of ['1', 'true', 'nginx', '10.0.0.0/33', '10.0.0.0/8/1', '::1/129']) {
      expect(() => parseTrustedProxies(bad), bad).toThrow(/TRUSTED_PROXY_CIDRS/);
    }
  });
});
