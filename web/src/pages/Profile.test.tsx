import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';

const getMyProfile = vi.fn();
vi.mock('@/lib/api/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/profile')>()),
  getMyProfile: () => getMyProfile(),
}));
vi.mock('@/context/auth', () => ({ useAuth: () => ({ user: { id: 'me' }, isAuthenticated: true, signOut: vi.fn() }) }));
vi.mock('@/components/profile/layout/ProfileTabs', () => ({
  default: ({ profile }: { profile: { name: string } }) => <p>Profile of {profile.name}</p>,
}));

describe('Profile page', () => {
  beforeEach(() => getMyProfile.mockReset());

  it('shows the load error with a retry instead of a made-up profile', async () => {
    getMyProfile.mockRejectedValueOnce(new Error('Network down')).mockResolvedValue({
      id: 'me',
      name: 'Ava',
      display_name: null,
      show_age: true,
      verified: false,
      interests: [],
      images: [],
    });
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Network down')).toBeInTheDocument();
    expect(screen.queryByText(/Profile of/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByText('Profile of Ava')).toBeInTheDocument();
  });
});
