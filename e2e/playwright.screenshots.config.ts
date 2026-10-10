import { defineConfig } from '@playwright/test';

/**
 * Captures the README screenshots (docs/images/screenshots) from the running app with the seed accounts.
 * Not part of the test suite. Run from the repository root: SEED=1 scripts/e2e.sh --config=playwright.screenshots.config.ts
 */
export default defineConfig({
  testDir: 'screenshots',
  testMatch: '**/*.screenshots.ts',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:8080',
    // A typical phone: 390×844 CSS pixels at 2× density.
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
  },
});
