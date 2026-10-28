import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import fs from 'fs';
import path from 'path';
import { stateOf } from '../../fixtures/roles';

/** Phase 7 owner.md. AC-AUTH-002/006 (2FA), dashboard, employees, attendance monitor, assignments, export, settings. */
test.describe('Journey: Owner', () => {
  test('login with 2FA lands on the dashboard [AC-AUTH-002][AC-AUTH-006]', async ({ browser }) => {
    test.setTimeout(90_000);
    const secret = process.env.E2E_OWNER_TOTP_SECRET!;
    const codeFile = path.join(__dirname, '../../.auth/owner-code.txt');
    const used = fs.existsSync(codeFile) ? fs.readFileSync(codeFile, 'utf8') : '';
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('rana.haddad@udigity.demo');
    await page.locator('input[type="password"]').first().fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/step=2fa/);
    // Owner is not usable before 2FA completes.
    await page.goto('/employees');
    await expect(page).toHaveURL(/login/);
    // wait for a TOTP code different from the one the setup consumed (replay protection)
    await expect.poll(() => authenticator.generate(secret), { timeout: 40_000 }).not.toBe(used);
    const loginCode = authenticator.generate(secret);
    fs.writeFileSync(codeFile, loginCode); // later step-up prompts must wait for a fresh code (replay protection)
    await page.locator('input').first().fill(loginCode);
    await page.getByRole('button', { name: /verify/i }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await ctx.close();
  });

  test.describe('signed in', () => {
    test.use({ storageState: stateOf('owner') });

    test('dashboard shows KPI cards [AC-DASH]', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByText('Call attempts').first()).toBeVisible();
      await expect(page.getByText('Attendance today').first()).toBeVisible();
    });

    test('employees list shows the seeded team [AC-EMP-001]', async ({ page }) => {
      await page.goto('/employees');
      await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
      for (const n of ['Karim Saleh', 'Maya Khoury', 'Omar Nassar', 'Lina Aoun', 'Sami Fares']) {
        await expect(page.getByText(n, { exact: true }).first()).toBeVisible();
      }
      await expect(page.getByRole('button', { name: /Add employee/ })).toBeVisible();
    });

    test('attendance monitor lists every employee [AC-ATT-011]', async ({ page }) => {
      await page.goto('/attendance/monitor');
      await expect(page.getByRole('heading', { name: 'Attendance' }).first()).toBeVisible();
      // Scope to the table: the first text match is an <option> in the Employee filter (hidden).
      await expect(page.getByRole('row').filter({ hasText: 'Karim Saleh' }).first()).toBeVisible();
      await expect(page.getByText('Checked in now').first()).toBeVisible();
    });

    test('calling assignments show assigned businesses [AC-CALL-ASSIGN]', async ({ page }) => {
      await page.goto('/calling-assignments');
      await expect(page.getByRole('heading', { name: 'Calling assignments' })).toBeVisible();
      await expect(page.getByText('Cedar Print House').first()).toBeVisible();
      await expect(page.getByText('Nova Dental Clinic').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeVisible();
    });

    test('reports export asks for a step-up code, then starts a download [AC-EXP]', async ({ page }) => {
      test.setTimeout(90_000);
      const secret = process.env.E2E_OWNER_TOTP_SECRET!;
      const codeFile = path.join(__dirname, '../../.auth/owner-code.txt');
      const used = fs.existsSync(codeFile) ? fs.readFileSync(codeFile, 'utf8') : '';
      await page.goto('/reports');
      await expect(page.getByRole('heading', { name: /Reports/ })).toBeVisible();
      await page.getByRole('button', { name: /Download/ }).first().click();
      // Export is a step-up action (EX-2): the dialog asks for a fresh authenticator code.
      const dialog = page.getByRole('dialog', { name: /Confirm the export/ });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Verify and download' })).toBeDisabled();
      await expect.poll(() => authenticator.generate(secret), { timeout: 40_000 }).not.toBe(used);
      await dialog.getByLabel('Verification code').fill(authenticator.generate(secret));
      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
      await dialog.getByRole('button', { name: 'Verify and download' }).click();
      const dl = await downloadPromise;
      expect(dl.suggestedFilename()).toMatch(/\.(csv|json|xlsx|pdf)$/i);
    });

    test('settings page loads with attendance policies [AC-SET]', async ({ page }) => {
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      // Working hours tab (default): the shift fields carry their visible labels.
      await expect(page.getByRole('tab', { name: 'Working Hours & Shifts' })).toBeVisible();
      await expect(page.getByLabel('Shift start (24h)')).toBeVisible();
      await expect(page.getByLabel('Shift end (24h)')).toBeVisible();
    });
  });
});
