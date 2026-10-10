import { expect, test } from './support/fixtures';
import { person } from './support/people';
import { api } from './support/stack';
import { signInUI } from './support/ui';

test('change who Discover shows; the preference is saved', async ({ page }) => {
  const me = await person('Dora');
  await signInUI(page, me.email);
  await expect(page.getByRole('heading', { name: 'Discover People' })).toBeVisible();
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('dialog', { name: 'Discover Filters' })).toBeVisible();
  await page.getByRole('dialog').getByRole('radio', { name: 'Everyone' }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect
    .poll(async () => (await api<{ gender_preference: string }>(me.token, '/v1/me/profile')).gender_preference)
    .toBe('both');

  await page.reload();
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('dialog').getByRole('radio', { name: 'Everyone' })).toBeChecked();
});
