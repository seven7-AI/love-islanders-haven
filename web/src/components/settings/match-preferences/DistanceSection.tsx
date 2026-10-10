import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { requestAndUpdateLocation } from '@/services/profiles/location';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const kmToMiles = (km: number) => Math.round(km * 0.621371);
const milesToKm = (miles: number) => Math.round(miles / 0.621371);

/** Mirrors the API limit on profile.distance_preference. */
const MAX_DISTANCE_KM = 500;

interface DistanceSectionProps {
  /** Always kilometres; only the display uses the chosen unit. */
  distanceKm: number;
  unit: 'km' | 'mi';
  disabled?: boolean;
  onDistanceCommit: (distanceKm: number) => Promise<void>;
  onUnitChange: (unit: 'km' | 'mi') => Promise<void>;
}

const DistanceSection = ({ distanceKm, unit, disabled, onDistanceCommit, onUnitChange }: DistanceSectionProps) => {
  const toDisplay = (km: number) => (unit === 'mi' ? kmToMiles(km) : km);
  const toKm = (display: number) =>
    Math.min(MAX_DISTANCE_KM, Math.max(1, unit === 'mi' ? milesToKm(display) : display));

  const [draft, setDraft] = useState(toDisplay(distanceKm));
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- toDisplay only depends on unit
  useEffect(() => setDraft(toDisplay(distanceKm)), [distanceKm, unit]);

  // requestAndUpdateLocation reports its own success or failure to the user.
  const handleUpdateLocation = async () => {
    setIsUpdatingLocation(true);
    try {
      await requestAndUpdateLocation();
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-island-light/30">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-love">Distance</h4>
        <Select value={unit} onValueChange={(value: 'km' | 'mi') => onUnitChange(value)} disabled={disabled}>
          <SelectTrigger className="w-24 h-8" aria-label="Distance unit">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="km">Kilometers</SelectItem>
            <SelectItem value="mi">Miles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="py-6 px-2">
        <Slider
          value={[draft]}
          min={1}
          max={toDisplay(MAX_DISTANCE_KM)}
          step={1}
          disabled={disabled}
          aria-label="Maximum distance"
          onValueChange={(values) => setDraft(values[0])}
          onValueCommit={(values) => onDistanceCommit(toKm(values[0]))}
          className="mt-6"
        />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>1 {unit}</span>
          <span>
            {draft} {unit}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full flex items-center justify-center gap-2"
          onClick={handleUpdateLocation}
          disabled={isUpdatingLocation}
        >
          {isUpdatingLocation ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Updating Location...
            </>
          ) : (
            <>
              <MapPin size={16} />
              Update My Location
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          This will update your current location to be used for distance calculations.
        </p>
      </div>
    </div>
  );
};

export default DistanceSection;
