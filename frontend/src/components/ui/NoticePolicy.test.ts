import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NoticePolicy, POLICY_MARKERS_ENABLED, PolicyPendingChip } from './NoticePolicy';

describe('no pending-policy markers in v1 (Owner approved every open item, 2026-10-29)', () => {
  it.each(['DEC-001', 'DEC-004', 'DEC-007/008', 'DEC-006 / R-12', 'No DEC ID', 'A1', 'AR-13', 'R-11', 'OQ-18'])('%s renders nothing', (dec) => {
    expect(POLICY_MARKERS_ENABLED).toBe(false);
    expect(renderToStaticMarkup(createElement(PolicyPendingChip, { dec, demo: true }))).toBe('');
    for (const size of ['block', 'inline', 'chip'] as const) {
      expect(renderToStaticMarkup(createElement(NoticePolicy, { dec, size, demo: true, body: 'x' }))).toBe('');
    }
  });
});
