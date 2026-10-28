import { test, expect, type Page } from '@playwright/test';
import { stateOf, type RoleKey } from '../fixtures/roles';
import { expectNoA11yViolations } from '../helpers/a11y';
import { applyThemeNow, sampleSurfaces } from '../helpers/theme';
import { OWNER_PAGES, DATA_ENTRY_PAGES, CALL_CENTER_PAGES, DEVELOPER_PAGES } from '../helpers/pages';

const SETS: [RoleKey, [string, RegExp][]][] = [
  ['owner', OWNER_PAGES],
  ['dataEntry', DATA_ENTRY_PAGES],
  ['callCenter', CALL_CENTER_PAGES],
  ['developer', DEVELOPER_PAGES],
];

async function load(page: Page, route: string, text: RegExp) {
  await page.goto(route);
  await expect(page.getByText(text).first()).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

test.describe('Accessibility (axe, WCAG 2.1 A/AA) on every main page [AC-UI-001]', () => {
  test('login page', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expectNoA11yViolations(page, testInfo);
  });
  for (const [role, pages] of SETS) {
    test.describe(role, () => {
      test.use({ storageState: stateOf(role) });
      for (const [route, text] of pages) {
        test(`${route}`, async ({ page }, testInfo) => {
          await load(page, route, text);
          await expectNoA11yViolations(page, testInfo);
        });
      }
    });
  }
});

test.describe('Navy dark mode [AC-UI-002]', () => {
  test.use({ storageState: stateOf('owner') });

  test('toggling the theme makes the background navy, not black or grey', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    const [body] = await sampleSurfaces(page, ['body']);
    expect(body, 'body surface sampled').toBeTruthy();
    const [r, g, b] = body.rgb;
    // Navy: blue channel clearly the highest, dark overall, not neutral grey/black.
    expect(b, `body rgb(${r},${g},${b})`).toBeGreaterThan(r + 15);
    expect(b).toBeGreaterThan(g + 8);
    expect(b).toBeLessThan(110);
    expect(body.isNavy, `hsl ${body.hsl.map((v) => v.toFixed(2)).join(',')}`).toBe(true);
  });

  test('dark mode stays navy on the main Owner pages', async ({ page }) => {
    await page.goto('/employees');
    await applyThemeNow(page, 'dark');
    for (const route of ['/employees', '/attendance/monitor', '/reports']) {
      await page.goto(route);
      await applyThemeNow(page, 'dark');
      const surfaces = await sampleSurfaces(page, ['body', 'main']);
      for (const s of surfaces) expect(s.isNavy, `${route} ${s.selector} rgb(${s.rgb})`).toBe(true);
    }
  });
});
