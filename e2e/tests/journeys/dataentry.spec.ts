import { test, expect, type Page } from '@playwright/test';
import { stateOf } from '../../fixtures/roles';

/** Phase 7 dataentry.md flows 2-4: create business, duplicate check, edit, correction queue. */
test.describe('Journey: Data Entry', () => {
  test.use({ storageState: stateOf('dataEntry') });

  const stamp = Date.now().toString().slice(-7);
  const name = `Bayt Zaatar Bakery ${stamp}`;
  const phone = `7${stamp}`.slice(0, 8);

  async function fillForm(page: Page, businessName: string, phoneDigits: string) {
    await page.goto('/businesses/new');
    await expect(page.getByRole('heading', { name: 'New business' }).first()).toBeVisible();
    await page.getByLabel('Business name').fill(businessName);
    await page.getByLabel('Category').selectOption({ label: 'Other' }).catch(async () => {
      await page.getByLabel('Category').click();
      await page.getByRole('option', { name: 'Other' }).click();
    });
    await page.getByPlaceholder('70 000 000').first().fill(phoneDigits);
    await page.getByLabel('Platform').selectOption('Instagram').catch(async () => {
      await page.getByLabel('Platform').click();
      await page.getByRole('option', { name: 'Instagram' }).click();
    });
    await page.getByLabel('Handle or link').fill(`@bayt_${stamp}`);
    await page.getByLabel('Unknown').first().check();
    await page.getByLabel('Unknown').nth(1).check();
  }

  test('create a business [AC-BIZ-001]', async ({ page }) => {
    await fillForm(page, name, phone);
    await page.getByRole('button', { name: 'Save business' }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]{36}/);
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test('saving the same phone again shows the duplicate warning [AC-DUP-001]', async ({ page }) => {
    await fillForm(page, `${name} Second`, phone);
    await page.getByRole('button', { name: 'Save business' }).click();
    await expect(page.getByText(/already|duplicate|same phone/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/businesses\/new/);
  });

  test('edit a business and see it in the edit history [AC-BIZ-004]', async ({ page }) => {
    await page.goto('/businesses');
    await page.getByText(name).first().click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]{36}/);
    await page.getByRole('link', { name: /Edit business/ }).or(page.getByRole('button', { name: /Edit business/ })).first().click();
    await page.getByLabel('Notes').fill('Opens at 7am. Wood-fired oven.');
    await page.getByRole('button', { name: /Save changes/ }).click();
    await expect(page.getByText('Opens at 7am').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Edit history' }).or(page.getByText('Edit history').first()).first().click();
    await expect(page.getByText(/notes/i).first()).toBeVisible();
  });

  test('correction request queue loads [AC-DFIX-001]', async ({ page }) => {
    await page.goto('/corrections');
    await expect(page.getByRole('heading', { name: /Correction/ }).first()).toBeVisible();
    await expect(page.getByText(/Open/).first()).toBeVisible();
  });
});
