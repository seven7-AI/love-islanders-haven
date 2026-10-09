import { describe, expect, it } from 'vitest';
import type { ApiSettings } from '@/lib/api/settings';
import { defaultSettings } from './defaults';
import { fromApiSettings, toApiPatch, toApiSettings } from './mapping';
import type { UserSettings } from './types';

const api: ApiSettings = {
  notifications_enabled: false,
  show_online_status: true,
  location_sharing: true,
  theme: 'light',
  preferences: {
    accessibility_settings: { textSize: 120, highContrast: true, colorBlindness: 'tritanopia' },
    app_customization: { autoTheme: true, language: 'fr', soundEffects: false, hapticFeedback: true, animations: false },
    ai_companion_settings: { conversationStyle: 'flirty', voiceTone: 'soft', allowProactiveMessages: false, messageFrequency: 7 },
    match_preferences: { distanceUnit: 'mi' },
  },
};

describe('settings mapping', () => {
  it('maps the API settings to the UI shape', () => {
    const ui = fromApiSettings(api);
    expect(ui.communication_settings).toEqual({ notifications_enabled: false });
    expect(ui.privacy_settings).toEqual({ show_online_status: true, location_sharing: true });
    expect(ui.app_customization).toEqual({ theme: 'light', ...api.preferences.app_customization });
    expect(ui.accessibility_settings).toEqual(api.preferences.accessibility_settings);
    expect(ui.ai_companion_settings).toEqual(api.preferences.ai_companion_settings);
    expect(ui.match_preferences).toEqual({ distanceUnit: 'mi' });
  });

  it('round-trips UI -> API -> UI and API -> UI -> API without loss', () => {
    expect(toApiSettings(fromApiSettings(api))).toEqual(api);
    const ui = fromApiSettings(api);
    expect(fromApiSettings({ ...(toApiSettings(ui) as ApiSettings) })).toEqual(ui);
  });

  it('fills preferences the user never saved with defaults', () => {
    const ui = fromApiSettings({ ...api, preferences: {} });
    expect(ui.accessibility_settings).toEqual(defaultSettings.accessibility_settings);
    expect(ui.app_customization).toEqual({ ...defaultSettings.app_customization, theme: 'light' });
    expect(ui.match_preferences).toEqual(defaultSettings.match_preferences);
  });

  it('builds a PATCH for one category, sending the whole preference group', () => {
    expect(toApiPatch('communication_settings', { notifications_enabled: true })).toEqual({ notifications_enabled: true });
    expect(toApiPatch('app_customization', { theme: 'dark', language: 'de' })).toEqual({
      theme: 'dark',
      preferences: { app_customization: { language: 'de' } },
    });
    expect(toApiPatch('accessibility_settings', { textSize: 90, highContrast: false })).toEqual({
      preferences: { accessibility_settings: { textSize: 90, highContrast: false } },
    });
  });

  it('drops retired and unknown keys so the API never sees them', () => {
    const legacy = {
      textSize: 100,
      screenReader: true,
      voiceCommands: true,
    } as unknown as UserSettings['accessibility_settings'];
    expect(toApiPatch('accessibility_settings', legacy)).toEqual({ preferences: { accessibility_settings: { textSize: 100 } } });

    const privacy = { location_sharing: true, profileVisibility: 'matches' } as unknown as UserSettings['privacy_settings'];
    expect(toApiPatch('privacy_settings', privacy)).toEqual({ location_sharing: true });
  });
});
