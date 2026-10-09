import { expect, test } from '@playwright/test';
import { api, onboardedUser, PASSWORD } from './support/stack';

test('discover someone, match, and exchange messages', async ({ page }) => {
  const cleoName = `Cleo${Date.now().toString(36)}`;
  const cleo = await onboardedUser('cleo', {
    name: cleoName,
    dob: '1996-03-10',
    gender: 'female',
    gender_preference: 'male',
  });
  const dan = await onboardedUser('dan', {
    name: 'Dan',
    dob: '1993-07-21',
    gender: 'male',
    gender_preference: 'female',
  });
  // Cleo already likes Dan.
  await api(cleo.token, '/v1/swipes', { method: 'POST', body: { target_id: dan.id, direction: 'right' } });

  await page.goto('/login');
  await page.getByLabel('Email').fill(dan.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/discover/);

  // Other test users may also be in the feed: wait for each card, pass until Cleo's comes up.
  const pass = page.getByRole('button', { name: 'Pass' });
  const cleoCard = page.getByRole('heading', { name: new RegExp(`^${cleoName}\\b`) });
  for (let i = 0; i < 20; i++) {
    await expect(pass).toBeVisible();
    if (await cleoCard.isVisible()) break;
    await pass.click();
  }
  await expect(cleoCard).toBeVisible();
  // The card and the swipe bar both offer Like; use the swipe bar.
  await page.getByRole('button', { name: 'Like', exact: true }).last().click();
  await expect(page.getByText(`It's a match with ${cleoName}!`)).toBeVisible();

  await page.goto('/matches');
  await page.getByRole('button', { name: `Message ${cleoName}` }).click();
  await page.getByRole('textbox').fill('Hi Cleo! Coffee this week?');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Hi Cleo! Coffee this week?')).toBeVisible();

  // Cleo sees it through the API and replies; Dan's open chat picks the reply up by polling.
  const matches = await api<{ matches: { id: string }[] }>(cleo.token, '/v1/matches');
  const matchId = matches.matches[0].id;
  const history = await api<{ messages: { content: string }[] }>(cleo.token, `/v1/matches/${matchId}/messages`);
  expect(history.messages.map((m) => m.content)).toContain('Hi Cleo! Coffee this week?');
  await api(cleo.token, `/v1/matches/${matchId}/messages`, { method: 'POST', body: { content: 'Yes! Saturday?' } });
  await expect(page.getByText('Yes! Saturday?')).toBeVisible({ timeout: 15_000 });
});
