import { expect, test } from './support/fixtures';
import { person } from './support/people';
import { api } from './support/stack';
import { signInUI } from './support/ui';

test('add a safety contact and plan a date; both are saved', async ({ page }) => {
  const me = await person('Sara');
  await signInUI(page, me.email);
  await page.goto('/safety');
  await expect(page.getByRole('heading', { name: 'Safety', exact: true, level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Add a safety contact' }).click();
  await page.getByLabel('Name').fill('Mum');
  await page.getByLabel('Phone number').fill('+254 712 345 678');
  await page.getByRole('button', { name: 'Save Contact' }).click();
  await expect(page.getByText('Mum has been added as a safety contact')).toBeVisible();

  await page.getByLabel("What's the plan?").fill('Coffee with Tom');
  await page.getByLabel('Meeting location').fill('Java House, Westlands');
  await page.getByRole('button', { name: 'Pick a date' }).click();
  await page.getByRole('button', { name: /next month/i }).click();
  await page.getByRole('gridcell', { name: '15' }).first().click();
  await page.getByLabel('Time').fill('18:30');
  await page.getByRole('button', { name: 'Save date plan' }).click();
  await expect(page.getByText('"Coffee with Tom" has been added to your date plans')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit Mum' })).toBeVisible();
  await expect(page.getByText('Coffee with Tom')).toBeVisible();
  const plans = await api<{ title: string; location: string }[]>(me.token, '/v1/date-plans');
  expect(plans).toEqual([expect.objectContaining({ title: 'Coffee with Tom', location: 'Java House, Westlands' })]);
});

test('an emergency alert says plainly that alerts are not set up', async ({ page, context, guard }) => {
  // No alert provider is configured in this stack: the API answers 503 alerts_not_configured, and the app must say
  // so instead of pretending the alert went out.
  guard.allow(/503 POST .*\/v1\/safety\/alerts/);
  guard.allow(/console error: Failed to load resource: .*503/);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -1.28, longitude: 36.82 });
  const me = await person('Amina');
  await api(me.token, '/v1/safety-contacts', { method: 'POST', body: { name: 'Dad', phone: '+254 700 111 222' } });
  await signInUI(page, me.email);
  await page.goto('/safety');
  await page.getByRole('button', { name: 'Emergency Alert' }).click();
  await page.getByRole('button', { name: 'Send Alert' }).click();
  const notice = page.getByRole('alert').filter({ hasText: "Emergency alerts aren't set up yet" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Your safety contacts have not received an alert from us.');
  await expect(notice.getByRole('link', { name: 'Call emergency services (112)' })).toBeVisible();
});
