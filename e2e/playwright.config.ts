import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a real local stack: the API on its own Postgres (schema from Alembic), the Supabase CLI for
 * Auth and Storage, and the web app. Start everything with `scripts/e2e.sh` (CI does the same); see docs/testing.md.
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
});
