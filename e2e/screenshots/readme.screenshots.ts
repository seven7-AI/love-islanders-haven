import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Seed accounts from backend/seed (docs/development/seed-data.md).
const PASSWORD = process.env.SEED_PASSWORD ?? 'LoveIsland-Seed-2026!';
const OUT = fileURLToPath(new URL('../../docs/images/screenshots/', import.meta.url));

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
}

async function shoot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 80 });
}

async function signIn(page: Page, who: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${who}@seed.loveislander.test`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test('login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await shoot(page, 'login');
});

test('discover, matches, chat, profile, streaks and safety as Amani', async ({ page }) => {
  await signIn(page, 'amani');
  await expect(page).toHaveURL(/\/discover/);
  await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible();
  await shoot(page, 'discover');

  await page.getByRole('button', { name: 'More information' }).click();
  await expect(page.getByText('Interests').first()).toBeVisible();
  await shoot(page, 'discover-details');

  await page.goto('/matches');
  await expect(page.getByRole('button', { name: 'Message Brian' })).toBeVisible();
  await shoot(page, 'matches');

  await page.getByRole('button', { name: 'Message Brian' }).click();
  await expect(page.getByText("Saturday works. You're on coffee duty ☕")).toBeVisible();
  // Scroll the message list (not the page) to the latest message, Brian's photo.
  await page.getByText("Saturday works. You're on coffee duty ☕").evaluate((node) => {
    let el: HTMLElement | null = node as HTMLElement;
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  });
  await shoot(page, 'chat');

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Amani' })).toBeVisible();
  await shoot(page, 'profile');

  await page.goto('/streaks');
  await expect(page.getByText('Day 12 of sunrise hikes 🌄')).toBeVisible();
  await shoot(page, 'streaks');

  await page.goto('/safety');
  await expect(page.getByText('Mum (Esther)').first()).toBeVisible({ timeout: 15_000 });
  await shoot(page, 'safety');
});

test('onboarding as Wanjiku (stopped at the photos step)', async ({ page }) => {
  await signIn(page, 'wanjiku');
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.locator('img').first()).toBeVisible();
  await shoot(page, 'onboarding');
});
