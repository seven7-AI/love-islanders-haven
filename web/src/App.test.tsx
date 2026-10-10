import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import App from './App';
import AppProviders from './AppProviders';
import { supabase } from '@/integrations/supabase/client';
import { resetRolesCache } from '@/hooks/use-roles';
import { toast } from '@/hooks/use-toast';

// Renders the real route tree and providers (AppProviders, as in main.tsx); only the auth session and the HTTP API
// are substituted.
const auth = vi.hoisted(() => ({ signedIn: true }));
const getMyProfile = vi.fn();
const getMe = vi.fn();
const listReports = vi.fn();

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
vi.mock('@/lib/api/moderation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/moderation')>()),
  getMe: () => getMe(),
  listReports: () => listReports(),
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
    resetRolesCache();
    getMe.mockResolvedValue({ id: 'me', onboarding_completed: true, roles: [] });
    listReports.mockResolvedValue({ reports: [], next_cursor: null });
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

  it('keeps the moderation page and its link from regular users', async () => {
    renderAt('/moderation');
    expect(await screen.findByText('Moderators only')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Moderation' })).not.toBeInTheDocument();
    expect(listReports).not.toHaveBeenCalled();
  });

  it('opens the moderation queue for a moderator without a dating profile', async () => {
    getMyProfile.mockResolvedValue({ ...onboardedProfile, onboarding_completed: false });
    getMe.mockResolvedValue({ id: 'me', onboarding_completed: false, roles: ['moderator'] });
    renderAt('/moderation');
    expect(await screen.findByText('No open reports.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Moderation' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', { name: "Let's get to know you" })).not.toBeInTheDocument();
  });

  it('sends a signed-in moderator without a dating profile from /login to the queue', async () => {
    getMyProfile.mockResolvedValue({ ...onboardedProfile, onboarding_completed: false });
    getMe.mockResolvedValue({ id: 'me', onboarding_completed: false, roles: ['moderator'] });
    renderAt('/login');
    expect(await screen.findByText('No open reports.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Let's get to know you" })).not.toBeInTheDocument();
  });

  it('sends a signed-in user who has not finished onboarding from / to onboarding', async () => {
    getMyProfile.mockResolvedValue({ ...onboardedProfile, onboarding_completed: false });
    getMe.mockResolvedValue({ id: 'me', onboarding_completed: false, roles: [] });
    renderAt('/');
    expect(await screen.findByRole('heading', { name: "Let's get to know you" })).toBeInTheDocument();
  });

  it('shows messages raised with useToast', async () => {
    renderAt('/settings');
    await screen.findByRole('heading', { name: 'Settings' });
    act(() => {
      toast({ title: 'Posted!', description: 'Your streak is now 3 days.' });
    });
    expect(await screen.findByText('Posted!')).toBeInTheDocument();
    expect(screen.getByText('Your streak is now 3 days.')).toBeInTheDocument();
  });

  it('keeps a private page mounted when the app re-renders', async () => {
    renderAt('/settings');
    await screen.findByRole('button', { name: 'Save All Changes' });
    // The onboarding guard inside the private route loads the profile when it mounts.
    await waitFor(() => expect(getMyProfile).toHaveBeenCalled());
    const loads = getMyProfile.mock.calls.length;
    act(() => {
      toast({ title: 'Something happened' }); // App subscribes to useToast, so this re-renders it
    });
    await screen.findByText('Something happened');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getMyProfile.mock.calls.length).toBe(loads);
  });

  it('shows the not-found page for unknown paths', async () => {
    renderAt('/no-such-page');
    expect(await screen.findByText(/404/)).toBeInTheDocument();
  });
});
