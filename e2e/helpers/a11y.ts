import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** WCAG 2.0/2.1 A + AA (AC-UI-001). */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface A11yOptions {
  include?: string[];
  exclude?: string[];
  /** Only with a board REQUEST that names the rule, reason and expiry (test-strategy §5). */
  disableRules?: string[];
}

/**
 * Runs axe and fails on serious/critical violations. Moderate/minor ones are attached to the report.
 */
export async function expectNoA11yViolations(page: Page, testInfo: TestInfo, opts: A11yOptions = {}) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  for (const sel of opts.include ?? []) builder = builder.include(sel);
  for (const sel of opts.exclude ?? []) builder = builder.exclude(sel);
  if (opts.disableRules?.length) builder = builder.disableRules(opts.disableRules);

  const results = await builder.analyze();
  await testInfo.attach('axe-results.json', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map(
    (v) => `${v.impact} · ${v.id}: ${v.help} (${v.nodes.length} node(s): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')})`,
  );
  expect(summary, 'axe serious/critical violations').toEqual([]);
}
