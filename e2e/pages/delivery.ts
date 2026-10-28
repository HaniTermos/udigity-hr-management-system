import { expect, type Locator, type Page } from '@playwright/test';

/** SCR-DEV-001 Deals (/deals) and SCR-DEV-002 Deal record detail. */
export class DealDetailPage {
  readonly recordSignature: Locator;
  readonly recordPayment: Locator;
  readonly requestVerification: Locator;
  readonly verifyAndFinalize: Locator;
  readonly markNotProceeding: Locator;

  constructor(readonly page: Page) {
    this.recordSignature = page.getByRole('button', { name: /record signature/i });
    this.recordPayment = page.getByRole('button', { name: /record payment/i });
    this.requestVerification = page.getByRole('button', { name: /request closure verification/i });
    this.verifyAndFinalize = page.getByRole('button', { name: /verify & finalize closure/i });
    this.markNotProceeding = page.getByRole('button', { name: /mark not proceeding/i });
  }

  async gotoList() {
    await this.page.goto('/deals');
  }

  stage(text: string | RegExp) {
    return this.page.getByText(text).first();
  }

  /** AC-CLOSE-010: a closed deal has no closure or not-proceeding controls. */
  async expectClosedReadOnly() {
    await expect(this.requestVerification).toHaveCount(0);
    await expect(this.verifyAndFinalize).toHaveCount(0);
    await expect(this.markNotProceeding).toHaveCount(0);
    await expect(this.page.getByRole('button', { name: /finalize closure/i })).toHaveCount(0);
  }
}

/** SCR-DEV-006 Project board, incl. the "Record delivered" open-task warning (interaction-spec P7). */
export class ProjectBoardPage {
  readonly recordDelivered: Locator;
  readonly recordCompleted: Locator;
  readonly openTaskDialog: Locator;

  constructor(readonly page: Page) {
    this.recordDelivered = page.getByRole('button', { name: /^record delivered$/i }).first();
    this.recordCompleted = page.getByRole('button', { name: /^record completed$/i }).first();
    this.openTaskDialog = page.getByRole('dialog', { name: /with open tasks\?/i });
  }

  async goto(projectPath = '/projects') {
    await this.page.goto(projectPath);
  }

  status() {
    return this.page.getByTestId('project-status').or(this.page.getByText(/^(Scheduled|In progress|Waiting for client|Blocked|Delivered|Completed)$/)).first();
  }

  column(name: 'To do' | 'In progress' | 'Done' | 'Cancelled') {
    return this.page.getByRole('region', { name }).or(this.page.locator(`[data-column="${name}"]`)).first();
  }

  /** Captures task → column so P7 check 4 can prove nothing moved. */
  async taskColumns(): Promise<Record<string, string>> {
    return this.page.evaluate(() => {
      const map: Record<string, string> = {};
      document.querySelectorAll('[data-column]').forEach((col) => {
        col.querySelectorAll('[data-task-title]').forEach((card) => {
          map[(card as HTMLElement).dataset.taskTitle ?? ''] = (col as HTMLElement).dataset.column ?? '';
        });
      });
      return map;
    });
  }

  async expectOpenTaskDialog(openTaskCount: number) {
    await expect(this.openTaskDialog).toBeVisible();
    await expect(this.openTaskDialog.getByText(new RegExp(`${openTaskCount} tasks? (is|are) not Done or Cancelled`))).toBeVisible();
    await expect(this.openTaskDialog.getByText(/In progress\s*→\s*Delivered/)).toBeVisible();
  }

  dialogConfirm() {
    return this.openTaskDialog.getByRole('button', { name: /^record delivered$/i });
  }

  dialogCancel() {
    return this.openTaskDialog.getByRole('button', { name: /^cancel$/i });
  }

  dialogReviewOpenTasks() {
    return this.openTaskDialog.getByRole('link', { name: /review open tasks/i }).or(this.openTaskDialog.getByRole('button', { name: /review open tasks/i }));
  }
}
