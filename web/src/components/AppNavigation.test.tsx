import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppNavigation from './AppNavigation';

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock('@/context/auth', () => ({ useAuth: () => ({ signOut }) }));
const roles = vi.hoisted(() => ({ isModerator: false }));
vi.mock('@/hooks/use-roles', () => ({ useRoles: () => roles }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppNavigation />
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe('AppNavigation', () => {
  it('is the single main navigation and marks the current page', () => {
    renderAt('/streaks');
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Streaks' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Discover' })).not.toHaveAttribute('aria-current');
  });

  it('lists settings and safety for wide screens only', () => {
    renderAt('/discover');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveClass('hidden', 'md:flex');
    expect(screen.getByRole('link', { name: 'Safety' })).toHaveClass('hidden', 'md:flex');
  });

  it('shows Moderation only to moderators', () => {
    roles.isModerator = false;
    const { unmount } = renderAt('/discover');
    expect(screen.queryByRole('link', { name: 'Moderation' })).not.toBeInTheDocument();
    unmount();
    roles.isModerator = true;
    renderAt('/moderation');
    expect(screen.getByRole('link', { name: 'Moderation' })).toHaveAttribute('aria-current', 'page');
    roles.isModerator = false;
  });

  it('logs out and goes to the login page', async () => {
    renderAt('/profile');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
