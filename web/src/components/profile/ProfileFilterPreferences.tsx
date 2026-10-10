import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_DISCOVER_PREFERENCES,
  getDiscoverFilters,
  saveDiscoverFilters,
  type DiscoverPreferences,
} from '@/services/profiles/profile-preferences';
import { useToast } from '@/hooks/use-toast';

interface ProfileFilterPreferencesProps {
  onPreferencesUpdated?: () => void;
}

interface FilterState {
  ageRange: [number, number];
  distance: number;
  /** Not editable here; kept so saving the sliders does not change who the user wants to see. */
  gender: DiscoverPreferences['gender'];
}

const ProfileFilterPreferences = ({ onPreferencesUpdated }: ProfileFilterPreferencesProps) => {
  const [filters, setFilters] = useState<FilterState>({
    ageRange: [DEFAULT_DISCOVER_PREFERENCES.minAge, DEFAULT_DISCOVER_PREFERENCES.maxAge],
    distance: DEFAULT_DISCOVER_PREFERENCES.maxDistance,
    gender: undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    getDiscoverFilters()
      .then((saved) => {
        if (cancelled) return;
        setFilters({ ageRange: [saved.minAge, saved.maxAge], distance: saved.maxDistance, gender: saved.gender });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled)
          toast({
            title: 'Could not load your preferences',
            description: 'Reload the page to try again.',
            variant: 'destructive',
          });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSaveFilters = async () => {
    setIsLoading(true);
    try {
      await saveDiscoverFilters({
        minAge: filters.ageRange[0],
        maxAge: filters.ageRange[1],
        maxDistance: filters.distance,
        gender: filters.gender,
      });
      toast({ title: 'Preferences Saved', description: 'Your discovery preferences have been updated.' });
      onPreferencesUpdated?.();
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'There was an error saving your preferences.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgeRangeChange = (value: number[]) => {
    setFilters((prev) => ({
      ...prev,
      ageRange: value as [number, number],
    }));
  };

  const handleDistanceChange = (value: number[]) => {
    setFilters((prev) => ({
      ...prev,
      distance: value[0],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-white mb-4">Discovery Preferences</h3>

        <div className="space-y-8">
          {/* Age Range Slider */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="age-range" className="text-sm">
                Age Range
              </Label>
              <Badge variant="outline" className="text-xs">
                {filters.ageRange[0]} - {filters.ageRange[1]}
              </Badge>
            </div>
            <Slider
              id="age-range"
              min={18}
              max={99}
              step={1}
              value={filters.ageRange}
              onValueChange={handleAgeRangeChange}
              className="my-4"
            />
          </div>

          {/* Distance Slider */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="distance" className="text-sm">
                Distance (km)
              </Label>
              <Badge variant="outline" className="text-xs">
                {filters.distance}
              </Badge>
            </div>
            <Slider
              id="distance"
              min={1}
              max={100}
              step={1}
              value={[filters.distance]}
              onValueChange={handleDistanceChange}
              className="my-4"
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSaveFilters} disabled={isLoading || !loaded} className="w-full">
        {isLoading ? 'Saving...' : 'Save Discovery Preferences'}
      </Button>
    </div>
  );
};

export default ProfileFilterPreferences;
