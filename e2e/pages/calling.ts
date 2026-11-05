import { expect, type Locator, type Page } from '@playwright/test';

export type Outcome = 'On hold' | 'Needs another call' | 'Rejected' | 'Accepted';

/** SCR-CC-001 Calling queue (/queue). */
export class CallingQueuePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/queue');
  }

  row(businessName: string) {
    return this.page.getByRole('row', { name: new RegExp(businessName) }).or(this.page.getByRole('link', { name: new RegExp(businessName) })).first();
  }

  async open(businessName: string) {
    await this.row(businessName).click();
  }

  /** AC-DNC-001: Rejected businesses never appear in a callable bucket. */
  async expectNotCallable(businessName: string) {
    const callable = this.page.locator('[data-bucket]:not([data-bucket="rejected"])');
    await expect(callable.getByText(businessName)).toHaveCount(0);
  }
}

/** SCR-CC-002 Contact workspace, SCR-CC-003 Active contact, SCR-CC-005 Reservation block. */
export class ContactWorkspacePage {
  readonly startContact: Locator;
  readonly cancelContact: Locator;
  readonly saveAttempt: Locator;
  readonly saveKeepReservation: Locator;
  readonly notes: Locator;
  readonly requestCorrection: Locator;

  constructor(readonly page: Page) {
    this.startContact = page.getByRole('button', { name: /start contact/i });
    this.cancelContact = page.getByRole('button', { name: /cancel contact/i });
    this.saveAttempt = page.getByRole('button', { name: /^save attempt$/i });
    this.saveKeepReservation = page.getByRole('button', { name: /save, keep reservation/i });
    this.notes = page.getByLabel(/notes/i).first();
    this.requestCorrection = page.getByRole('button', { name: /request correction/i });
  }

  outcomeCard(outcome: Outcome) {
    return this.page.getByRole('radio', { name: new RegExp(`^${outcome}`, 'i') });
  }

  async start() {
    await this.startContact.click();
  }

  async expectReservedByYou() {
    await expect(this.page.getByText(/reserved by you/i).first()).toBeVisible();
  }

  /** AC-RES-002 collision. */
  async expectReservedByAnother(holderName?: string) {
    await expect(this.page.getByText(/reserved by another agent/i).first()).toBeVisible();
    if (holderName) await expect(this.page.getByText(holderName).first()).toBeVisible();
  }

  /** AC-OUT-001: four cards, none preselected, no Pending. */
  async expectFourOutcomesNoDefault() {
    for (const o of ['On hold', 'Needs another call', 'Rejected', 'Accepted'] as Outcome[]) {
      await expect(this.outcomeCard(o)).toBeVisible();
      await expect(this.outcomeCard(o)).not.toBeChecked();
    }
    await expect(this.page.getByRole('radio', { name: /^pending/i })).toHaveCount(0);
  }

  async chooseOutcome(outcome: Outcome) {
    await this.outcomeCard(outcome).check();
  }

  /**
   * AC-OUT-005 [APPROVED U-01]: Accepted keeps "Save, keep reservation".
   * AC-OUT-007: Rejected offers only "Save attempt".
   */
  async expectFooterFor(outcome: Outcome) {
    await expect(this.saveAttempt).toBeVisible();
    if (outcome === 'Rejected') await expect(this.saveKeepReservation).toHaveCount(0);
    else await expect(this.saveKeepReservation).toBeVisible();
  }
}
