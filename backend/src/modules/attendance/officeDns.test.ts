/**
 * Office dynamic-DNS hostnames (Owner decision 2026-10-29), no DB: resolve, cache, refresh after 5 min,
 * keep the last good addresses for at most 60 min when a refresh fails, then fail closed.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { clock } from '../platform/clock.js';
import { isValidHostname, resolveOfficeHostnames, setOfficeResolverForTests } from './officeDns.js';
import { officeCheck, type Schedule } from './time.js';

const T0 = new Date('2026-11-02T07:00:00Z').getTime();
const at = (minutes: number) => clock.set(new Date(T0 + minutes * 60_000));

const HOSTS: Schedule = {
  timezone: 'Asia/Beirut',
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  shiftStart: '09:00',
  graceMinutes: 10,
  verificationMode: 'ip',
  officeIps: [],
  officeHostnames: ['office.ddns.net'],
  holidays: [],
  holidaysConfirmed: true,
  saved: true,
  missingCheckoutFlagHours: 6,
};

afterEach(() => {
  clock.set(null);
  setOfficeResolverForTests(null);
});

describe('office hostnames', () => {
  it('validates hostname syntax', () => {
    expect(isValidHostname('office.ddns.net')).toBe(true);
    expect(isValidHostname('my-office.example.co')).toBe(true);
    for (const bad of ['localhost', 'https://office.ddns.net', 'office.ddns.net:80', '-a.example.com', 'a..b', 'Office.DDNS.net']) {
      expect(isValidHostname(bad), bad).toBe(false);
    }
  });

  it('a hostname-only office is configured; the resolved addresses join the allowlist', async () => {
    let calls = 0;
    setOfficeResolverForTests(async () => {
      calls++;
      return ['198.51.100.20', '::ffff:198.51.100.21'];
    });
    at(0);
    const r = await resolveOfficeHostnames(HOSTS.officeHostnames);
    expect(r).toEqual({ ips: ['198.51.100.20', '198.51.100.21'], unresolved: [] });
    expect(officeCheck('198.51.100.21', HOSTS, r.ips).result).toBe('passed');
    expect(officeCheck('203.0.113.9', HOSTS, r.ips).result).toBe('failed');
    // Without the resolved addresses (e.g. resolution failed) nothing passes: never allow-all.
    expect(officeCheck('198.51.100.20', HOSTS, []).result).toBe('failed');
    expect(officeCheck('198.51.100.20', { ...HOSTS, officeHostnames: [] }).result).toBe('not_configured');
    expect(calls).toBe(1);
  });

  it('refreshes at most every 5 minutes (the router address changes)', async () => {
    let ip = '198.51.100.20';
    let calls = 0;
    setOfficeResolverForTests(async () => {
      calls++;
      return [ip];
    });
    at(0);
    await resolveOfficeHostnames(HOSTS.officeHostnames);
    ip = '198.51.100.99';
    at(4.99);
    expect((await resolveOfficeHostnames(HOSTS.officeHostnames)).ips).toEqual(['198.51.100.20']); // cached
    at(5);
    expect((await resolveOfficeHostnames(HOSTS.officeHostnames)).ips).toEqual(['198.51.100.99']); // refreshed
    expect(calls).toBe(2);
  });

  it('a failed refresh keeps the last good addresses for at most 60 minutes, then fails closed', async () => {
    let ok = true;
    setOfficeResolverForTests(async () => {
      if (!ok) throw new Error('SERVFAIL');
      return ['198.51.100.20'];
    });
    at(0);
    await resolveOfficeHostnames(HOSTS.officeHostnames);
    ok = false;
    at(10);
    expect(await resolveOfficeHostnames(HOSTS.officeHostnames)).toEqual({ ips: ['198.51.100.20'], unresolved: [] });
    at(60);
    expect(await resolveOfficeHostnames(HOSTS.officeHostnames)).toEqual({ ips: ['198.51.100.20'], unresolved: [] });
    at(61);
    const closed = await resolveOfficeHostnames(HOSTS.officeHostnames);
    expect(closed).toEqual({ ips: [], unresolved: ['office.ddns.net'] });
    expect(officeCheck('198.51.100.20', HOSTS, closed.ips).result).toBe('failed');
    // Recovery: the next successful refresh restores it.
    ok = true;
    at(66);
    expect((await resolveOfficeHostnames(HOSTS.officeHostnames)).ips).toEqual(['198.51.100.20']);
  });

  it('a hostname that never resolved contributes nothing', async () => {
    setOfficeResolverForTests(async () => {
      throw new Error('NXDOMAIN');
    });
    at(0);
    expect(await resolveOfficeHostnames(['office.ddns.net'])).toEqual({ ips: [], unresolved: ['office.ddns.net'] });
  });
});
