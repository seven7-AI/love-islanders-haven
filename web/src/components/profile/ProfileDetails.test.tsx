import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfileDetails from './ProfileDetails';
import type { ProfileView } from '@/lib/profile-view';

const profile: ProfileView = {
  id: 'me',
  name: 'Ava',
  age: 29,
  showAge: false,
  bio: 'Surfer',
  verified: false,
  occupation: 'Nurse',
  education: null,
  location: 'Lisbon, Portugal',
  relationshipGoal: 'long-term',
  heightCm: 170,
  pronouns: null,
  interests: ['surfing', 'books'],
  images: [],
};

describe('ProfileDetails', () => {
  it('shows the fields the API provides, and notes a hidden age', () => {
    render(<ProfileDetails profile={profile} />);
    expect(screen.getByText('29 (hidden from others)')).toBeInTheDocument();
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument();
    expect(screen.getByText('170 cm')).toBeInTheDocument();
    expect(screen.getByText('Long-term relationship')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Interests' })).toHaveTextContent('surfingbooks');
  });
});
