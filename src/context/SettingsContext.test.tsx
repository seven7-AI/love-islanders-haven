import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import { SettingsProvider, useSettings } from './SettingsContext';

const getMySettings = vi.fn();
const updateMySettings = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/api/settings', () => ({
  getMySettings: () => getMySettings(),
  updateMySettings: (u: unknown) => updateMySettings(u),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }));
vi.mock('@/context/auth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'me' } }) }));

const apiSettings = {
  notifications_enabled: true,
  show_online_status: true,
  location_sharing: false,
  theme: 'system',
  preferences: { accessibility_settings: { textSize: 110 } },
};

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

describe('SettingsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMySettings.mockResolvedValue(apiSettings);
  });

  it('saves a category through PATCH and keeps what the server returned', async () => {
    updateMySettings.mockResolvedValue({ ...apiSettings, notifications_enabled: false });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings.accessibility_settings.textSize).toBe(110);

    let ok = false;
    await act(async () => {
      ok = await result.current.updateSettings('communication_settings', { notifications_enabled: false });
    });
    expect(ok).toBe(true);
    expect(updateMySettings).toHaveBeenCalledWith({ notifications_enabled: false });
    expect(result.current.settings.communication_settings.notifications_enabled).toBe(false);
  });

  it('restores the previous value and shows the API error when a save fails', async () => {
    updateMySettings.mockRejectedValue(new ApiError(422, 'Invalid value'));
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok = true;
    await act(async () => {
      ok = await result.current.updateSettings('communication_settings', { notifications_enabled: false });
    });
    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Invalid value');
    expect(result.current.settings.communication_settings.notifications_enabled).toBe(true);
  });
});
