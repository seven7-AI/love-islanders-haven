import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDiscoverProfiles } from './useDiscoverProfiles';

const fetchDiscoverPage = vi.fn();
const swipe = vi.fn();
const getDiscoverFilters = vi.fn();
const saveDiscoverFilters = vi.fn();
const toast = vi.fn();

vi.mock('@/lib/api/discovery', () => ({
  fetchDiscoverPage: (...a: unknown[]) => fetchDiscoverPage(...a),
  swipe: (...a: unknown[]) => swipe(...a),
}));
vi.mock('@/services/profiles/profile-preferences', () => ({
  DEFAULT_DISCOVER_PREFERENCES: { minAge: 18, maxAge: 35, maxDistance: 50 },
  getDiscoverFilters: () => getDiscoverFilters(),
  saveDiscoverFilters: (f: unknown) => saveDiscoverFilters(f),
}));
vi.mock('@/context/auth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const profile = (id: string) => ({ id, name: id, images: [], interests: [] });

describe('useDiscoverProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDiscoverFilters.mockResolvedValue({ minAge: 25, maxAge: 40, maxDistance: 30, gender: 'female' });
  });

  it('loads the first page and the saved preferences', async () => {
    fetchDiscoverPage.mockResolvedValue({ profiles: [profile('a'), profile('b')], next_cursor: null });
    const { result } = renderHook(() => useDiscoverProfiles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentProfile?.id).toBe('a');
    await waitFor(() => expect(result.current.filters.minAge).toBe(25));
  });

  it('advances only after the server saved the swipe and returns the match result', async () => {
    fetchDiscoverPage.mockResolvedValue({ profiles: [profile('a'), profile('b')], next_cursor: null });
    swipe.mockResolvedValue({ matched: true, match_id: 'm1' });
    const { result } = renderHook(() => useDiscoverProfiles());
    await waitFor(() => expect(result.current.currentProfile?.id).toBe('a'));

    let swipeResult: unknown;
    await act(async () => {
      swipeResult = await result.current.handleSwipe('a', 'right');
    });
    expect(swipe).toHaveBeenCalledWith('a', 'right');
    expect(swipeResult).toEqual({ matched: true, match_id: 'm1' });
    expect(result.current.currentProfile?.id).toBe('b');
  });

  it('keeps the card and reports the error when the swipe fails', async () => {
    fetchDiscoverPage.mockResolvedValue({ profiles: [profile('a')], next_cursor: null });
    swipe.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useDiscoverProfiles());
    await waitFor(() => expect(result.current.currentProfile?.id).toBe('a'));

    await act(async () => {
      await result.current.handleSwipe('a', 'left');
    });
    expect(result.current.currentProfile?.id).toBe('a');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('loads the next page when the deck runs low', async () => {
    fetchDiscoverPage
      .mockResolvedValueOnce({ profiles: [profile('a')], next_cursor: 'c1' })
      .mockResolvedValueOnce({ profiles: [profile('b')], next_cursor: null });
    renderHook(() => useDiscoverProfiles());
    await waitFor(() => expect(fetchDiscoverPage).toHaveBeenCalledWith('c1'));
  });

  it('saves preferences to the profile and reloads the feed', async () => {
    fetchDiscoverPage.mockResolvedValue({ profiles: [], next_cursor: null });
    saveDiscoverFilters.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDiscoverProfiles());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const calls = fetchDiscoverPage.mock.calls.length;

    await act(async () => {
      await result.current.setFilters({ minAge: 30, maxAge: 50, maxDistance: 10 });
    });
    expect(saveDiscoverFilters).toHaveBeenCalledWith({ minAge: 30, maxAge: 50, maxDistance: 10 });
    expect(fetchDiscoverPage.mock.calls.length).toBeGreaterThan(calls);
  });
});
