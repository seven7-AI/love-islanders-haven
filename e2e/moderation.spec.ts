import { expect, test } from '@playwright/test';
import { api, createConfirmedUser, grantRole, onboardedUser, PASSWORD, signIn, uniqueEmail } from './support/stack';

test('a moderator reviews a report; regular users cannot reach the queue', async ({ page }) => {
  const suffix = Date.now().toString(36);
  const reporter = await onboardedUser('reporter', {
    name: `Rita${suffix}`,
    dob: '1995-02-02',
    gender: 'female',
    gender_preference: 'male',
  });
  const reported = await onboardedUser('reported', {
    name: `Rex${suffix}`,
    dob: '1994-04-04',
    gender: 'male',
    gender_preference: 'female',
  });
  await api(reporter.token, '/v1/reports', {
    method: 'POST',
    body: { user_id: reported.id, reason: 'spam', details: `Same link three times ${suffix}` },
  });

  // A staff account with no dating profile, granted the role with the operator CLI.
  const modEmail = uniqueEmail('moderator');
  const modId = await createConfirmedUser(modEmail, 'Moderator');
  await api(await signIn(modEmail), '/v1/me'); // first sign-in creates the profile
  grantRole(modId);

  // Regular users: no queue in the UI, and the API refuses.
  await expect(api(reporter.token, '/v1/moderation/reports')).rejects.toThrow(/^403/);
  await page.goto('/login');
  await page.getByLabel('Email').fill(reporter.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/discover/);
  await expect(page.getByRole('link', { name: 'Moderation' })).toHaveCount(0);
  await page.goto('/moderation');
  await expect(page.getByText('Moderators only')).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);

  // The moderator lands on the queue after signing in.
  await page.getByLabel('Email').fill(modEmail);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/moderation/);
  const item = page.getByRole('listitem').filter({ hasText: `Same link three times ${suffix}` });
  await expect(item).toContainText(`Rex${suffix}`);
  await expect(item).toContainText(`Rita${suffix}`);
  await item.getByRole('button', { name: 'Review' }).click();
  await page.getByLabel('Note (optional)').fill('Checked the messages; warned the user.');
  await page.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByText('Report marked resolved')).toBeVisible();
  await expect(item).toHaveCount(0);

  await page.getByRole('radio', { name: 'Resolved' }).click();
  await expect(item).toContainText('Resolved by Moderator');
  await expect(item).toContainText('Checked the messages; warned the user.');
});
