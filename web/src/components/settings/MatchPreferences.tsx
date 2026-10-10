import { Heart, Loader2 } from 'lucide-react';
import SettingsSection from './SettingsSection';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSettings } from '@/context/SettingsContext';
import { getMyProfile, updateMyProfile } from '@/lib/api/profile';
import { DEFAULT_DISCOVER_PREFERENCES } from '@/services/profiles/profile-preferences';
import AgeRangeSection from './match-preferences/AgeRangeSection';
import DistanceSection from './match-preferences/DistanceSection';

interface DiscoveryRange {
  ageRange: [number, number];
  distanceKm: number;
}

/** Age range and distance live on the profile (they drive Discover); the distance unit is a display preference. */
const MatchPreferences = () => {
  const { settings, updateSettings } = useSettings();
  const [range, setRange] = useState<DiscoveryRange | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const profile = await getMyProfile();
      setRange({
        ageRange: [
          profile.age_range_min ?? DEFAULT_DISCOVER_PREFERENCES.minAge,
          profile.age_range_max ?? DEFAULT_DISCOVER_PREFERENCES.maxAge,
        ],
        distanceKm: profile.distance_preference ?? DEFAULT_DISCOVER_PREFERENCES.maxDistance,
      });
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your match preferences');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (update: Record<string, unknown>, next: DiscoveryRange) => {
    const previous = range;
    setRange(next);
    setIsSaving(true);
    try {
      await updateMyProfile(update);
    } catch (err) {
      setRange(previous);
      toast.error(err instanceof Error ? err.message : 'Could not save your match preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAgeRange = async (ageRange: [number, number]) => {
    if (!range) return;
    await saveProfile({ age_range_min: ageRange[0], age_range_max: ageRange[1] }, { ...range, ageRange });
  };

  const handleDistance = async (distanceKm: number) => {
    if (!range) return;
    await saveProfile({ distance_preference: distanceKm }, { ...range, distanceKm });
  };

  const handleUnit = async (distanceUnit: 'km' | 'mi') => {
    await updateSettings('match_preferences', { ...settings.match_preferences, distanceUnit });
  };

  return (
    <SettingsSection title="Match Preferences" icon={<Heart size={20} />}>
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : !range ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-love" />
        </div>
      ) : (
        <div className="space-y-6">
          <AgeRangeSection value={range.ageRange} disabled={isSaving} onCommit={handleAgeRange} />
          <DistanceSection
            distanceKm={range.distanceKm}
            unit={settings.match_preferences.distanceUnit ?? 'km'}
            disabled={isSaving}
            onDistanceCommit={handleDistance}
            onUnitChange={handleUnit}
          />
        </div>
      )}
    </SettingsSection>
  );
};

export default MatchPreferences;
