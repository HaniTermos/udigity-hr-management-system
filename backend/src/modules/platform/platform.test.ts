/** Platform unit tests (no DB): scheduler slots, backoff, outbox payload rules, test clock. */
import { afterEach, describe, expect, it } from 'vitest';
import { clock } from './clock.js';
import { backoffSeconds, slotFor, validateOutboxEvent } from './service.js';

describe('scheduler slots', () => {
  it('every:N → same slot inside the window, next slot after it', () => {
    const a = slotFor('every:60', new Date('2026-10-23T10:00:05Z'), '');
    const b = slotFor('every:60', new Date('2026-10-23T10:00:59Z'), '');
    const c = slotFor('every:60', new Date('2026-10-23T10:01:00Z'), '');
    expect(a?.dedupeKey).toBe('slot:2026-10-23T10:00:00.000Z');
    expect(b?.dedupeKey).toBe(a?.dedupeKey);
    expect(c?.dedupeKey).toBe('slot:2026-10-23T10:01:00.000Z');
  });

  it('daily:HH:MM uses company time and is Not configured without a timezone', () => {
    const at = new Date('2026-10-23T01:30:00Z'); // 04:30 in Asia/Beirut (UTC+3)
    expect(slotFor('daily:03:00', at, '')).toBeNull();
    expect(slotFor('daily:03:00', at, 'Asia/Beirut')?.dedupeKey).toBe('day:2026-10-23');
    expect(slotFor('daily:05:00', at, 'Asia/Beirut')).toBeNull();
    expect(slotFor('daily:03:00', at, 'Not/AZone')).toBeNull();
  });
});

describe('backoff', () => {
  it('doubles and caps', () => {
    expect([1, 2, 3, 4].map((n) => backoffSeconds(n, 5, 3600))).toEqual([5, 10, 20, 40]);
    expect(backoffSeconds(30, 5, 3600)).toBe(3600);
  });
});

describe('outbox payload rules (ids only)', () => {
  const base = { name: 'deal.closed' as const, aggregateType: 'deal', aggregateId: '00000000-0000-4000-8000-000000000001' };
  it('accepts ids and small scalars', () => {
    expect(validateOutboxEvent({ ...base, payload: { dealId: 'x', version: 2, ok: true, none: null } })).toBeTruthy();
  });
  it('rejects unknown events, objects and long strings', () => {
    expect(() => validateOutboxEvent({ ...base, name: 'nope' as never })).toThrow(/Unknown outbox event/);
    expect(() => validateOutboxEvent({ ...base, payload: { note: 'x'.repeat(201) } })).toThrow();
    expect(() => validateOutboxEvent({ ...base, payload: { obj: {} as never } })).toThrow();
  });
});

describe('test clock', () => {
  afterEach(() => clock.set(null));
  it('pins and advances only in NODE_ENV=test', () => {
    clock.set(new Date('2026-01-01T00:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(clock.advance(90_000).toISOString()).toBe('2026-01-01T00:01:30.000Z');
    clock.set(null);
    expect(clock.isOverridden()).toBe(false);
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
