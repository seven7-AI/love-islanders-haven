import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProfileCard from './ProfileCard';
import type { ProfileView } from '@/lib/profile-view';

const profile: ProfileView = {
  id: 'p',
  name: 'Sam',
  age: 28,
  showAge: true,
  bio: 'Architect',
  verified: false,
  occupation: 'Architect',
  education: null,
  location: 'Nairobi, Kenya',
  relationshipGoal: 'long-term',
  heightCm: 181,
  pronouns: null,
  interests: ['Art'],
  images: ['https://cdn.test/sam.jpg'],
};

describe('ProfileCard', () => {
  it('shows the details panel instead of (not on top of) the card summary', () => {
    render(<ProfileCard profile={profile} onSwipe={vi.fn()} />);
    expect(screen.getAllByText('Nairobi, Kenya')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'More information' }));
    expect(screen.getAllByText('Nairobi, Kenya')).toHaveLength(1);
    expect(screen.getByText('Long-term relationship')).toBeInTheDocument();
  });
});
