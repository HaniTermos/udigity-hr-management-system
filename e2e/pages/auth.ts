import { expect, type Locator, type Page } from '@playwright/test';

/**
 * SCR-AUTH-001 Login (frontend/src/app/login/page.tsx).
 * Locators prefer accessible names. The current page has <label>s that are not associated with
 * their inputs (no htmlFor/id), so getByLabel falls back to the input type until that is fixed
 * (ISSUE posted by QA; AC-UI-001).
 */
export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly showPassword: Locator;
  readonly submit: Locator;
  readonly forgotPassword: Locator;
  readonly errorBanner: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Sign in' });
    this.email = page.getByLabel('Email', { exact: true }).or(page.locator('input[type="email"]')).first();
    this.password = page
      .getByLabel('Password', { exact: true })
      .or(page.locator('form input[type="password"], form input[placeholder="••••••••"]'))
      .first();
    this.showPassword = page.getByRole('button', { name: /show|hide/i }).first();
    this.submit = page.getByRole('button', { name: 'Sign in', exact: true });
    this.forgotPassword = page.getByRole('link', { name: 'Forgot password?' });
    this.errorBanner = page.getByText('Sign-in failed');
  }

  async goto(query = '') {
    await this.page.goto(`/login${query}`);
    await expect(this.heading).toBeVisible();
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  fieldError(text: string | RegExp) {
    return this.page.getByText(text);
  }
}

/** SCR-AUTH-002 Owner 2FA challenge and SCR-AUTH-003 enrollment (same route, ?step=2fa | ?step=enroll). */
export class TwoFactorPage {
  readonly codeInput: Locator;
  readonly verify: Locator;
  readonly signOut: Locator;
  readonly lostFactor: Locator;

  constructor(readonly page: Page) {
    this.codeInput = page
      .getByLabel(/code/i)
      .or(page.locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]'))
      .first();
    this.verify = page.getByRole('button', { name: /verify/i });
    this.signOut = page.getByRole('button', { name: /sign out/i });
    this.lostFactor = page.getByRole('button', { name: /lost/i }).or(page.getByRole('link', { name: /lost/i }));
  }

  async expectChallenge() {
    await expect(this.page).toHaveURL(/\/login\?.*step=2fa/);
  }

  async enterCode(code: string) {
    await this.codeInput.fill(code);
    await this.verify.click();
  }
}

/** SCR-AUTH-004 Forgot / reset password. */
export class ResetPasswordPage {
  constructor(readonly page: Page) {}

  async goto(token?: string) {
    await this.page.goto(token ? `/reset-password?token=${encodeURIComponent(token)}` : '/reset-password');
  }

  async requestLink(email: string) {
    await this.page.getByLabel(/email/i).or(this.page.locator('input[type="email"]')).first().fill(email);
    await this.page.getByRole('button', { name: /request|send|reset/i }).first().click();
  }

  /** AC-AUTH-015: neutral "queued" copy, never "sent". */
  async expectNeutralQueuedCopy() {
    await expect(this.page.getByText(/queued/i).first()).toBeVisible();
    await expect(this.page.getByText(/\bsent\b/i)).toHaveCount(0);
  }
}
