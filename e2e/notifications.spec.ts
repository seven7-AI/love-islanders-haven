import { expect, test } from './support/fixtures';
import { person } from './support/people';
import { makeMatch } from './support/stack';
import { signInUI } from './support/ui';

test('a new match shows as a notification that can be marked read', async ({ page }) => {
  const me = await person('Nia');
  const other = await person('Noah', 'male');
  await makeMatch(other, me);

  await signInUI(page, me.email);
  await page.goto('/matches');
  const bell = page.getByRole('button', { name: /Notifications \(\d+ unread\)/ });
  await expect(bell).toHaveAccessibleName('Notifications (1 unread)');
  await bell.click();
  await expect(page.getByText(`You matched with ${other.name}!`)).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByRole('button', { name: /Notifications/ })).toHaveAccessibleName(
    /Notifications( \(0 unread\))?$/,
  );

  await page.reload();
  await expect(page.getByRole('button', { name: /Notifications/ })).toHaveAccessibleName(
    /Notifications( \(0 unread\))?$/,
  );
});
