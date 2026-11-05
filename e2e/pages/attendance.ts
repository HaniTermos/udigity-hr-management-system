import { expect, type Locator, type Page } from '@playwright/test';

/** SCR-SHR-001 My Day. */
export class MyDayPage {
  readonly checkIn: Locator;
  readonly checkOut: Locator;
  readonly workList: Locator;

  constructor(readonly page: Page) {
    this.checkIn = page.getByRole('button', { name: /^check in$/i }).or(page.getByRole('link', { name: /^check in$/i })).first();
    this.checkOut = page.getByRole('button', { name: /^check out$/i }).or(page.getByRole('link', { name: /^check out$/i })).first();
    this.workList = page.getByRole('region', { name: /work list|today/i }).or(page.locator('main')).first();
  }

  async goto() {
    await this.page.goto('/my-day');
  }
}

/** SCR-SHR-002 Check-in flow (/my-day/check-in). */
export class CheckInPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/my-day/check-in');
  }

  verifying() {
    return this.page.getByText(/verifying/i).first();
  }

  /** AC-ATT-001/002: success with derived punctuality. */
  async expectSuccess(punctuality?: 'On time' | 'Late' | 'Unclassified' | 'Non-working day') {
    await expect(this.page.getByText(/checked in/i).first()).toBeVisible();
    if (punctuality) await expect(this.page.getByText(punctuality).first()).toBeVisible();
  }

  /** AC-ATT-005. */
  async expectVerificationFailure() {
    await expect(this.page.getByRole('button', { name: /retry check/i })).toBeVisible();
  }

  /** AC-ATT-007. */
  async expectOpenSessionBlock() {
    await expect(this.page.getByText(/open session/i).first()).toBeVisible();
  }
}

/** SCR-SHR-003 Checkout + work summary (/my-day/check-out). */
export class CheckOutPage {
  readonly workCompleted: Locator;
  readonly checkOut: Locator;
  readonly cancel: Locator;

  constructor(readonly page: Page) {
    this.workCompleted = page.getByLabel(/work completed/i).or(page.locator('textarea')).first();
    this.checkOut = page.getByRole('button', { name: /^check out$/i });
    this.cancel = page.getByRole('button', { name: /cancel/i });
  }

  async goto() {
    await this.page.goto('/my-day/check-out');
  }

  /** AC-ATT-009/010 (DEC-012 demo default: ≥ 10 characters). */
  async submit(summary: string) {
    await this.workCompleted.fill(summary);
    // The button is never pre-disabled (interaction-spec SCR-SHR-003).
    await expect(this.checkOut).toBeEnabled();
    await this.checkOut.click();
  }
}
