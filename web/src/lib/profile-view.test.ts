import { describe, expect, it } from 'vitest';
import { fromOwnProfile, fromPublicProfile, relationshipGoalLabel } from './profile-view';
import type { OwnProfile } from '@/lib/api/profile';
import type { PublicProfile } from '@/lib/api/discovery';

const own = {
  id: 'me',
  name: 'Ava',
  display_name: null,
  bio: 'Hi',
  age: 29,
  show_age: false,
  verified: false,
  occupation: 'Nurse',
  education: null,
  location: null,
  city: 'Lisbon',
  country: 'Portugal',
  relationship_goal: 'long-term',
  height_cm: 170,
  pronouns: 'she/her',
  interests: ['surfing'],
  images: [
    { id: 'b', url: 'https://cdn/b.jpg', position: 1, is_visible: true },
    { id: 'h', url: 'https://cdn/hidden.jpg', position: 2, is_visible: false },
    { id: 'a', url: 'https://cdn/a.jpg', position: 0, is_visible: true },
  ],
} as unknown as OwnProfile;

describe('profile view mapping', () => {
  it('maps the own profile: visible photos in order, place name, show-age flag', () => {
    const view = fromOwnProfile(own);
    expect(view.images).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
    expect(view.location).toBe('Lisbon, Portugal');
    expect(view.showAge).toBe(false);
    expect(view.relationshipGoal).toBe('long-term');
    expect(view.heightCm).toBe(170);
  });

  it('prefers the display name', () => {
    expect(fromOwnProfile({ ...own, display_name: 'Avi' }).name).toBe('Avi');
  });

  it('maps a public profile; a hidden age arrives as null', () => {
    const view = fromPublicProfile({
      id: 'p',
      name: null,
      bio: null,
      age: null,
      gender: 'female',
      relationship_goal: 'casual',
      height_cm: null,
      occupation: null,
      education: null,
      city: null,
      country: 'Kenya',
      pronouns: null,
      interests: [],
      verified: true,
      images: [],
    } as PublicProfile);
    expect(view).toMatchObject({ name: 'Someone', age: null, showAge: false, location: 'Kenya', verified: true });
  });

  it('labels the relationship goals the API accepts and passes unknown legacy values through', () => {
    expect(relationshipGoalLabel('friendship')).toBe('New friends');
    expect(relationshipGoalLabel('legacy-value')).toBe('legacy-value');
    expect(relationshipGoalLabel(null)).toBeNull();
  });
});
