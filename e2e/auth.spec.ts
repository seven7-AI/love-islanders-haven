import { expect, test } from './support/fixtures';
import { latestEmail, onboardedUser, PASSWORD } from './support/stack';
import { signInUI } from './support/ui';

const profile = { dob: '1992-03-03', gender: 'female', gender_preference: 'male' };

test('wrong password is refused with the reason', async ({ page, guard }) => {
  const user = await onboardedUser('wrongpw', { name: 'Wanda', ...profile });
  guard.allow(/console error: .*400/); // the browser logs Supabase's 400 for the refused sign-in
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('Invalid login credentials')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('a session survives a reload and ends at log out', async ({ page }) => {
  const user = await onboardedUser('session', { name: 'Sasha', ...profile });
  await signInUI(page, user.email);
  await expect(page).toHaveURL(/\/discover/);
  await page.reload();
  await expect(page).toHaveURL(/\/discover/);
  await expect(page.getByRole('heading', { name: 'Discover People' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login/); // signed out: private pages send you to sign in
});

test('reset a forgotten password from the emailed link', async ({ page }) => {
  const user = await onboardedUser('reset', { name: 'Rhea', ...profile });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText(`If an account exists for ${user.email}`);

  const html = await latestEmail(user.email);
  const link = html.match(/href="([^"]+\/auth\/v1\/verify[^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
  expect(link, 'reset link in the email').toBeTruthy();
  await page.goto(link!);
  await expect(page.getByRole('heading', { name: 'Choose a New Password' })).toBeVisible();
  const newPassword = 'a-brand-new-passphrase';
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Your password has been updated.')).toBeVisible();
  await expect(page).toHaveURL(/\/discover/);

  // The new password works in a new session; the old one no longer does.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signInUI(page, user.email, newPassword);
  await expect(page).toHaveURL(/\/discover/);
  const old = await fetch(
    `${process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: process.env.E2E_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: PASSWORD }),
    },
  );
  expect(old.status).toBe(400);
});
