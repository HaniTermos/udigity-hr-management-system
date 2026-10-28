import { test, expect } from '../../fixtures/test';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { forceTheme, expectNavySurfaces, expectReadableContrast } from '../../helpers/theme';
import { compareWithPreview } from '../../helpers/visual';

/**
 * Smoke — SCR-AUTH-001 Login. Needs only the frontend (no backend, no credentials).
 * Criteria: AC-AUTH-001 (form), AC-AUTH-014, AC-UI-001, AC-UI-002, AC-UI-007.
 */
test.describe('SCR-AUTH-001 Login — smoke', () => {
  test('renders the sign-in form [AC-AUTH-001]', async ({ loginPage, page }) => {
    await loginPage.goto();
    await expect(page).toHaveTitle(/.+/);
    await expect(loginPage.email).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.submit).toBeEnabled();
    await expect(loginPage.forgotPassword).toBeVisible();
  });

  test('client validation blocks an empty submit and creates no session [AC-AUTH-008]', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.email.fill('');
    await loginPage.password.fill('');
    const apiCalls: string[] = [];
    page.on('request', (r) => r.url().includes('/api/auth/login') && apiCalls.push(r.url()));
    await loginPage.submit.click();
    await expect(loginPage.fieldError('Enter a valid email address')).toBeVisible();
    await expect(loginPage.fieldError('Enter your password.')).toBeVisible();
    expect(apiCalls, 'no login request on invalid input').toEqual([]);
  });

  test('password show/hide toggles masking [SCR-AUTH-001]', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.password.fill('example-not-a-secret');
    await expect(loginPage.password).toHaveAttribute('type', 'password');
    await loginPage.showPassword.click();
    await expect(loginPage.password).toHaveAttribute('type', 'text');
  });

  test('"Forgot password?" opens SCR-AUTH-004 [AC-AUTH-015]', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.forgotPassword.click();
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('session-expired return notice [AC-AUTH-010]', async ({ loginPage, page }) => {
    await loginPage.goto('?reason=session_expired');
    await expect(page.getByText('You were signed out')).toBeVisible();
  });

  test('protected page without a session redirects to login with redirect param [AC-AUTH-014]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Femployees|\/login\?.*redirect=\/employees/);
  });

  test('no serious/critical axe violations — Light [AC-UI-001]', async ({ loginPage, page }, testInfo) => {
    await forceTheme(page, 'light');
    await loginPage.goto();
    await expectNoA11yViolations(page, testInfo);
  });

  test('dark mode is navy and readable [AC-UI-002]', async ({ loginPage, page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-dark', 'navy check runs in the desktop-dark project');
    await forceTheme(page, 'dark');
    await loginPage.goto();
    await expectNavySurfaces(page, ['body']);
    await expectReadableContrast(page);
    await expectNoA11yViolations(page, testInfo);
  });

  test('design comparison with the Figma preview (advisory) [AC-UI-007]', async ({ loginPage, page }, testInfo) => {
    const frame =
      testInfo.project.name === 'mobile-light'
        ? 'SCR-AUTH-001 — Login — Mobile — Light'
        : testInfo.project.name === 'desktop-dark'
          ? 'SCR-AUTH-001 — Login — Desktop — Dark'
          : 'SCR-AUTH-001 — Login — Desktop — Light';
    if (testInfo.project.name === 'desktop-dark') await forceTheme(page, 'dark');
    await loginPage.goto();
    const result = await compareWithPreview(page, testInfo, '40', frame);
    // Advisory only: never fails the build (test-strategy §6).
    expect(result.preview, `preview file for ${frame}`).not.toBeNull();
  });
});
