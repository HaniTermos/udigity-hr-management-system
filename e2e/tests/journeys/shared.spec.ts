import { test, expect } from '@playwright/test';
import { stateOf } from '../../fixtures/roles';

/** Phase 7 shared.md: My Day check-in / check-out, notifications, session ended. [demo-default] DEC-009 IP, DEC-012 summary. */
test.describe.configure({ mode: 'serial' });
test.describe('Journey: Shared', () => {
  test.describe('attendance (Call Center user)', () => {
    test.use({ storageState: stateOf('callCenter') });

    test('check in from My Day [AC-ATT-001]', async ({ page }) => {
      await page.goto('/my-day');
      await expect(page.getByRole('heading', { name: 'My Day' })).toBeVisible();
      await expect(page.getByText('Not checked in').first()).toBeVisible();
      await page.getByRole('button', { name: 'Check in' }).first().click();
      // check-in flow (may confirm on a second screen)
      const confirm = page.getByRole('button', { name: /Check in|Confirm/ }).last();
      if (page.url().includes('check-in')) await confirm.click();
      await expect(page.getByText(/Checked in/).first()).toBeVisible();
    });

    test('check out requires a work summary of at least 10 characters [AC-ATT-009][AC-ATT-010]', async ({ page }) => {
      await page.goto('/my-day/check-out');
      const summary = page.getByLabel(/work completed|summary/i).first();
      await summary.fill('short');
      await page.getByRole('button', { name: /Check out/ }).last().click();
      await expect(page.getByText(/at least 10 characters/i).first()).toBeVisible();
      await summary.fill('Called four businesses and logged every outcome.');
      await page.getByRole('button', { name: /Check out/ }).last().click();
      await expect(page.getByText(/Checked out|closed|Not checked in/i).first()).toBeVisible();
    });

    test('notifications page loads [AC-NOTIF-001]', async ({ page }) => {
      await page.goto('/notifications');
      await expect(page.getByRole('heading', { name: /Notifications/ }).first()).toBeVisible();
    });
  });

  test.describe('session ended', () => {
    test('a lost session sends the user to sign in again [AC-AUTH-010]', async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/login');
      await page.locator('input[type="email"]').fill('sami.fares@udigity.demo');
      await page.locator('input[type="password"]').first().fill(process.env.E2E_PASSWORD!);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/my-day/);
      await ctx.clearCookies();
      await page.goto('/my-day');
      await expect(page).toHaveURL(/login|session-ended/);
      await page.goto('/session-ended');
      await expect(page.getByText(/session/i).first()).toBeVisible();
      await ctx.close();
    });

    test('sign out ends the session [AC-AUTH-009]', async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/login');
      await page.locator('input[type="email"]').fill('sami.fares@udigity.demo');
      await page.locator('input[type="password"]').first().fill(process.env.E2E_PASSWORD!);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/my-day/);
      await page.getByRole('button', { name: 'Sami Fares' }).click();
      await page.getByText('Sign out').click();
      await expect(page).toHaveURL(/login/);
      await page.goto('/projects');
      await expect(page).toHaveURL(/login/);
      await ctx.close();
    });
  });
});
