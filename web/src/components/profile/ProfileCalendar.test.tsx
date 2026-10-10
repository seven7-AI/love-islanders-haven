import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProfileCalendar from './ProfileCalendar';

const calendar = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));
vi.mock('@/hooks/use-profile-calendar', () => ({ useProfileCalendar: () => calendar.state }));

const base = () => ({
  upcomingDates: [{ id: '1', title: 'Coffee with Ben', date_time: '2099-01-01T10:00:00Z', source: 'app' }],
  pastDates: [],
  isLoading: false,
  error: null,
  retry: vi.fn(),
  isGoogleAuthorized: false,
  isGoogleAvailable: false,
  initiateGoogleAuth: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
});

describe('ProfileCalendar', () => {
  beforeEach(() => {
    calendar.state = base();
  });

  it('lists dates and says when Google Calendar is not available', () => {
    render(<ProfileCalendar />);
    expect(screen.getByText('Coffee with Ben')).toBeInTheDocument();
    expect(screen.getByText('No past dates yet.')).toBeInTheDocument();
    expect(screen.getByText(/isn't available yet/)).toBeInTheDocument();
  });

  it('shows the load error with a retry', () => {
    calendar.state = { ...base(), error: 'Could not load your dates' };
    render(<ProfileCalendar />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your dates');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(calendar.state.retry).toHaveBeenCalled();
  });

  it('offers to disconnect a connected Google Calendar', () => {
    calendar.state = { ...base(), isGoogleAuthorized: true, isGoogleAvailable: true };
    render(<ProfileCalendar />);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Google Calendar' }));
    expect(calendar.state.disconnectGoogleCalendar).toHaveBeenCalled();
  });
});
