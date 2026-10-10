import { expect, test } from './support/fixtures';
import { api, createConfirmedUser, PASSWORD, PHOTO_PATH, signIn, uniqueEmail } from './support/stack';

test('upload profile photos during onboarding (real Storage via API-signed uploads)', async ({ page }) => {
  const email = uniqueEmail('photos');
  await createConfirmedUser(email, 'Ben');
  const token = await signIn(email);
  await api(token, '/v1/me/profile', {
    method: 'PATCH',
    body: { dob: '1994-05-01', gender: 'male', gender_preference: 'female' },
  });
  await api(token, '/v1/me/onboarding', { method: 'PUT', body: { step: 'photos' } });

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByText('Add Your Photos')).toBeVisible();

  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(continueButton).toBeDisabled();
  for (let i = 1; i <= 4; i++) {
    await page.getByLabel('Add photo').setInputFiles(PHOTO_PATH);
    await expect(page.getByAltText(`Profile ${i}`)).toBeVisible();
  }
  await expect(continueButton).toBeEnabled();

  // The photos are stored, not just shown: the API lists them and the files are served.
  const profile = await api<{ images: { url: string }[] }>(token, '/v1/me/profile');
  expect(profile.images).toHaveLength(4);
  const file = await fetch(profile.images[0].url);
  expect(file.status).toBe(200);
});
