import { updateMyProfile } from '@/lib/api/profile';

/**
 * Saves the name shown to others (`display_name`; the account name from onboarding is left as is) and whether the
 * age is shown. The caller reports success or failure to the user.
 */
export const updateDisplayPreferences = (displayName: string, showAge: boolean) =>
  updateMyProfile({ display_name: displayName.trim(), show_age: showAge });
