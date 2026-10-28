import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_ALTERNATIVE_LABEL, NoticePolicy, PolicyPendingChip } from './NoticePolicy';

describe('policy components never render nothing', () => {
  it('chip shows id and the demo label', () => {
    const html = renderToStaticMarkup(createElement(PolicyPendingChip, { dec: 'DEC-007', demo: true }));
    expect(html).toContain('DEC-007');
    expect(html).toContain(DEMO_ALTERNATIVE_LABEL);
  });
  it('chip without demo shows Policy pending', () => {
    expect(renderToStaticMarkup(createElement(PolicyPendingChip, { dec: 'OQ-18' }))).toContain('Policy pending');
  });
  it.each(['block', 'inline', 'chip'] as const)('%s notice renders id, body and demo label', (size) => {
    const html = renderToStaticMarkup(createElement(NoticePolicy, { size, dec: 'DEC-003', demo: true, body: 'Body text' }));
    expect(html).toContain('DEC-003');
    expect(html).toContain(DEMO_ALTERNATIVE_LABEL);
    if (size !== 'chip') expect(html).toContain('Body text');
  });
});
