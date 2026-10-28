import { describe, expect, it } from 'vitest';
import { periodEnd } from './period';

describe('periodEnd', () => {
  it('handles each period', () => {
    expect(periodEnd('2026-10-28', 'daily')).toBe('2026-10-28');
    expect(periodEnd('2026-10-28', 'weekly')).toBe('2026-11-03');
    expect(periodEnd('2026-10-28', 'monthly')).toBe('2026-10-31');
    expect(periodEnd('2026-02-10', 'monthly')).toBe('2026-02-28');
    expect(periodEnd('2026-11-15', 'quarterly')).toBe('2026-12-31');
    expect(periodEnd('2026-01-01', 'quarterly')).toBe('2026-03-31');
  });
});
