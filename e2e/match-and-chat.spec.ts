import { expect, test } from './support/fixtures';
import { api, onboardedUser, PASSWORD } from './support/stack';

test('discover someone, match, exchange messages, see read receipts, and unmatch', async ({ page }) => {
  const cleoName = `Cleo${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
  for (let i = 0; i < 40; i++) {
    await expect(pass).toBeVisible();
    // Give each card time to render before deciding to pass it, or Cleo's card could be passed unseen.
    const isCleo = await cleoCard.waitFor({ timeout: 2_000 }).then(
      () => true,
      () => false,
    );
    if (isCleo) break;
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
  await expect(page.getByRole('img', { name: 'Sent' })).toBeVisible();

  // Cleo sees it through the API and replies; Dan's open chat picks the reply up by polling.
  const matches = await api<{ matches: { id: string }[] }>(cleo.token, '/v1/matches');
  const matchId = matches.matches[0].id;
  const history = await api<{ messages: { content: string }[] }>(cleo.token, `/v1/matches/${matchId}/messages`);
  expect(history.messages.map((m) => m.content)).toContain('Hi Cleo! Coffee this week?');
  await api(cleo.token, `/v1/matches/${matchId}/read`, { method: 'POST' });
  await api(cleo.token, `/v1/matches/${matchId}/messages`, { method: 'POST', body: { content: 'Yes! Saturday?' } });
  await expect(page.getByText('Yes! Saturday?')).toBeVisible({ timeout: 15_000 });
  // Cleo read Dan's message; his open chat shows it by polling.
  await expect(page.getByRole('img', { name: 'Read' })).toBeVisible({ timeout: 15_000 });

  // Dan ends the match: the chat closes, the match leaves his list, and Cleo can no longer message.
  await page.getByRole('button', { name: 'Chat options' }).click();
  await page.getByRole('menuitem', { name: 'Unmatch' }).click();
  await page.getByRole('button', { name: 'Unmatch' }).click();
  await expect(page.getByText(`You unmatched ${cleoName}`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Message ${cleoName}` })).toHaveCount(0);
  const after = await api<{ matches: unknown[] }>(cleo.token, '/v1/matches');
  expect(after.matches).toHaveLength(0);
});
