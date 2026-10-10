import { expect, test as base } from '@playwright/test';

export interface Guard {
  /** Accepts problems matching `pattern` in this test (for failures the test causes on purpose). */
  allow: (pattern: RegExp) => void;
}

/**
 * The Playwright `test`, with a guard that fails any test whose pages logged a console error, threw an uncaught
 * error, or got a 5xx response, unless the test allowed that specific problem.
 */
export const test = base.extend<{ guard: Guard }>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      const allowed: RegExp[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 500) {
          problems.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
      });
      await use({ allow: (pattern) => allowed.push(pattern) });
      const unexpected = problems.filter((problem) => !allowed.some((pattern) => pattern.test(problem)));
      expect(unexpected, 'console errors, page errors or 5xx responses during the test').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from '@playwright/test';
