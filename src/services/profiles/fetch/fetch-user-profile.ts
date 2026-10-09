import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/api/profile";
import { SupabaseProfile } from "../types";

/**
 * Fetches the signed-in user's profile from the API. Returns null when nobody is signed in.
 */
export const fetchUserProfile = async (): Promise<(SupabaseProfile & { images: string[] }) | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return null;
  }

  const profile = await getMyProfile();
  return {
    id: profile.id,
    name: profile.name ?? '',
    // The email address is held by the auth provider, not the profiles table.
    email: session.user.email ?? undefined,
    display_name: profile.display_name ?? undefined,
    age: profile.age ?? 0,
    location: profile.location ?? '',
    bio: profile.bio ?? '',
    verified: profile.verified,
    dob: profile.dob ?? undefined,
    gender: profile.gender ?? undefined,
    gender_preference: profile.gender_preference ?? 'both',
    relationship_goal: profile.relationship_goal ?? 'both',
    show_age: profile.show_age,
    interests: profile.interests,
    streak_count: profile.streak_count,
    email_verified: profile.email_verified,
    height_cm: profile.height_cm ?? undefined,
    occupation: profile.occupation ?? undefined,
    education: profile.education ?? undefined,
    city: profile.city ?? undefined,
    country: profile.country ?? undefined,
    onboarding_completed: profile.onboarding_completed,
    images: profile.images.filter((img) => img.is_visible).map((img) => img.url),
  };
};
