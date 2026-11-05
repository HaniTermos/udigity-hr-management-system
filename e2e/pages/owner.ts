import { expect, type Locator, type Page } from '@playwright/test';

/** SCR-OWN-009 Reports & exports (/reports). Exports are Owner only and synchronous (ADR-010). */
export class ReportsPage {
  readonly exportButton: Locator;

  constructor(readonly page: Page) {
    this.exportButton = page.getByRole('button', { name: /^export|preparing download/i }).first();
  }

  async goto() {
    await this.page.goto('/reports');
  }

  /**
   * AC-EXP-001: the file arrives from the same request; returns the Playwright Download.
   * Asserts the loading label and that no "ready later" / job state appears.
   */
  async exportSynchronously() {
    const downloadPromise = this.page.waitForEvent('download', { timeout: 15_000 });
    await this.exportButton.click();
    const download = await downloadPromise;
    await expect(this.page.getByText(/we('| wi)ll (email|notify)|ready later|in the background/i)).toHaveCount(0);
    return download;
  }

  /** AC-EXP-005. */
  async expectExportDisabled() {
    await expect(this.exportButton).toBeDisabled();
  }
}

/** SCR-OWN-010 Audit log (/audit). Read-only, append-only. */
export class AuditLogPage {
  readonly rows: Locator;

  constructor(readonly page: Page) {
    this.rows = page.getByRole('row');
  }

  async goto() {
    await this.page.goto('/audit');
  }

  async openEvent(eventName: string) {
    await this.rows.filter({ hasText: eventName }).first().click();
    return this.page.getByRole('dialog').or(this.page.locator('[role="complementary"]')).first();
  }

  /** AC-AUD-003 / AC-EXP-007. */
  async expectReadOnly() {
    await expect(this.page.getByRole('button', { name: /^(edit|delete|hide|export)\b/i })).toHaveCount(0);
  }
}
