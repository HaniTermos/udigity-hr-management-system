import { chromium, expect, type FullConfig } from '@playwright/test';
import { authenticator } from 'otplib';
import fs from 'fs';
import path from 'path';

/**
 * Signs the four role users in once and stores their sessions in e2e/.auth/<role>.json.
 * Secrets come from the shell only: E2E_PASSWORD (seed password) and E2E_OWNER_TOTP_SECRET (seed test secret).
 */
const USERS = {
  owner: 'rana.haddad@udigity.demo',
  dataEntry: 'karim.saleh@udigity.demo',
  callCenter: 'maya.khoury@udigity.demo',
  developer: 'lina.aoun@udigity.demo',
} as const;

export const AUTH_DIR = path.join(__dirname, '.auth');

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:3000';
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('E2E_PASSWORD is not set in the shell (see docs/implementation/qa/e2e-run.md)');
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  for (const [key, email] of Object.entries(USERS)) {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    if (key === 'owner') {
      const secret = process.env.E2E_OWNER_TOTP_SECRET;
      if (!secret) throw new Error('E2E_OWNER_TOTP_SECRET is not set in the shell');
      await expect(page).toHaveURL(/step=2fa/);
      const code = authenticator.generate(secret);
      fs.writeFileSync(path.join(AUTH_DIR, 'owner-code.txt'), code);
      await page.locator('input').first().fill(code);
      await page.getByRole('button', { name: /verify/i }).click();
      await expect(page).toHaveURL(/localhost:\d+\/$/);
    } else {
      await expect(page).toHaveURL(/my-day/);
    }
    await ctx.storageState({ path: path.join(AUTH_DIR, `${key}.json`) });
    await ctx.close();
  }
  await browser.close();
}
