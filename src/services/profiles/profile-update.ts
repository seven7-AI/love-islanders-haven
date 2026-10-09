import { updateMyProfile } from '@/lib/api/profile';
import { SupabaseProfile } from './types';
import { toast } from 'sonner';

/**
 * Updates the signed-in user's profile through the API. Unknown and server-managed fields are dropped before sending.
 */
export const updateUserProfile = async (profileData: Partial<SupabaseProfile>) => {
  try {
    const updated = await updateMyProfile(profileData as Record<string, unknown>);
    toast.success('Profile updated successfully');
    return updated;
  } catch (error) {
    console.error('Error updating profile:', error);
    toast.error(`Failed to update profile: ${error instanceof Error ? error.message : 'unknown error'}`);
    throw error;
  }
};

/**
 * Updates user display preferences (name, show_age, etc.)
 */
export const updateDisplayPreferences = async (name: string, showAge: boolean) => {
  try {
    console.log('Updating display preferences:', { name, showAge });

    const result = await updateUserProfile({
      name,
      show_age: showAge,
    });

    toast.success('Display preferences updated successfully');
    return result;
  } catch (error) {
    console.error('Error updating display preferences:', error);
    toast.error('Failed to update display preferences');
    throw error;
  }
};

/**
 * Updates user relationship preferences
 */
export const updateRelationshipPreferences = async (
  relationshipGoal: 'long-term' | 'casual' | 'both',
  genderPreference: 'male' | 'female' | 'both',
) => {
  try {
    const result = await updateUserProfile({
      relationship_goal: relationshipGoal,
      gender_preference: genderPreference,
    });

    toast.success('Relationship preferences updated successfully');
    return result;
  } catch (error) {
    console.error('Error updating relationship preferences:', error);
    toast.error('Failed to update relationship preferences');
    throw error;
  }
};

/**
 * Updates user bio
 */
export const updateUserBio = async (bio: string) => {
  try {
    const result = await updateUserProfile({ bio });
    toast.success('Bio updated successfully');

    return result;
  } catch (error) {
    console.error('Error updating bio:', error);
    toast.error('Failed to update bio');
    throw error;
  }
};
