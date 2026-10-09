import { apiFetch } from './client';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface AccessibilityPreferences {
  /** Percentage of the default text size (80-150). */
  textSize?: number;
  highContrast?: boolean;
  colorBlindness?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface AppCustomizationPreferences {
  autoTheme?: boolean;
  language?: string;
  soundEffects?: boolean;
  hapticFeedback?: boolean;
  animations?: boolean;
}

export interface AICompanionPreferences {
  conversationStyle?: 'playful' | 'caring' | 'thoughtful' | 'flirty';
  voiceTone?: 'warm' | 'soft' | 'confident' | 'soothing';
  allowProactiveMessages?: boolean;
  /** 0-10 */
  messageFrequency?: number;
}

export interface MatchDisplayPreferences {
  distanceUnit?: 'km' | 'mi';
}

/** Free-form preference groups. A group sent in a PATCH replaces the stored group. */
export interface Preferences {
  accessibility_settings?: AccessibilityPreferences;
  app_customization?: AppCustomizationPreferences;
  ai_companion_settings?: AICompanionPreferences;
  match_preferences?: MatchDisplayPreferences;
}

export interface ApiSettings {
  notifications_enabled: boolean;
  show_online_status: boolean;
  location_sharing: boolean;
  theme: ThemePreference;
  preferences: Preferences;
}

export type SettingsUpdate = Partial<ApiSettings>;

export const getMySettings = () => apiFetch<ApiSettings>('/v1/me/settings');

export const updateMySettings = (update: SettingsUpdate) =>
  apiFetch<ApiSettings>('/v1/me/settings', { method: 'PATCH', body: update });
