import { expect, test } from './support/fixtures';
import { person } from './support/people';
import { api, PHOTO_PATH, postStreak } from './support/stack';
import { signInUI } from './support/ui';

test('post a streak with a caption, and like someone else’s', async ({ page }) => {
  const me = await person('Stella');
  const friend = await person('Farah');
  const theirCaption = `Morning run ${friend.name}`;
  await postStreak(friend.token, theirCaption);

  await signInUI(page, me.email);
  await page.goto('/streaks');
  await expect(page.getByRole('heading', { name: 'Streaks', exact: true })).toBeVisible();

  // Like a friend's post; the like is saved, so it is still there after a reload.
  const theirPost = page.locator('div.rounded-lg, [class*="card"]').filter({ hasText: theirCaption }).first();
  await theirPost.getByRole('button', { name: 'Like' }).click();
  await expect(theirPost.getByRole('button', { name: 'Unlike' })).toHaveText('1');
  await page.reload();
  await expect(
    page
      .locator('div.rounded-lg, [class*="card"]')
      .filter({ hasText: theirCaption })
      .first()
      .getByRole('button', { name: 'Unlike' }),
  ).toBeVisible();

  // Post my own streak with a caption.
  const caption = `Sunset at the lake ${me.name}`;
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles(PHOTO_PATH);
  await expect(page.getByText('1 of 5 photos')).toBeVisible();
  await page.getByLabel('Caption (optional)').fill(caption);
  await page.getByRole('button', { name: 'Post Streak' }).click();
  await expect(page.getByText('Posted!', { exact: true })).toBeVisible();
  await expect(page.getByText(caption)).toBeVisible();
  await expect(page.getByText('Posted today')).toBeVisible();

  await page.reload();
  await expect(page.getByText(caption)).toBeVisible();
  const status = await api<{ has_posted_today: boolean; streak_count: number }>(me.token, '/v1/streaks/me');
  expect(status).toEqual({ has_posted_today: true, streak_count: 1 });
});
