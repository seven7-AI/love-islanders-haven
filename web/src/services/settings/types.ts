import type {
  AccessibilityPreferences,
  AICompanionPreferences,
  AppCustomizationPreferences,
  MatchDisplayPreferences,
  ThemePreference,
} from '@/lib/api/settings';

// UI shape of the user's settings. Persisted through GET/PATCH /v1/me/settings (see ./mapping.ts).

export interface PrivacySettings {
  show_online_status?: boolean;
  location_sharing?: boolean;
}

/**
 * Display preferences only. Age range and distance are profile fields (see services/profiles/profile-preferences).
 */
export type MatchPreferences = MatchDisplayPreferences;

export interface CommunicationSettings {
  notifications_enabled?: boolean;
}

export type AICompanionSettings = AICompanionPreferences;

export type AccessibilitySettings = AccessibilityPreferences;

export interface AppCustomization extends AppCustomizationPreferences {
  theme?: ThemePreference;
}

export interface UserSettings {
  privacy_settings: PrivacySettings;
  match_preferences: MatchPreferences;
  communication_settings: CommunicationSettings;
  ai_companion_settings: AICompanionSettings;
  accessibility_settings: AccessibilitySettings;
  app_customization: AppCustomization;
}
