import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import App from './App';
import AppProviders from './AppProviders';
import { supabase } from '@/integrations/supabase/client';

// Renders the real route tree and providers (AppProviders, as in main.tsx); only the auth session and the HTTP API
// are substituted.
const auth = vi.hoisted(() => ({ signedIn: true }));
const getMyProfile = vi.fn();

vi.mock('@/context/auth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () =>
    auth.signedIn
      ? {
          isAuthenticated: true,
          loading: false,
          user: { id: 'me', email: 'me@example.com', email_confirmed_at: '2026-10-01T00:00:00Z' },
          signOut: vi.fn(),
        }
      : { isAuthenticated: false, loading: false, user: null, signOut: vi.fn() },
}));
vi.mock('@/lib/api/settings', () => ({
  getMySettings: () =>
    Promise.resolve({
      notifications_enabled: true,
      show_online_status: true,
      location_sharing: false,
      theme: 'dark',
      preferences: {},
    }),
  updateMySettings: vi.fn(),
}));
vi.mock('@/lib/api/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/profile')>()),
  getMyProfile: () => getMyProfile(),
  updateMyProfile: vi.fn(),
}));
vi.mock('@/lib/api/safety', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/safety')>()),
  fetchBlockedUsers: () => Promise.resolve([]),
}));

const onboardedProfile = {
  id: 'me',
  name: 'Me',
  onboarding_completed: true,
  age_range_min: 18,
  age_range_max: 35,
  distance_preference: 25,
  images: [],
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );

describe('App routes', () => {
  beforeEach(() => {
    auth.signedIn = true;
    getMyProfile.mockReset();
    getMyProfile.mockResolvedValue(onboardedProfile);
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'token', user: { id: 'me' } } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  });

  it('renders the settings page with the application providers', async () => {
    renderAt('/settings');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Save All Changes' })).toBeInTheDocument();
  });

  it('sends signed-out users to the login page', async () => {
    auth.signedIn = false;
    renderAt('/settings');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('sends users who have not finished onboarding to onboarding', async () => {
    getMyProfile.mockResolvedValue({ ...onboardedProfile, onboarding_completed: false });
    renderAt('/settings');
    expect(await screen.findByRole('heading', { name: "Let's get to know you" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows the not-found page for unknown paths', async () => {
    renderAt('/no-such-page');
    expect(await screen.findByText(/404/)).toBeInTheDocument();
  });
});
