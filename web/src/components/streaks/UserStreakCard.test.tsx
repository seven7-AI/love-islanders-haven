import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserStreakCard from './UserStreakCard';

describe('UserStreakCard', () => {
  it('uses the singular for a one-day streak', () => {
    const { rerender } = render(<UserStreakCard streakCount={1} hasPostedToday />);
    expect(screen.getByText('1 day')).toBeInTheDocument();
    rerender(<UserStreakCard streakCount={3} hasPostedToday />);
    expect(screen.getByText('3 days')).toBeInTheDocument();
  });
});
