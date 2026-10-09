import { getMyProfile, updateMyProfile } from '@/lib/api/profile';

/** Who the user wants to see in Discover. Stored on the profile, so it applies on every device. */
export interface DiscoverPreferences {
  minAge: number;
  maxAge: number;
  maxDistance: number;
  gender?: 'male' | 'female';
}

export const DEFAULT_DISCOVER_PREFERENCES: DiscoverPreferences = { minAge: 18, maxAge: 35, maxDistance: 50 };

export const getDiscoverFilters = async (): Promise<DiscoverPreferences> => {
  const profile = await getMyProfile();
  const gender =
    profile.gender_preference === 'male' || profile.gender_preference === 'female'
      ? profile.gender_preference
      : undefined;
  return {
    minAge: profile.age_range_min ?? DEFAULT_DISCOVER_PREFERENCES.minAge,
    maxAge: profile.age_range_max ?? DEFAULT_DISCOVER_PREFERENCES.maxAge,
    maxDistance: profile.distance_preference ?? DEFAULT_DISCOVER_PREFERENCES.maxDistance,
    gender,
  };
};

export const saveDiscoverFilters = async (filters: DiscoverPreferences) => {
  await updateMyProfile({
    age_range_min: filters.minAge,
    age_range_max: filters.maxAge,
    distance_preference: filters.maxDistance,
    gender_preference: filters.gender ?? 'both',
  });
};
