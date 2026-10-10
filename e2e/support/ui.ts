import { expect, type Page } from '@playwright/test';
import { PASSWORD } from './stack';

/** Signs in through the real login form and waits until the app has left the login page. */
export async function signInUI(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Opens a page by URL, as a user following a link or reloading would. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`));
}
