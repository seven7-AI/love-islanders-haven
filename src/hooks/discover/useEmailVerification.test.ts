import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEmailVerification } from './useEmailVerification';

let user: Record<string, unknown> | null;
vi.mock('@/context/auth', () => ({ useAuth: () => ({ user }) }));

describe('useEmailVerification', () => {
  it('prompts users whose email the auth provider has not confirmed', () => {
    user = { id: 'u1', email: 'a@example.com', email_confirmed_at: null };
    const { result } = renderHook(() => useEmailVerification());
    expect(result.current.showVerificationPopup).toBe(true);
    expect(result.current.email).toBe('a@example.com');
  });

  it('does not prompt confirmed users', () => {
    user = { id: 'u1', email: 'a@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };
    const { result } = renderHook(() => useEmailVerification());
    expect(result.current.showVerificationPopup).toBe(false);
  });

  it('can be dismissed without marking the user confirmed', () => {
    user = { id: 'u1', email: 'a@example.com', email_confirmed_at: null };
    const { result } = renderHook(() => useEmailVerification());
    act(() => result.current.handleVerificationComplete());
    expect(result.current.showVerificationPopup).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });
});
