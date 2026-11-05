import { describe, expect, it } from 'vitest';
import { deviceLabel, normalizeSessions } from './sessions';

describe('sessions', () => {
  it('reads items or sessions and names the device', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
    const a = normalizeSessions({ items: [{ id: 's1', current: true, userAgent: ua, lastUsedAt: '2026-11-04T10:00:00Z' }] });
    expect(a).toEqual([{ id: 's1', current: true, createdAt: null, lastSeenAt: '2026-11-04T10:00:00Z', device: 'Chrome on Windows', ip: null }]);
    expect(normalizeSessions({ sessions: [{ id: 's2' }] })).toHaveLength(1);
    expect(normalizeSessions(null)).toEqual([]);
    expect(normalizeSessions({ items: [{ nope: 1 }] })).toEqual([]);
  });
  it('falls back for a missing user agent', () => {
    expect(deviceLabel(null)).toBe('Unknown device');
  });
});
