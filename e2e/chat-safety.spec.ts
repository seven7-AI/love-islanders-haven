import { expect, test } from './support/fixtures';
import { person } from './support/people';
import { api, makeMatch } from './support/stack';
import { signInUI } from './support/ui';

test('report and block someone from the chat; the match closes for both', async ({ page }) => {
  const me = await person('Rosa');
  const other = await person('Rick', 'male');
  const matchId = await makeMatch(me, other);

  await signInUI(page, me.email);
  await page.goto('/matches');
  await page.getByRole('button', { name: `Message ${other.name}` }).click();
  await page.getByRole('button', { name: 'Chat options' }).click();
  await page.getByRole('menuitem', { name: 'Report' }).click();
  const dialog = page.getByRole('dialog', { name: `Report ${other.name}` });
  await dialog.getByLabel('Harassment or threats').check();
  await dialog.getByLabel('Details (optional)').fill('Rude messages after I said no.');
  await dialog.getByLabel(`Also block ${other.name}`).check();
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText(`Thanks. ${other.name} has been reported and blocked.`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Message ${other.name}` })).toHaveCount(0);

  // Saved on the server: the block is listed, and neither side can use the conversation any more.
  const blocks = await api<{ user_id: string }[]>(me.token, '/v1/blocks');
  expect(blocks.map((b) => b.user_id)).toContain(other.id);
  expect((await api<{ matches: unknown[] }>(other.token, '/v1/matches')).matches).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole('button', { name: `Message ${other.name}` })).toHaveCount(0);
  expect(matchId).toBeTruthy();
});

test('the profile info panel shows the details others filled in', async ({ page }) => {
  const viewer = await person('Vera');
  const shown = await person('Owen', 'male');
  await api(shown.token, '/v1/me/profile', {
    method: 'PATCH',
    body: { bio: 'Weekend climber and amateur chef.', interests: ['Climbing', 'Cooking', 'Jazz'], height_cm: 182 },
  });
  // Owen likes Vera first, so he is near the front of her feed.
  await api(shown.token, '/v1/swipes', { method: 'POST', body: { target_id: viewer.id, direction: 'right' } });

  await signInUI(page, viewer.email);
  const pass = page.getByRole('button', { name: 'Pass' });
  const card = page.getByRole('heading', { name: new RegExp(`^${shown.name}\\b`) });
  for (let i = 0; i < 40; i++) {
    await expect(pass).toBeVisible();
    if (
      await card.waitFor({ timeout: 2_000 }).then(
        () => true,
        () => false,
      )
    )
      break;
    await pass.click();
  }
  await page.getByRole('button', { name: 'More information' }).click();
  await expect(page.getByText('Weekend climber and amateur chef.')).toBeVisible();
  await expect(page.getByText('Jazz')).toBeVisible();
  await expect(page.getByText(/182/)).toBeVisible();
});
