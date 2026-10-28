import { expect, type Locator, type Page } from '@playwright/test';

/** SCR-DE-001 Business directory (/businesses). */
export class BusinessDirectoryPage {
  readonly search: Locator;
  readonly addBusiness: Locator;
  readonly rows: Locator;

  constructor(readonly page: Page) {
    this.search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).first();
    this.addBusiness = page.getByRole('link', { name: /add business/i }).or(page.getByRole('button', { name: /add business/i })).first();
    this.rows = page.getByRole('row');
  }

  async goto() {
    await this.page.goto('/businesses');
  }

  row(name: string) {
    return this.rows.filter({ hasText: name });
  }

  /** AC-VIS-006: hidden rows are omitted (and therefore cannot be counted). */
  async expectNotListed(name: string) {
    await expect(this.page.getByText(name, { exact: true })).toHaveCount(0);
  }
}

export interface NewBusiness {
  name: string;
  category?: string;
  branch?: string;
  phone?: string;
  socialPlatform?: string;
  socialHandle?: string;
}

/** SCR-DE-002 Create business (/businesses/new) and SCR-DE-003 duplicate dialog. */
export class CreateBusinessPage {
  readonly save: Locator;
  readonly errorSummary: Locator;
  readonly duplicateDialog: Locator;

  constructor(readonly page: Page) {
    this.save = page.getByRole('button', { name: /^save/i }).first();
    this.errorSummary = page.getByRole('alert').first();
    this.duplicateDialog = page.getByRole('dialog').filter({ hasText: /already exists/i });
  }

  async goto() {
    await this.page.goto('/businesses/new');
  }

  async fill(b: NewBusiness) {
    await this.page.getByLabel(/business name/i).fill(b.name);
    if (b.category) await this.page.getByLabel(/category/i).selectOption({ label: b.category }).catch(async () => {
      await this.page.getByLabel(/category/i).click();
      await this.page.getByRole('option', { name: b.category }).click();
    });
    if (b.branch) await this.page.getByLabel(/branch/i).fill(b.branch);
    if (b.phone) await this.page.getByLabel(/phone/i).first().fill(b.phone);
    if (b.socialHandle) await this.page.getByLabel(/handle|link/i).first().fill(b.socialHandle);
  }

  async submit() {
    await this.save.click();
  }

  /** AC-DUP-009: no bypass, override or merge control for any role. */
  async expectNoBypass() {
    await expect(this.duplicateDialog).toBeVisible();
    await expect(this.duplicateDialog.getByRole('button', { name: /save anyway|override|bypass|merge|continue anyway/i })).toHaveCount(0);
  }

  /** AC-DUP-007: existence only for a hidden match. */
  async expectExistenceOnly(hiddenName: string) {
    await expect(this.duplicateDialog).toBeVisible();
    await expect(this.duplicateDialog.getByText(hiddenName)).toHaveCount(0);
    await expect(this.duplicateDialog.getByRole('button', { name: /open existing/i })).toHaveCount(0);
  }

  /** AC-DUP-006: Back to form keeps the values. */
  async backToForm() {
    await this.duplicateDialog.getByRole('button', { name: /back to form/i }).click();
    await expect(this.duplicateDialog).toBeHidden();
  }
}
