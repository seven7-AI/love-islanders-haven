import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfileInsights from './ProfileInsights';

const fetchProfileInsights = vi.fn();
vi.mock('@/services/profiles/analytics', () => ({
  fetchProfileInsights: (range: string) => fetchProfileInsights(range),
}));
// recharts needs layout measurements jsdom does not provide.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const data = (likes: number) => ({
  stats: {
    timesShown: 40,
    likes,
    matches: 3,
    messagesSent: 12,
    averageResponseTime: null,
    responseRate: null,
    conversionRate: null,
  },
  demographics: { age: [], location: [] },
});

describe('ProfileInsights', () => {
  beforeEach(() => fetchProfileInsights.mockReset());

  it('loads the month by default and reloads when another period is chosen', async () => {
    fetchProfileInsights.mockImplementation((range: string) => Promise.resolve(data(range === 'week' ? 2 : 9)));
    render(<ProfileInsights />);
    expect(await screen.findByText('9')).toBeInTheDocument();
    expect(fetchProfileInsights).toHaveBeenCalledWith('month');

    fireEvent.click(screen.getByRole('radio', { name: 'Week' }));
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(fetchProfileInsights).toHaveBeenLastCalledWith('week');
    // The period selector does not switch the surrounding tabs away from the stats.
    expect(screen.getByText('Likes received')).toBeInTheDocument();
  });

  it('shows only API values (no fixed percentages)', async () => {
    fetchProfileInsights.mockResolvedValue(data(1));
    render(<ProfileInsights />);
    await screen.findByText('Likes received');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Engagement' }));
    expect(await screen.findByText('Messages sent')).toBeInTheDocument();
    expect(screen.queryByText('62%')).not.toBeInTheDocument();
    expect(screen.queryByText('23%')).not.toBeInTheDocument();
  });

  it('shows the error and retries', async () => {
    fetchProfileInsights.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValue(data(5));
    render(<ProfileInsights />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
  });
});
