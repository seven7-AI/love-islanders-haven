import { expect, test } from './support/fixtures';
import { person } from './support/people';
import { signInUI } from './support/ui';

test('Isla says she is unavailable when no AI provider is configured', async ({ page, guard }) => {
  // This stack has no LLM_API_KEY: the API answers 503 ai_not_configured and nothing is stored.
  guard.allow(/503 POST .*\/v1\/companion\/messages/);
  guard.allow(/console error: Failed to load resource: .*503/);
  const me = await person('Ivy');
  await signInUI(page, me.email);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Isla' }).click();
  await expect(page.getByText(/Welcome to Isla/)).toBeVisible();
  const input = page.getByPlaceholder('Type a message...');
  await input.fill('Any first date ideas?');
  await input.press('Enter');
  await expect(page.getByText('Isla is not available right now. Please try again later.')).toBeVisible();
  await expect(page.getByText('Any first date ideas?')).toHaveCount(0); // not shown as if it had been sent
});
