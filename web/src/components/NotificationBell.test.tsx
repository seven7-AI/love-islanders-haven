import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const fetchNotifications = vi.fn();
const markNotificationsRead = vi.fn();
const markAllNotificationsRead = vi.fn();
vi.mock('@/lib/api/notifications', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchNotifications: () => fetchNotifications(),
  markNotificationsRead: (ids: string[]) => markNotificationsRead(ids),
  markAllNotificationsRead: () => markAllNotificationsRead(),
}));

const note = (id: string, type: string, is_read = false) => ({
  id,
  type,
  actor_id: 'u2',
  actor_name: 'Ben',
  actor_photo_url: null,
  match_id: 'm1',
  streak_id: null,
  is_read,
  created_at: '2026-10-09T10:00:00Z',
});

describe('NotificationBell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the unread count and readable descriptions', async () => {
    fetchNotifications.mockResolvedValue({
      notifications: [note('n1', 'match'), note('n2', 'message', true)],
      unread_count: 1,
      next_cursor: null,
    });
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    const bell = await screen.findByRole('button', { name: 'Notifications (1 unread)' });
    fireEvent.click(bell);
    expect(await screen.findByText('You matched with Ben!')).toBeInTheDocument();
    expect(screen.getByText('New message from Ben')).toBeInTheDocument();
  });

  it('marks everything read only after the server confirms', async () => {
    fetchNotifications.mockResolvedValue({ notifications: [note('n1', 'match')], unread_count: 1, next_cursor: null });
    markAllNotificationsRead.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ marked_read: 1 });
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    fireEvent.click(screen.getByRole('button', { name: /Mark all as read/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByRole('button', { name: 'Notifications (1 unread)' })).toBeInTheDocument();
  });

  it('shows an error instead of an empty list when loading fails', async () => {
    fetchNotifications.mockRejectedValue(new Error('Request failed (500)'));
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Request failed (500)'));
  });
});
