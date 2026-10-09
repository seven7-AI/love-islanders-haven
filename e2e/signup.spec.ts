import { expect, test } from '@playwright/test';
import { latestEmail, uniqueEmail } from './support/stack';

test('sign up, confirm the email from the real confirmation message, and land in onboarding', async ({ page }) => {
  const email = uniqueEmail('signup');
  await page.goto('/signup');
  await page.getByLabel(/name/i).fill('Ava');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: /sign up|create account/i }).click();

  // Email confirmation is required, so the app asks the user to check their inbox.
  await expect(page).toHaveURL(/\/verify/);
  await expect(page.getByText(email)).toBeVisible();

  const html = await latestEmail(email);
  const link = html.match(/href="([^"]+\/auth\/v1\/verify[^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
  expect(link, 'confirmation link in the email').toBeTruthy();
  await page.goto(link!);

  // Supabase redirects to /auth/callback, the session is created, and the onboarding guard takes over.
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByLabel("What's your name?")).toHaveValue('Ava');
});
