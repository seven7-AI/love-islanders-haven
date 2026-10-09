import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '@/lib/api/client';
import { SettingsProvider } from '@/context/SettingsContext';
import Settings from './Settings';

const getMySettings = vi.fn();
const updateMySettings = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/api/settings', () => ({
  getMySettings: () => getMySettings(),
  updateMySettings: (u: unknown) => updateMySettings(u),
}));
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));
vi.mock('@/context/auth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'me', email: 'me@example.com' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
// The individual sections have their own API calls; this test is about the page-level save.
vi.mock('@/components/settings/AccountSettings', () => ({ default: () => null }));
vi.mock('@/components/settings/PrivacySettings', () => ({ default: () => null }));
vi.mock('@/components/settings/MatchPreferences', () => ({ default: () => null }));
vi.mock('@/components/settings/CommunicationSettings', () => ({ default: () => null }));
vi.mock('@/components/settings/AICompanionSettings', () => ({ default: () => null }));
vi.mock('@/components/settings/AccessibilitySettings', () => ({ default: () => null }));
vi.mock('@/components/settings/SecuritySettings', () => ({ default: () => null }));
vi.mock('@/components/settings/AppCustomization', () => ({ default: () => null }));
vi.mock('@/components/settings/FeedbackSupport', () => ({ default: () => null }));
vi.mock('@/components/Navbar', () => ({ default: () => null }));

const apiSettings = {
  notifications_enabled: true,
  show_online_status: true,
  location_sharing: false,
  theme: 'dark',
  preferences: {},
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <SettingsProvider>
        <Settings />
      </SettingsProvider>
    </MemoryRouter>,
  );

describe('Settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMySettings.mockResolvedValue(apiSettings);
  });

  it('reports the API error and no success when saving fails', async () => {
    updateMySettings.mockRejectedValue(new ApiError(422, 'preferences.accessibility_settings.textSize: too large'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Save All Changes' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('preferences.accessibility_settings.textSize: too large'));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('confirms the save only after the API accepted it', async () => {
    updateMySettings.mockResolvedValue(apiSettings);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Save All Changes' }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Settings saved'));
    expect(updateMySettings).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark', notifications_enabled: true }));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows the load error instead of default settings when loading fails', async () => {
    getMySettings.mockRejectedValue(new ApiError(500, 'Server unavailable'));
    renderPage();
    expect(await screen.findByText('Server unavailable')).toBeInTheDocument();
  });
});
