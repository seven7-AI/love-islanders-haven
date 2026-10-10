import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ANON_KEY, API_URL, MAILPIT_URL, SERVICE_ROLE_KEY, SUPABASE_URL } from './env';

export const PASSWORD = 'correct-horse-battery-staple';
export const PHOTO_PATH = new URL('./photo.png', import.meta.url).pathname;
const PHOTO = readFileSync(PHOTO_PATH);

const json = async (response: Response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.url}: ${text}`);
  return text ? JSON.parse(text) : null;
};

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

/** Creates a confirmed user through the Supabase Auth admin API (as an operator would), returning its id. */
export async function createConfirmedUser(email: string, name: string): Promise<string> {
  const user = await json(
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } }),
    }),
  );
  return user.id;
}

export async function signIn(email: string): Promise<string> {
  const session = await json(
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  return session.access_token;
}

export async function api<T = unknown>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  return json(
    await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

/** Uploads a photo through the API's signed-upload flow and adds it to the profile. */
export async function addPhoto(token: string) {
  const ticket = await api<{ upload_url: string; path: string }>(token, '/v1/me/images/uploads', {
    method: 'POST',
    body: { content_type: 'image/png', size_bytes: PHOTO.length },
  });
  await json(await fetch(ticket.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: PHOTO }));
  return api(token, '/v1/me/images', { method: 'POST', body: { path: ticket.path } });
}

/** A fully onboarded user, created and set up only through the real Auth service and the public API. */
export async function onboardedUser(label: string, profile: Record<string, unknown>) {
  const email = uniqueEmail(label);
  const id = await createConfirmedUser(email, String(profile.name));
  const token = await signIn(email);
  await api(token, '/v1/me/profile', { method: 'PATCH', body: profile });
  for (let i = 0; i < 4; i++) await addPhoto(token);
  await api(token, '/v1/me/onboarding', { method: 'PUT', body: { step: 'completed' } });
  return { id, email, token };
}

/** The newest email sent to `to`, as captured by the local mail catcher (Mailpit). */
export async function latestEmail(to: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await json(await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`));
    if (list.messages?.length) {
      const message = await json(await fetch(`${MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`));
      return message.HTML as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}

/**
 * Grants a role with the operator CLI (`python -m app.admin roles grant`), the only way roles are granted. Runs with
 * the API's environment, as an operator would: its database (DATABASE_URL, exported by scripts/e2e.sh) and Auth URL.
 */
export function grantRole(userId: string, role = 'moderator') {
  execFileSync(
    'uv',
    ['run', 'python', '-m', 'app.admin', 'roles', 'grant', '--user-id', userId, '--role', role, '--by', 'e2e'],
    {
      cwd: new URL('../../backend', import.meta.url).pathname,
      env: { ...process.env, SUPABASE_URL },
      stdio: 'pipe',
    },
  );
}

/** The HTTP status of an API request (for permission checks, where an error status is the expected answer). */
export async function apiStatus(token: string | null, path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  await response.body?.cancel();
  return response.status;
}

/** Posts a streak with one photo through the API's signed-upload flow. */
export async function postStreak(token: string, caption: string) {
  const ticket = await api<{ upload_url: string; path: string }>(token, '/v1/streaks/uploads', {
    method: 'POST',
    body: { content_type: 'image/png', size_bytes: PHOTO.length },
  });
  await json(await fetch(ticket.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: PHOTO }));
  return api<{ id: string }>(token, '/v1/streaks', {
    method: 'POST',
    body: { media_paths: [ticket.path], caption, duration_hours: 24 },
  });
}

/** Makes two users match (both like each other) and returns the match id. */
export async function makeMatch(a: { id: string; token: string }, b: { id: string; token: string }) {
  await api(a.token, '/v1/swipes', { method: 'POST', body: { target_id: b.id, direction: 'right' } });
  await api(b.token, '/v1/swipes', { method: 'POST', body: { target_id: a.id, direction: 'right' } });
  const page = await api<{ matches: { id: string; partner: { id: string } }[] }>(a.token, '/v1/matches?limit=50');
  return page.matches.find((m) => m.partner.id === b.id)!.id;
}
