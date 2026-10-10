import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api/client';
import { useSafetyContacts } from './use-safety-contacts';

const fetchSafetyContacts = vi.fn();
const createSafetyContact = vi.fn();
const updateSafetyContact = vi.fn();
const deleteSafetyContact = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/lib/api/safety', () => ({
  fetchSafetyContacts: () => fetchSafetyContacts(),
  createSafetyContact: (c: unknown) => createSafetyContact(c),
  updateSafetyContact: (id: string, c: unknown) => updateSafetyContact(id, c),
  deleteSafetyContact: (id: string) => deleteSafetyContact(id),
}));
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));

const sam = { id: 'c1', name: 'Sam', phone: '+1', email: null, is_primary: false };

describe('useSafetyContacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the contacts', async () => {
    fetchSafetyContacts.mockResolvedValue([sam]);
    const { result } = renderHook(() => useSafetyContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.safetyContacts).toEqual([sam]);
    expect(result.current.error).toBeNull();
  });

  it('exposes the API error when loading fails', async () => {
    fetchSafetyContacts.mockRejectedValue(new ApiError(500, 'Database unavailable'));
    const { result } = renderHook(() => useSafetyContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Database unavailable');
    expect(result.current.safetyContacts).toEqual([]);
  });

  it('reports the API error when adding fails and does not add the contact', async () => {
    fetchSafetyContacts.mockResolvedValue([]);
    createSafetyContact.mockRejectedValue(new ApiError(409, 'You can have at most 5 safety contacts'));
    const { result } = renderHook(() => useSafetyContacts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: unknown = 'unset';
    await act(async () => {
      created = await result.current.addSafetyContact({ name: 'Sam', phone: '+1' });
    });
    expect(created).toBeNull();
    expect(toastError).toHaveBeenCalledWith('You can have at most 5 safety contacts');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(result.current.safetyContacts).toEqual([]);
  });

  it('keeps the contact when deleting fails', async () => {
    fetchSafetyContacts.mockResolvedValue([sam]);
    deleteSafetyContact.mockRejectedValue(new ApiError(404, 'Safety contact not found'));
    const { result } = renderHook(() => useSafetyContacts());
    await waitFor(() => expect(result.current.safetyContacts).toHaveLength(1));

    let removed = true;
    await act(async () => {
      removed = await result.current.removeSafetyContact('c1');
    });
    expect(removed).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Safety contact not found');
    expect(result.current.safetyContacts).toEqual([sam]);
  });
});
