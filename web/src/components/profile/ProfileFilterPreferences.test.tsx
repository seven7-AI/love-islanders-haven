import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfileFilterPreferences from './ProfileFilterPreferences';

const getDiscoverFilters = vi.fn();
const saveDiscoverFilters = vi.fn();
vi.mock('@/services/profiles/profile-preferences', () => ({
  DEFAULT_DISCOVER_PREFERENCES: { minAge: 18, maxAge: 35, maxDistance: 50 },
  getDiscoverFilters: () => getDiscoverFilters(),
  saveDiscoverFilters: (f: unknown) => saveDiscoverFilters(f),
}));
// useToast returns the module-level (stable) toast function, as the real hook does.
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

describe('ProfileFilterPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveDiscoverFilters.mockResolvedValue(undefined);
  });

  it('keeps the saved gender preference when saving age and distance', async () => {
    getDiscoverFilters.mockResolvedValue({ minAge: 25, maxAge: 40, maxDistance: 30, gender: 'female' });
    render(<ProfileFilterPreferences />);
    const save = await screen.findByRole('button', { name: 'Save Discovery Preferences' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() =>
      expect(saveDiscoverFilters).toHaveBeenCalledWith({ minAge: 25, maxAge: 40, maxDistance: 30, gender: 'female' }),
    );
  });

  it('cannot save defaults over preferences that failed to load', async () => {
    getDiscoverFilters.mockRejectedValue(new Error('offline'));
    render(<ProfileFilterPreferences />);
    const save = await screen.findByRole('button', { name: 'Save Discovery Preferences' });
    await waitFor(() => expect(getDiscoverFilters).toHaveBeenCalled());
    expect(save).toBeDisabled();
  });
});
