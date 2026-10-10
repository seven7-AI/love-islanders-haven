import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { resetRolesCache, useRoles } from './use-roles';

const getMe = vi.fn();
const auth = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
vi.mock('@/lib/api/moderation', () => ({ getMe: () => getMe() }));
vi.mock('@/context/auth', () => ({ useAuth: () => auth }));

describe('useRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRolesCache();
    auth.user = { id: 'u1' };
  });

  it('reports the moderator role and shares one request', async () => {
    getMe.mockResolvedValue({ roles: ['moderator'] });
    const first = renderHook(() => useRoles());
    const second = renderHook(() => useRoles());
    await waitFor(() => expect(first.result.current.isModerator).toBe(true));
    await waitFor(() => expect(second.result.current.isModerator).toBe(true));
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('asks again for a different user', async () => {
    getMe.mockResolvedValueOnce({ roles: ['moderator'] }).mockResolvedValueOnce({ roles: [] });
    const { result, rerender } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.isModerator).toBe(true));
    auth.user = { id: 'u2' };
    rerender();
    await waitFor(() => expect(result.current.isModerator).toBe(false));
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it('reports a failure and retries next time', async () => {
    getMe.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ roles: ['moderator'] });
    const { result, unmount } = renderHook(() => useRoles());
    await waitFor(() => expect(result.current.error).toBe('offline'));
    expect(result.current.isModerator).toBe(false);
    unmount();
    const again = renderHook(() => useRoles());
    await waitFor(() => expect(again.result.current.isModerator).toBe(true));
  });

  it('has no roles when signed out', () => {
    auth.user = null;
    const { result } = renderHook(() => useRoles());
    expect(result.current).toMatchObject({ roles: [], loading: false, isModerator: false });
    expect(getMe).not.toHaveBeenCalled();
  });
});
