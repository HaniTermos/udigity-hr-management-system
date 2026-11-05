import { describe, expect, it } from 'vitest';
import { dealListPath, dealSearchTerm } from './deals';

describe('deal list query', () => {
  it('sends q only from 2 characters, trimmed and capped at 80', () => {
    expect(dealSearchTerm(' a ')).toBeUndefined();
    expect(dealSearchTerm('  ab ')).toBe('ab');
    expect(dealSearchTerm('x'.repeat(100))).toHaveLength(80);
  });
  it('puts q and projectStatus on the path', () => {
    const path = dealListPath({ tab: 'closed', q: 'cafe', projectStatus: 'in_progress', page: 2 });
    expect(path).toContain('q=cafe');
    expect(path).toContain('projectStatus=in_progress');
    expect(path).toContain('page=2');
  });
});
