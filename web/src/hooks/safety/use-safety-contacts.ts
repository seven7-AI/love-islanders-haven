import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  SafetyContact,
  SafetyContactInput,
  SafetyContactUpdate,
  createSafetyContact,
  deleteSafetyContact,
  fetchSafetyContacts as fetchSafetyContactsApi,
  updateSafetyContact as updateSafetyContactApi,
} from '@/lib/api/safety';

export type { SafetyContact, SafetyContactInput, SafetyContactUpdate };

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** The signed-in user's safety contacts. Mutations report API errors to the user and resolve to null/false. */
export function useSafetyContacts({ autoLoad = true }: { autoLoad?: boolean } = {}) {
  const [safetyContacts, setSafetyContacts] = useState<SafetyContact[]>([]);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSafetyContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const contacts = await fetchSafetyContactsApi();
      setSafetyContacts(contacts);
      setError(null);
      return contacts;
    } catch (err) {
      setError(message(err, 'Could not load your safety contacts'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) fetchSafetyContacts();
  }, [autoLoad, fetchSafetyContacts]);

  // Making a contact primary demotes the others on the server, so reload the list afterwards.
  const syncPrimary = async (saved: SafetyContact) => {
    if (saved.is_primary) await fetchSafetyContacts();
  };

  const addSafetyContact = async (input: SafetyContactInput): Promise<SafetyContact | null> => {
    setIsSaving(true);
    try {
      const contact = await createSafetyContact(input);
      setSafetyContacts((prev) => [...prev, contact]);
      await syncPrimary(contact);
      toast.success(`${contact.name} has been added as a safety contact`);
      return contact;
    } catch (err) {
      toast.error(message(err, 'Could not add the safety contact'));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const updateSafetyContact = async (id: string, changes: SafetyContactUpdate): Promise<SafetyContact | null> => {
    setIsSaving(true);
    try {
      const contact = await updateSafetyContactApi(id, changes);
      setSafetyContacts((prev) => prev.map((c) => (c.id === id ? contact : c)));
      await syncPrimary(contact);
      toast.success(`${contact.name} has been updated`);
      return contact;
    } catch (err) {
      toast.error(message(err, 'Could not update the safety contact'));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const removeSafetyContact = async (id: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      await deleteSafetyContact(id);
      setSafetyContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success('Safety contact has been removed');
      return true;
    } catch (err) {
      toast.error(message(err, 'Could not remove the safety contact'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    safetyContacts,
    isLoading,
    isSaving,
    error,
    fetchSafetyContacts,
    addSafetyContact,
    updateSafetyContact,
    removeSafetyContact,
  };
}
