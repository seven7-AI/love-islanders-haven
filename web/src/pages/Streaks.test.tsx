import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Streaks from './Streaks';

const fetchStreakFeed = vi.fn();
vi.mock('@/lib/api/streaks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/streaks')>()),
  fetchStreakFeed: (c?: string) => fetchStreakFeed(c),
  getStreakStatus: () => Promise.resolve({ has_posted_today: false, streak_count: 2 }),
  getLeaderboard: () => Promise.resolve([]),
}));
vi.mock('@/context/auth', () => ({ useAuth: () => ({ user: { id: 'me' }, isAuthenticated: true, signOut: vi.fn() }) }));
vi.mock('@/components/Navbar', () => ({ default: () => null }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <Streaks />
    </MemoryRouter>,
  );

describe('Streaks page', () => {
  beforeEach(() => fetchStreakFeed.mockReset());

  it('shows a load failure as an error, not as an empty feed, and retries', async () => {
    fetchStreakFeed.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValue({
      posts: [],
      next_cursor: null,
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.queryByText(/No streak posts yet/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No streak posts yet/i)).toBeInTheDocument();
  });
});
