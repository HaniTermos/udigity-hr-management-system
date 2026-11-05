import { describe, expect, it } from 'vitest';
import { DEFAULT_POLL_MS, effectivePollMs, stopsPolling } from './polling';

describe('polling policy', () => {
  it('does not poll by default', () => {
    expect(DEFAULT_POLL_MS).toBe(0);
    expect(effectivePollMs(undefined, undefined)).toBe(0);
  });
  it('keeps an explicit interval while healthy or on transient errors', () => {
    expect(effectivePollMs(20_000, undefined)).toBe(20_000);
    expect(effectivePollMs(20_000, 500)).toBe(20_000);
    expect(effectivePollMs(20_000, 429)).toBe(20_000);
  });
  it('stops on 401, 403 and 404', () => {
    for (const s of [401, 403, 404]) {
      expect(stopsPolling(s)).toBe(true);
      expect(effectivePollMs(20_000, s)).toBe(0);
    }
  });
  it('ignores negative intervals', () => {
    expect(effectivePollMs(-5, undefined)).toBe(0);
  });
});
