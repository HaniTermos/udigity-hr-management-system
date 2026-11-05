import { defineConfig, devices } from '@playwright/test';

/**
 * Udigity Management System — Playwright config (QA Lead).
 * Strategy: docs/implementation/qa/test-strategy.md. Criteria: docs/implementation/qa/acceptance.md.
 *
 * - Never reads .env files. Everything comes from the shell environment.
 * - E2E_BASE_URL   frontend origin (default http://localhost:3000). Local hosts only.
 * - E2E_START_SERVERS=1 lets Playwright start backend + frontend via the root `npm run dev`.
 * - E2E_PASSWORD   dev seed password (backend/src/db/seed.ts); login journeys skip when unset.
 * - E2E_JOURNEYS=1 enables the Phase 7 journey specs (modules are still mocked as of 2026-10-23).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const isCI = !!process.env.CI;

// Viewports match the Figma previews in docs/phase6/previews (desktop 1440x900, mobile 390x844).
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false, // shared seed data; keep runs deterministic
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'en-GB',
    timezoneId: 'Asia/Beirut', // placeholder company TZ (policy-defaults VAL-TZ, NEEDS VALUE)
  },
  projects: [
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP, colorScheme: 'light' },
    },
    {
      name: 'desktop-dark',
      // Navy dark-mode checks (AC-UI-002). The app also needs localStorage udigity-theme=dark; see helpers/theme.ts.
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP, colorScheme: 'dark' },
    },
    {
      name: 'mobile-light',
      use: {
        ...devices['Pixel 7'],
        viewport: MOBILE,
        isMobile: true,
        hasTouch: true,
        colorScheme: 'light',
      },
    },
  ],
  webServer: process.env.E2E_START_SERVERS
    ? {
        command: 'npm run dev',
        cwd: '..',
        url: baseURL + '/login',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
