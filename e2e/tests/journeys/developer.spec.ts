import { test, expect } from '@playwright/test';
import { stateOf } from '../../fixtures/roles';

/** Phase 7 developer.md: deal, meeting outcome, project board, Record delivered with the open-task warning (OQ-10: warning only). */
test.describe.configure({ mode: 'serial' });
test.describe('Journey: Developer', () => {
  test.use({ storageState: stateOf('developer') });

  test('deals list opens the deal record [AC-DEAL-001]', async ({ page }) => {
    await page.goto('/deals');
    await expect(page.getByRole('heading', { name: 'Deals' })).toBeVisible();
    await expect(page.getByText('Glow Beauty Salon').first()).toBeVisible();
    await page.getByText('Open', { exact: true }).last().click();
    await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}/);
    await expect(page.getByText('Glow Beauty Salon').first()).toBeVisible();
    await expect(page.getByText(/DL-\d{4}/).first()).toBeVisible();
  });

  test('record a meeting outcome as Held [AC-MEET-001]', async ({ page }) => {
    await page.goto('/meetings');
    await expect(page.getByRole('heading', { name: /Meetings/ })).toBeVisible();
    await page.locator('button:visible', { hasText: 'Outcome due' }).first().click();
    await page.getByRole('tab', { name: 'Record outcome' }).or(page.getByRole('button', { name: 'Record outcome' })).first().click().catch(() => undefined);
    await page.getByLabel('Outcome').selectOption('held');
    await page.getByLabel('Discovery notes').fill('Client wants online booking and card payments. Budget confirmed.');
    await page.getByRole('button', { name: 'Save outcome' }).click();
    await expect(page.getByRole('button', { name: 'Save outcome' })).toBeHidden();
    await page.goto('/meetings');
    await expect(page.locator('button:visible', { hasText: 'Outcome due' })).toHaveCount(0);
  });

  test('project board: Record delivered warns about open tasks, then delivers [AC-PROJ-004][P7-check-1..4]', async ({ page }) => {
    await page.goto('/projects');
    await page.getByText('Open board').first().click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/);
    await expect(page.getByText('Content upload')).toBeVisible();
    // one task done, two stay open
    await page.getByRole('button', { name: 'Mark done' }).first().click();
    await page.getByRole('button', { name: 'Record delivered' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Record delivered with open tasks?')).toBeVisible();
    await expect(dialog.getByText(/2/).first()).toBeVisible();
    // Cancel: project stays In progress
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('In progress').first()).toBeVisible();
    // Confirm: warning only, delivery is allowed (OQ-10)
    await page.getByRole('button', { name: 'Record delivered' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Record delivered' }).click();
    await expect(page.getByText('Delivered').first()).toBeVisible();
  });
});
