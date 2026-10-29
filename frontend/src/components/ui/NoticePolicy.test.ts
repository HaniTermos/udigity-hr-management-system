import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_ALTERNATIVE_LABEL, NoticePolicy, PolicyPendingChip, isPolicySettled } from './NoticePolicy';

describe('policy components for open items always show their marker', () => {
  it('chip shows id and the demo label', () => {
    const html = renderToStaticMarkup(createElement(PolicyPendingChip, { dec: 'OQ-13', demo: true }));
    expect(html).toContain('OQ-13');
    expect(html).toContain(DEMO_ALTERNATIVE_LABEL);
  });
  it('chip without demo shows Policy pending', () => {
    expect(renderToStaticMarkup(createElement(PolicyPendingChip, { dec: 'OQ-18' }))).toContain('Policy pending');
  });
  it.each(['block', 'inline', 'chip'] as const)('%s notice renders id, body and demo label', (size) => {
    const html = renderToStaticMarkup(createElement(NoticePolicy, { size, dec: 'OQ-15', demo: true, body: 'Body text' }));
    expect(html).toContain('OQ-15');
    expect(html).toContain(DEMO_ALTERNATIVE_LABEL);
    if (size !== 'chip') expect(html).toContain('Body text');
  });
});

describe('decisions settled by the approved baseline (2026-10-29) show no pending marker', () => {
  it.each(['DEC-001', 'DEC-004', 'DEC-007', 'DEC-020', 'DEC-026', 'DEC-034', 'C-01', 'F-01'])('%s renders nothing', (dec) => {
    expect(renderToStaticMarkup(createElement(PolicyPendingChip, { dec, demo: true }))).toBe('');
    expect(renderToStaticMarkup(createElement(NoticePolicy, { dec, body: 'x' }))).toBe('');
  });
  it('open questions outside the baseline stay pending', () => {
    for (const dec of ['R-11', 'R-13', 'OQ-12', 'OQ-13', 'OQ-15', 'OQ-18', 'OQ-19']) expect(isPolicySettled(dec)).toBe(false);
  });
});
