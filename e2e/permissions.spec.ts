import { expect, test } from './support/fixtures';
import { api, apiStatus, createConfirmedUser, onboardedUser, signIn, uniqueEmail } from './support/stack';
import { signInUI } from './support/ui';

// Cross-user access against the real API: each user's data is reachable only by them (or, for a match, by both
// people in it). "Not found" answers are deliberate: they do not reveal whether the item exists.
test('users cannot reach each other’s photos, chats, contacts or plans', async () => {
  const female = { dob: '1995-01-01', gender: 'female', gender_preference: 'male' };
  const male = { dob: '1993-01-01', gender: 'male', gender_preference: 'female' };
  const ana = await onboardedUser('ana', { name: 'Ana', ...female });
  const ben = await onboardedUser('ben', { name: 'Ben', ...male });
  const eve = await onboardedUser('eve', { name: 'Eve', ...female });

  // Ana and Ben match and talk; Eve is an outsider.
  await api(ana.token, '/v1/swipes', { method: 'POST', body: { target_id: ben.id, direction: 'right' } });
  await api(ben.token, '/v1/swipes', { method: 'POST', body: { target_id: ana.id, direction: 'right' } });
  const [match] = (await api<{ matches: { id: string }[] }>(ana.token, '/v1/matches')).matches;
  await api(ana.token, `/v1/matches/${match.id}/messages`, { method: 'POST', body: { content: 'Hi Ben' } });

  expect(await apiStatus(eve.token, `/v1/matches/${match.id}/messages`)).toBe(404);
  expect(
    await apiStatus(eve.token, `/v1/matches/${match.id}/messages`, { method: 'POST', body: { content: 'x' } }),
  ).toBe(404);
  expect(await apiStatus(eve.token, `/v1/matches/${match.id}`, { method: 'DELETE' })).toBe(404);

  const anaPhoto = (await api<{ images: { id: string }[] }>(ana.token, '/v1/me/profile')).images[0];
  expect(await apiStatus(eve.token, `/v1/me/images/${anaPhoto.id}`, { method: 'DELETE' })).toBe(404);
  expect(
    await apiStatus(eve.token, `/v1/me/images/${anaPhoto.id}`, { method: 'PATCH', body: { is_visible: false } }),
  ).toBe(404);
  expect((await api<{ images: unknown[] }>(ana.token, '/v1/me/profile')).images).toHaveLength(4);

  const contact = await api<{ id: string }>(ana.token, '/v1/safety-contacts', {
    method: 'POST',
    body: { name: 'Mum', phone: '+254 700 000 000' },
  });
  expect(await api<unknown[]>(eve.token, '/v1/safety-contacts')).toEqual([]);
  expect(
    await apiStatus(eve.token, `/v1/safety-contacts/${contact.id}`, { method: 'PATCH', body: { name: 'x' } }),
  ).toBe(404);
  expect(await apiStatus(eve.token, `/v1/safety-contacts/${contact.id}`, { method: 'DELETE' })).toBe(404);

  const plan = await api<{ id: string }>(ana.token, '/v1/date-plans', {
    method: 'POST',
    body: { title: 'Coffee', location: 'Java House', date_time: new Date(Date.now() + 86_400_000).toISOString() },
  });
  expect(await api<unknown[]>(eve.token, '/v1/date-plans')).toEqual([]);
  expect(await apiStatus(eve.token, `/v1/date-plans/${plan.id}`, { method: 'DELETE' })).toBe(404);

  // Profiles that have not finished onboarding are not visible to others.
  const newEmail = uniqueEmail('unfinished');
  const unfinishedId = await createConfirmedUser(newEmail, 'Unfinished');
  await api(await signIn(newEmail), '/v1/me');
  expect(await apiStatus(eve.token, `/v1/profiles/${unfinishedId}`)).toBe(404);
  expect(await apiStatus(eve.token, `/v1/profiles/${ana.id}`)).toBe(200);
});

test('the API requires a valid session and moderation requires the role', async () => {
  expect(await apiStatus(null, '/v1/me')).toBe(401);
  expect(await apiStatus('not-a-token', '/v1/me')).toBe(401);
  const user = await onboardedUser('regular', {
    name: 'Reg',
    dob: '1990-01-01',
    gender: 'male',
    gender_preference: 'female',
  });
  expect(await apiStatus(user.token, '/v1/moderation/reports')).toBe(403);
});

test('unknown pages show the not-found page', async ({ page }) => {
  const user = await onboardedUser('lost', {
    name: 'Lost',
    dob: '1990-01-01',
    gender: 'male',
    gender_preference: 'female',
  });
  await signInUI(page, user.email);
  await page.goto('/no-such-page');
  await expect(page.getByText('404')).toBeVisible();
});
