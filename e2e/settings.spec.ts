import { expect, test, type Page } from './support/fixtures';
import { person } from './support/people';
import { api } from './support/stack';
import { signInUI } from './support/ui';

const openTab = (page: Page, name: string) => page.getByRole('tab', { name }).click();

test('a settings change is saved and survives a reload', async ({ page }) => {
  const me = await person('Selin');
  await signInUI(page, me.email);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await openTab(page, 'Preferences');
  const notifications = page.getByRole('switch', { name: 'Notifications' });
  await expect(notifications).toBeChecked();
  await notifications.click();
  await expect(notifications).not.toBeChecked();
  await expect
    .poll(
      async () => (await api<{ notifications_enabled: boolean }>(me.token, '/v1/me/settings')).notifications_enabled,
    )
    .toBe(false);

  await page.reload();
  await openTab(page, 'Preferences');
  await expect(page.getByRole('switch', { name: 'Notifications' })).not.toBeChecked();
});

test('unblock someone from the blocked users list', async ({ page }) => {
  const me = await person('Bella');
  const blocked = await person('Boris', 'male');
  await api(me.token, '/v1/blocks', { method: 'POST', body: { user_id: blocked.id } });
  await signInUI(page, me.email);
  await page.goto('/settings');
  await openTab(page, 'Account');
  const row = page
    .locator('div')
    .filter({ hasText: blocked.name })
    .filter({ has: page.getByRole('button', { name: 'Unblock' }) })
    .last();
  await row.getByRole('button', { name: 'Unblock' }).click();
  await expect(page.getByText(`${blocked.name} has been unblocked`)).toBeVisible();
  await expect(page.getByText("You haven't blocked any users.")).toBeVisible();
  expect(await api<unknown[]>(me.token, '/v1/blocks')).toEqual([]);
});

test('send feedback and find it in the feedback history', async ({ page }) => {
  const me = await person('Faye');
  await signInUI(page, me.email);
  await page.goto('/settings');
  // The feedback form is under Support on wide screens and under Advanced on phones.
  await expect(page.getByRole('tab', { name: 'Advanced' })).toBeVisible();
  const support = page.getByRole('tab', { name: 'Support' });
  await ((await support.isVisible()) ? support : page.getByRole('tab', { name: 'Advanced' })).click();
  const text = `The match list could show last active times (${me.name})`;
  await page.getByLabel('Category').click();
  await page.getByRole('option', { name: 'Bug Report' }).click();
  await page.getByLabel('Tell us what you think').fill(text);
  await page.getByRole('button', { name: 'Send Feedback' }).click();
  await expect(page.getByText('Thank you for your feedback!')).toBeVisible();

  await page.getByRole('button', { name: 'View Feedback' }).click();
  await expect(page.getByRole('heading', { name: 'Feedback History' })).toBeVisible();
  await expect(page.getByRole('cell', { name: text })).toBeVisible();
});
