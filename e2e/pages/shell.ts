import { expect, type Locator, type Page } from '@playwright/test';

/** App shell: sidebar (navy in both modes), top bar, attendance chip, notifications bell, toasts. */
export class AppShell {
  readonly sidebar: Locator;
  readonly main: Locator;
  readonly bell: Locator;
  readonly attendanceChip: Locator;

  constructor(readonly page: Page) {
    this.sidebar = page.locator('aside').first();
    this.main = page.locator('main').first();
    this.bell = page.getByRole('button', { name: /notification/i });
    this.attendanceChip = page.getByRole('button', { name: /check in|check out|checked in/i }).first();
  }

  nav(name: string) {
    return this.sidebar.getByRole('link', { name, exact: true });
  }

  async navigate(name: string) {
    await this.nav(name).click();
  }

  toast(text: string | RegExp) {
    return this.page.getByRole('status').filter({ hasText: text }).or(this.page.getByText(text)).first();
  }

  /** SCR-SHR-011 (AC-AUTH-021 / AC-PERM-*). */
  async expectPermissionDenied() {
    await expect(this.page.getByText(/permission denied/i).first()).toBeVisible();
  }

  /** SCR-SHR-012 (AC-VIS-002/007): reveal nothing. */
  async expectHiddenByPolicy(hiddenBusinessName?: string) {
    await expect(this.page.getByText(/record hidden by policy/i).first()).toBeVisible();
    if (hiddenBusinessName) await expect(this.page.getByText(hiddenBusinessName)).toHaveCount(0);
  }

  /** AC-UI-005: flag-dependent behaviour is labelled in non-production builds. */
  demoLabel() {
    return this.page.getByText(/Demonstration alternative\s*[—-]\s*not approved/i);
  }
}
