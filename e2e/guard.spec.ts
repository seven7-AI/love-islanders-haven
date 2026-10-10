import { expect, test } from './support/fixtures';

// Checks the guard itself (support/fixtures.ts). The failures are caused on purpose; test.fail() expects the guard
// to fail these tests. The 500 is a route fulfilled by the test, not the real API.
test.describe('error guard', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) =>
    test.skip(testInfo.project.name !== 'mobile', 'checked once, in the mobile project'),
  );

  test('fails a test on a console error', async ({ page }) => {
    test.fail();
    await page.goto('/login');
    await page.evaluate(() => console.error('deliberate console error'));
  });

  test('fails a test on an uncaught page error', async ({ page }) => {
    test.fail();
    await page.goto('/login');
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('deliberate page error');
      });
    });
    await page.waitForTimeout(200);
  });

  test('fails a test on a 5xx response', async ({ page, guard }) => {
    test.fail();
    guard.allow(/^console error/); // the browser also logs the failed request; only the 5xx must fail the test
    await page.route('**/guard-check', (route) => route.fulfill({ status: 503, body: 'down' }));
    await page.goto('/login');
    await page.evaluate(() => fetch('/guard-check').catch(() => null));
    await page.waitForTimeout(200);
  });

  test('lets a test allow a specific problem', async ({ page, guard }) => {
    guard.allow(/deliberate, allowed/);
    await page.goto('/login');
    await page.evaluate(() => console.error('deliberate, allowed'));
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});
