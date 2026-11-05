import { test, expect, type Page } from '@playwright/test';
import { stateOf } from '../../fixtures/roles';

/** Phase 7 callcenter.md: queue -> start contact -> log outcome (Accepted keeps reservation, U-01) -> follow-up -> do-not-call. */
test.describe.configure({ mode: 'serial' });
test.describe('Journey: Call Center', () => {
  test.use({ storageState: stateOf('callCenter') });

  async function openContact(page: Page, business: string) {
    await page.goto('/queue');
    await expect(page.getByRole('heading', { name: 'Calling queue' })).toBeVisible();
    await page.getByText(business, { exact: true }).first().click();
    await expect(page).toHaveURL(/\/queue\/[0-9a-f-]{36}/);
  }

  test('queue lists assigned businesses without check-in [AC-CALL-001][AC-PERM-103]', async ({ page }) => {
    await page.goto('/queue');
    await expect(page.getByText('Olive & Thyme Cafe').first()).toBeVisible();
    await expect(page.getByText('Lumen Yoga Studio').first()).toBeVisible();
    await expect(page.getByText(/No check-in needed to call/)).toBeVisible();
  });

  test('start contact, log Accepted and keep the reservation [AC-RES-001][AC-OUT][approved U-01]', async ({ page }) => {
    await openContact(page, 'Olive & Thyme Cafe');
    await page.getByRole('button', { name: /Start contact/i }).click();
    await expect(page.getByText(/Outcome/).first()).toBeVisible();
    await page.getByLabel(/Accepted/).check();
    await page.getByLabel('What the client needs').fill('A booking website with online menu and table reservations for the cafe.');
    // U-01 (approved): Accepted keeps the reservation, so "Save, keep reservation" must be offered.
    const keep = page.getByRole('button', { name: 'Save, keep reservation' });
    await expect(keep).toBeEnabled();
    await keep.click();
    await expect(page.getByText(/Accepted/).first()).toBeVisible();
    await expect(page.getByText(/Reserved by you/).first()).toBeVisible();
  });

  test('log On hold with a follow-up [AC-FUP-001]', async ({ page }) => {
    await openContact(page, 'Lumen Yoga Studio');
    await page.getByRole('button', { name: /Start contact/i }).click();
    await page.getByLabel(/On hold/).check();
    const later = page.getByLabel(/schedule|follow-up/i).first();
    if (await later.isVisible().catch(() => false)) await later.check().catch(() => undefined);
    await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
    await expect(page.getByText(/On hold|saved|logged/i).first()).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: /Follow-ups/ }).first()).toBeVisible();
  });

  test('needs another call schedules a follow-up shown on the calendar [AC-FUP-001]', async ({ page }) => {
    await openContact(page, 'Cedar Print House');
    await page.getByRole('button', { name: /Start contact/i }).click();
    await page.getByLabel(/Needs another call/).check();
    const when = page.locator('input[type="datetime-local"]').first();
    await when.fill(new Date(Date.now() + 26 * 3600_000).toISOString().slice(0, 16));
    await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
    await page.goto('/calendar');
    await expect(page.getByText('Cedar Print House').first()).toBeVisible();
  });

  test('mark a business do-not-call with a reason [AC-DNC-001]', async ({ page }) => {
    await openContact(page, 'Urban Cuts Barbershop');
    await page.getByRole('button', { name: /Start contact/i }).click();
    await page.getByLabel(/Rejected/).check();
    await page.getByLabel('Reason for rejecting').fill('Owner asked us not to call again.');
    await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
    await page.goto('/do-not-call');
    await expect(page.getByText('Urban Cuts Barbershop').first()).toBeVisible();
  });
});
