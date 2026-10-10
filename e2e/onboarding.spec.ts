import { expect, test, type Page } from './support/fixtures';
import { api, createConfirmedUser, PHOTO_PATH, signIn, uniqueEmail } from './support/stack';
import { signInUI } from './support/ui';

const pick = async (page: Page, combobox: string, option: string) => {
  await page.getByRole('combobox', { name: combobox }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};

test('complete onboarding through every step; progress and answers persist', async ({ page }) => {
  const email = uniqueEmail('onboard');
  await createConfirmedUser(email, 'Zara');
  await signInUI(page, email);
  await expect(page).toHaveURL(/\/onboarding/);

  // Basics
  await expect(page.getByRole('heading', { name: "Let's get to know you" })).toBeVisible();
  await page.getByLabel("What's your name?").fill('Zara');
  await pick(page, 'Month', 'March');
  await pick(page, 'Day', '14');
  await pick(page, 'Year', '1996');
  await page.getByRole('radio', { name: 'Female' }).check();
  await page.getByRole('radio', { name: 'Men' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Photos; then a reload resumes at this step with the photos kept.
  await expect(page.getByText('Add Your Photos')).toBeVisible();
  for (let i = 1; i <= 4; i++) {
    await page.getByLabel('Add photo').setInputFiles(PHOTO_PATH);
    await expect(page.getByAltText(`Profile ${i}`)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText('Add Your Photos')).toBeVisible();
  await expect(page.getByAltText('Profile 4')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Interests
  await expect(page.getByRole('heading', { name: 'Your Interests' })).toBeVisible();
  for (const interest of ['Hiking', 'Yoga', 'Dancing'])
    await page.getByRole('button', { name: interest, exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Lifestyle
  await expect(page.getByRole('heading', { name: 'Lifestyle' })).toBeVisible();
  await page.getByLabel('What do you do?').fill('Architect');
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await page.getByRole('button', { name: 'Frequently', exact: true }).click();
  await page.getByRole('button', { name: 'Regularly', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Personality
  await expect(page.getByRole('heading', { name: 'About You' })).toBeVisible();
  await page.getByLabel('About me').fill('I design homes by day and dance salsa by night.');
  await page.getByRole('button', { name: /Long-term/ }).click();
  await page.getByRole('button', { name: /Texting/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Preferences and completion
  await expect(page.getByRole('heading', { name: 'Your Preferences' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Profile' }).click();
  await expect(page.getByRole('heading', { name: "You're All Set!" })).toBeVisible();
  await expect(page).toHaveURL(/\/discover/, { timeout: 15_000 });

  // Everything was saved by the API, and a new session goes straight to Discover.
  const saved = await api<Record<string, unknown>>(await signIn(email), '/v1/me/profile');
  expect(saved).toMatchObject({
    name: 'Zara',
    dob: '1996-03-14',
    gender: 'female',
    gender_preference: 'male',
    occupation: 'Architect',
    relationship_goal: 'long-term',
    onboarding_completed: true,
  });
  expect(saved.interests).toEqual(expect.arrayContaining(['Hiking', 'Yoga', 'Dancing']));
  expect(saved.images).toHaveLength(4);
  await page.reload();
  await expect(page).toHaveURL(/\/discover/);
});
