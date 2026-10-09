import type { ApiSettings, Preferences, SettingsUpdate } from '@/lib/api/settings';
import { defaultSettings } from './defaults';
import type { UserSettings } from './types';

/** Keys the API accepts inside each preferences group; anything else (e.g. retired toggles) is dropped. */
const PREFERENCE_KEYS = {
  accessibility_settings: ['textSize', 'highContrast', 'colorBlindness'],
  app_customization: ['autoTheme', 'language', 'soundEffects', 'hapticFeedback', 'animations'],
  ai_companion_settings: ['conversationStyle', 'voiceTone', 'allowProactiveMessages', 'messageFrequency'],
  match_preferences: ['distanceUnit'],
} as const satisfies Record<keyof Preferences, readonly string[]>;

const pick = <T extends object>(source: T | undefined, keys: readonly string[]): Partial<T> => {
  const result: Record<string, unknown> = {};
  if (!source) return result as Partial<T>;
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<T>;
};

/** Maps the API settings object to the UI shape, filling anything the user never set with defaults. */
export function fromApiSettings(api: ApiSettings): UserSettings {
  const prefs = api.preferences ?? {};
  return {
    privacy_settings: {
      show_online_status: api.show_online_status,
      location_sharing: api.location_sharing,
    },
    communication_settings: {
      notifications_enabled: api.notifications_enabled,
    },
    match_preferences: {
      ...defaultSettings.match_preferences,
      ...pick(prefs.match_preferences, PREFERENCE_KEYS.match_preferences),
    },
    ai_companion_settings: {
      ...defaultSettings.ai_companion_settings,
      ...pick(prefs.ai_companion_settings, PREFERENCE_KEYS.ai_companion_settings),
    },
    accessibility_settings: {
      ...defaultSettings.accessibility_settings,
      ...pick(prefs.accessibility_settings, PREFERENCE_KEYS.accessibility_settings),
    },
    app_customization: {
      ...defaultSettings.app_customization,
      ...pick(prefs.app_customization, PREFERENCE_KEYS.app_customization),
      theme: api.theme,
    },
  };
}

/** The PATCH body that stores one UI category. Preference groups are sent whole because the API replaces them. */
export function toApiPatch<K extends keyof UserSettings>(category: K, value: UserSettings[K]): SettingsUpdate {
  switch (category) {
    case 'privacy_settings': {
      const privacy = value as UserSettings['privacy_settings'];
      return pick({ show_online_status: privacy.show_online_status, location_sharing: privacy.location_sharing }, [
        'show_online_status',
        'location_sharing',
      ]);
    }
    case 'communication_settings': {
      const communication = value as UserSettings['communication_settings'];
      return pick({ notifications_enabled: communication.notifications_enabled }, ['notifications_enabled']);
    }
    case 'app_customization': {
      const app = value as UserSettings['app_customization'];
      return {
        ...pick({ theme: app.theme }, ['theme']),
        preferences: { app_customization: pick(app, PREFERENCE_KEYS.app_customization) },
      };
    }
    case 'accessibility_settings':
    case 'ai_companion_settings':
    case 'match_preferences':
      return {
        preferences: {
          [category]: pick(value as object, PREFERENCE_KEYS[category as keyof typeof PREFERENCE_KEYS]),
        },
      };
    default:
      return {};
  }
}

/** The PATCH body that stores every category at once. */
export function toApiSettings(settings: UserSettings): SettingsUpdate {
  const update: SettingsUpdate = { preferences: {} };
  for (const category of Object.keys(settings) as (keyof UserSettings)[]) {
    const { preferences, ...columns } = toApiPatch(category, settings[category]);
    Object.assign(update, columns);
    Object.assign(update.preferences!, preferences);
  }
  return update;
}
