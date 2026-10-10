import { expect, test } from './support/fixtures';
import { person } from './support/people';
import { api } from './support/stack';
import { signInUI } from './support/ui';

test('edit the display name and hide a photo; both are saved', async ({ page }) => {
  const me = await person('Paula');
  await signInUI(page, me.email);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Profile' })).toBeVisible();

  await page.getByRole('button', { name: 'Hide photo 2' }).click();
  await expect(page.getByRole('button', { name: 'Show photo 2' })).toBeVisible();

  await page.getByLabel('Display Name').fill('Polly');
  await page.getByRole('button', { name: 'Save Display Preferences' }).click();
  await expect(page.getByText('Profile updated').first()).toBeVisible();

  await page.reload();
  const saved = await api<{ display_name: string; images: { is_visible: boolean }[] }>(me.token, '/v1/me/profile');
  expect(saved.display_name).toBe('Polly');
  expect(saved.images.map((i) => i.is_visible)).toEqual([true, false, true, true]);
  // Others see the display name; the account name from onboarding is unchanged.
  await expect(page.getByRole('heading', { name: /^Polly/ })).toBeVisible();
  expect((await api<{ name: string }>(me.token, '/v1/me/profile')).name).toBe(me.name);
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('button', { name: 'Show photo 2' })).toBeVisible();
});

test('insights load for each period; calendar sync says it is not available', async ({ page }) => {
  const me = await person('Ines');
  await signInUI(page, me.email);
  await page.goto('/profile');
  await page.getByRole('tab', { name: 'Insights' }).click();
  await expect(page.getByText('Shown in Discover')).toBeVisible();
  for (const period of ['Week', 'Year', 'Month']) {
    await page.getByRole('radio', { name: period }).click();
    await expect(page.getByRole('radio', { name: period })).toBeChecked();
    await expect(page.getByText('Likes received')).toBeVisible();
  }

  // No Google OAuth client is configured in this stack; the app must say so rather than offer a broken button.
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await expect(page.getByText("Google Calendar sync isn't available yet.")).toBeVisible();
  await expect(page.getByText('No upcoming dates planned.')).toBeVisible();
});
