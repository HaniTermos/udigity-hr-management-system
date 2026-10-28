/**
 * MOD-attendance pure helpers (no DB): company-time conversion, day boundaries, DST, punctuality
 * (DEC-007/008 at the grace boundary), D5 due time and the DEC-009 office IP check (spoofing inputs).
 */
import { describe, expect, it } from 'vitest';
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
  workDateOf,
  zonedToUtc,
  type Schedule,
} from './time.js';

const BEIRUT: Schedule = {
  timezone: 'Asia/Beirut',
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  shiftStart: '09:00',
  shiftEnd: '18:00',
  graceMinutes: 10,
  verificationMode: 'ip',
  officeIps: ['203.0.113.0/24', '2001:db8::/48', '198.51.100.7'],
  holidays: ['2026-12-25'],
  summaryRequired: true,
  summaryMinLength: 10,
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

describe('punctuality (DEC-007 09:00 + DEC-008 grace 10)', () => {
  const at = (hhmmss: string) => new Date(`2026-10-23T${hhmmss}+03:00`);
  it('09:10:59 is on time, 09:11:00 is late (AC-ATT-002)', () => {
    expect(punctualityOf(at('09:10:00'), '2026-10-23', BEIRUT)).toEqual({ punctuality: 'on_time', lateMinutes: 0 });
    expect(punctualityOf(at('09:10:59'), '2026-10-23', BEIRUT).punctuality).toBe('on_time');
    expect(punctualityOf(at('09:11:00'), '2026-10-23', BEIRUT)).toEqual({ punctuality: 'late', lateMinutes: 11 });
    expect(punctualityOf(at('08:00:00'), '2026-10-23', BEIRUT).punctuality).toBe('on_time');
  });
  it('grace 0 makes 09:01 late', () => {
    expect(punctualityOf(at('09:01:00'), '2026-10-23', { ...BEIRUT, graceMinutes: 0 }).punctuality).toBe('late');
    expect(punctualityOf(at('09:00:59'), '2026-10-23', { ...BEIRUT, graceMinutes: 0 }).punctuality).toBe('on_time');
  });
  it('non-working day and not-configured', () => {
    expect(punctualityOf(new Date('2026-10-24T10:00:00+03:00'), '2026-10-24', BEIRUT).punctuality).toBe('non_working_day');
    expect(punctualityOf(at('11:00:00'), '2026-10-23', { ...BEIRUT, timezone: '' }).punctuality).toBe('unclassified');
  });
});

describe('missing checkout due (D5: shift end + 6 h)', () => {
  it('is 18:00 + 6 h company time on the work date', () => {
    expect(missingCheckoutDueAt('2026-10-23', BEIRUT)!.toISOString()).toBe('2026-10-23T21:00:00.000Z') // 18:00 +03:00 = 15:00Z, + 6 h;
    expect(missingCheckoutDueAt('2026-10-23', { ...BEIRUT, timezone: '' })).toBeNull();
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
  it('mode results: passed / failed / disabled / not_configured', () => {
    expect(officeCheck('203.0.113.5', BEIRUT).result).toBe('passed');
    expect(officeCheck('192.0.2.1', BEIRUT).result).toBe('failed');
    expect(officeCheck('192.0.2.1', { ...BEIRUT, verificationMode: 'disabled' }).result).toBe('disabled');
    expect(officeCheck('192.0.2.1', { ...BEIRUT, officeIps: [] }).result).toBe('not_configured');
    expect(officeCheck('192.0.2.1', { ...BEIRUT, timezone: '' }).result).toBe('not_configured');
    expect(officeCheck('192.0.2.1', { ...BEIRUT, verificationMode: 'geofence' }).result).toBe('not_configured');
  });
  it('lists what is not configured (AC-SET-001)', () => {
    expect(missingSettings(BEIRUT)).toEqual([]);
    expect(missingSettings({ ...BEIRUT, timezone: '', officeIps: [] })).toEqual(['company.timezone', 'attendance.officeIps']);
  });
});
