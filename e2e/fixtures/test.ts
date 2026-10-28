import { test as base, expect, type Page } from '@playwright/test';
import { authenticator } from 'otplib';
import { LoginPage, TwoFactorPage, ResetPasswordPage } from '../pages/auth';
import { AppShell } from '../pages/shell';
import { MyDayPage, CheckInPage, CheckOutPage } from '../pages/attendance';
import { BusinessDirectoryPage, CreateBusinessPage } from '../pages/business';
import { CallingQueuePage, ContactWorkspacePage } from '../pages/calling';
import { DealDetailPage, ProjectBoardPage } from '../pages/delivery';
import { ReportsPage, AuditLogPage } from '../pages/owner';
import { ownerTotpSecret, seedPassword, type Persona } from './personas';

type Pages = {
  loginPage: LoginPage;
  twoFactorPage: TwoFactorPage;
  resetPasswordPage: ResetPasswordPage;
  shell: AppShell;
  myDay: MyDayPage;
  checkIn: CheckInPage;
  checkOut: CheckOutPage;
  directory: BusinessDirectoryPage;
  createBusiness: CreateBusinessPage;
  queue: CallingQueuePage;
  workspace: ContactWorkspacePage;
  deal: DealDetailPage;
  projectBoard: ProjectBoardPage;
  reports: ReportsPage;
  auditLog: AuditLogPage;
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  twoFactorPage: async ({ page }, use) => use(new TwoFactorPage(page)),
  resetPasswordPage: async ({ page }, use) => use(new ResetPasswordPage(page)),
  shell: async ({ page }, use) => use(new AppShell(page)),
  myDay: async ({ page }, use) => use(new MyDayPage(page)),
  checkIn: async ({ page }, use) => use(new CheckInPage(page)),
  checkOut: async ({ page }, use) => use(new CheckOutPage(page)),
  directory: async ({ page }, use) => use(new BusinessDirectoryPage(page)),
  createBusiness: async ({ page }, use) => use(new CreateBusinessPage(page)),
  queue: async ({ page }, use) => use(new CallingQueuePage(page)),
  workspace: async ({ page }, use) => use(new ContactWorkspacePage(page)),
  deal: async ({ page }, use) => use(new DealDetailPage(page)),
  projectBoard: async ({ page }, use) => use(new ProjectBoardPage(page)),
  reports: async ({ page }, use) => use(new ReportsPage(page)),
  auditLog: async ({ page }, use) => use(new AuditLogPage(page)),
});

export { expect };

/**
 * Signs a persona in through the UI (AC-AUTH-001 / AC-AUTH-006).
 * Skips the calling test when E2E_PASSWORD is not set in the shell.
 * Owner: uses E2E_OWNER_TOTP_SECRET when set; otherwise relies on the non-production 2FA dev bypass.
 */
export async function signInAs(page: Page, persona: Persona) {
  const password = seedPassword();
  test.skip(!password, 'E2E_PASSWORD not set in the shell (dev seed password, backend/src/db/seed.ts)');
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(persona.email, password!);

  if (persona.role === 'owner') {
    const tf = new TwoFactorPage(page);
    await tf.expectChallenge();
    const secret = ownerTotpSecret();
    await tf.enterCode(secret ? authenticator.generate(secret) : '000000');
  }
  await expect(page).toHaveURL(new RegExp(`${persona.landing === '/' ? '/$' : persona.landing}`));
}
