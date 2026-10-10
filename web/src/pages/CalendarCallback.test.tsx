import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CalendarCallback from './CalendarCallback';

const completeGoogleCalendarAuth = vi.fn();
vi.mock('@/lib/api/calendar', () => ({
  completeGoogleCalendarAuth: (c: string, s: string) => completeGoogleCalendarAuth(c, s),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/calendar/callback" element={<CalendarCallback />} />
        <Route path="/profile" element={<p>profile page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('CalendarCallback', () => {
  it('hands the code and state to the API and returns to the app', async () => {
    completeGoogleCalendarAuth.mockResolvedValue({ connected: true, return_to: '/profile' });
    renderAt('/calendar/callback?code=abc&state=xyz');
    await waitFor(() => expect(screen.getByText('profile page')).toBeInTheDocument());
    expect(completeGoogleCalendarAuth).toHaveBeenCalledWith('abc', 'xyz');
  });

  it('reports a refused consent without calling the API', () => {
    completeGoogleCalendarAuth.mockClear();
    renderAt('/calendar/callback?error=access_denied');
    expect(screen.getByRole('alert')).toHaveTextContent('not connected');
    expect(completeGoogleCalendarAuth).not.toHaveBeenCalled();
  });

  it('shows the API error (e.g. a link started by another account)', async () => {
    completeGoogleCalendarAuth.mockRejectedValue(
      new Error('This Google sign-in link is invalid or expired; please try again.'),
    );
    renderAt('/calendar/callback?code=abc&state=forged');
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or expired');
  });
});
