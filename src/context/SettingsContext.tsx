import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { UserSettings, defaultSettings, fromApiSettings, toApiPatch, toApiSettings } from '@/services/settings';
import { getMySettings, updateMySettings } from '@/lib/api/settings';
import { useAuth } from '@/context/auth';

interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  error: string | null;
  /** Saves one category. Reports the API error to the user and restores the previous value on failure. */
  updateSettings: <T extends keyof UserSettings>(category: T, newSettings: UserSettings[T]) => Promise<boolean>;
  /** Saves every category. Rejects with the API error on failure. */
  saveAllSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!isAuthenticated) {
      setSettings(defaultSettings);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    getMySettings()
      .then((api) => {
        if (cancelled) return;
        setSettings(fromApiSettings(api));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err, 'Failed to load settings'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const updateSettings = useCallback(
    async <T extends keyof UserSettings>(category: T, newSettings: UserSettings[T]): Promise<boolean> => {
      if (!isAuthenticated) {
        toast.error('You must be logged in to save settings');
        return false;
      }

      const previous = settingsRef.current[category];
      setSettings((prev) => ({ ...prev, [category]: newSettings }));
      try {
        const saved = fromApiSettings(await updateMySettings(toApiPatch(category, newSettings)));
        setSettings((prev) => ({ ...prev, [category]: saved[category] }));
        return true;
      } catch (err) {
        setSettings((prev) => ({ ...prev, [category]: previous }));
        toast.error(errorMessage(err, 'Could not save your settings'));
        return false;
      }
    },
    [isAuthenticated],
  );

  const saveAllSettings = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to save settings');
    }
    const saved = await updateMySettings(toApiSettings(settingsRef.current));
    setSettings(fromApiSettings(saved));
  }, [isAuthenticated]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, error, updateSettings, saveAllSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
