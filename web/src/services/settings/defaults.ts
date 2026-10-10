import { UserSettings } from './types';

export const defaultSettings: UserSettings = {
  privacy_settings: {
    show_online_status: true,
    location_sharing: false,
  },
  match_preferences: {
    distanceUnit: 'km',
  },
  communication_settings: {
    notifications_enabled: true,
  },
  ai_companion_settings: {
    conversationStyle: 'caring',
    voiceTone: 'warm',
    allowProactiveMessages: true,
    messageFrequency: 3,
  },
  accessibility_settings: {
    textSize: 100,
    highContrast: false,
    colorBlindness: 'none',
  },
  app_customization: {
    theme: 'system',
    autoTheme: false,
    language: 'en',
    soundEffects: true,
    hapticFeedback: true,
    animations: true,
  },
};
