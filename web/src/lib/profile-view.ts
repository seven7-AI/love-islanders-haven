import type { OwnProfile } from '@/lib/api/profile';
import type { PublicProfile } from '@/lib/api/discovery';

/** What profile screens display, built from the API's own-profile or public-profile shape. */
export interface ProfileView {
  id: string;
  name: string;
  age: number | null;
  showAge: boolean;
  bio: string;
  verified: boolean;
  occupation: string | null;
  education: string | null;
  location: string | null;
  relationshipGoal: string | null;
  heightCm: number | null;
  pronouns: string | null;
  interests: string[];
  /** Photo URLs in display order; only photos other people may see. */
  images: string[];
}

/** The relationship goals the API accepts (backend/app/schemas/profile.py RelationshipGoal). */
export const RELATIONSHIP_GOALS = [
  { value: 'long-term', label: 'Long-term relationship' },
  { value: 'casual', label: 'Something casual' },
  { value: 'friendship', label: 'New friends' },
  { value: 'both', label: 'Open to either' },
  { value: 'not-sure', label: 'Still figuring it out' },
] as const;

export const relationshipGoalLabel = (goal: string | null): string | null =>
  goal ? (RELATIONSHIP_GOALS.find((g) => g.value === goal)?.label ?? goal) : null;

const placeName = (city: string | null, country: string | null, fallback?: string | null) =>
  [city, country].filter(Boolean).join(', ') || fallback || null;

export function fromOwnProfile(profile: OwnProfile): ProfileView {
  return {
    id: profile.id,
    name: profile.display_name || profile.name || '',
    age: profile.age,
    showAge: profile.show_age,
    bio: profile.bio ?? '',
    verified: profile.verified,
    occupation: profile.occupation,
    education: profile.education,
    location: placeName(profile.city, profile.country, profile.location),
    relationshipGoal: profile.relationship_goal,
    heightCm: profile.height_cm,
    pronouns: profile.pronouns,
    interests: profile.interests ?? [],
    images: [...profile.images]
      .filter((img) => img.is_visible)
      .sort((a, b) => a.position - b.position)
      .map((img) => img.url),
  };
}

export function fromPublicProfile(profile: PublicProfile): ProfileView {
  return {
    id: profile.id,
    name: profile.name ?? 'Someone',
    // The API leaves age out (null) when the person hides it.
    age: profile.age,
    showAge: profile.age !== null,
    bio: profile.bio ?? '',
    verified: profile.verified,
    occupation: profile.occupation,
    education: profile.education,
    location: placeName(profile.city, profile.country),
    relationshipGoal: profile.relationship_goal,
    heightCm: profile.height_cm,
    pronouns: profile.pronouns,
    interests: profile.interests ?? [],
    images: profile.images,
  };
}
