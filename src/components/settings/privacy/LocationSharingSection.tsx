import { MapPin } from 'lucide-react';
import PrivacyControlsSection from './PrivacyControlsSection';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { requestAndUpdateLocation } from '@/services/profiles/location';
import { useSettings } from '@/context/SettingsContext';

const LocationSharingSection = () => {
  const { settings, updateSettings, isLoading } = useSettings();
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const privacy = settings.privacy_settings;
  const sharing = privacy.location_sharing ?? false;

  const setSharing = (value: boolean) => updateSettings('privacy_settings', { ...privacy, location_sharing: value });

  // requestAndUpdateLocation reports its own success or failure to the user.
  const handleUpdateLocation = async (): Promise<boolean> => {
    setIsUpdatingLocation(true);
    try {
      const success = await requestAndUpdateLocation();
      if (success && !sharing) {
        // The user explicitly shared their location, so turn sharing on.
        await setSharing(true);
      }
      return success;
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      if (checked) {
        // Only switch sharing on once the location was actually updated.
        await handleUpdateLocation();
      } else {
        await setSharing(false);
      }
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <PrivacyControlsSection title="Location Sharing" icon={<MapPin size={16} className="text-love" />}>
      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-muted-foreground" />
            <span>Share your location</span>
          </div>
          <p className="text-sm text-muted-foreground ml-6 mt-1">
            Allow the app to use your location for distance calculation and matching
          </p>
        </div>
        <Switch
          aria-label="Share your location"
          checked={sharing}
          onCheckedChange={handleToggle}
          disabled={isLoading || isToggling || isUpdatingLocation}
        />
      </div>

      <Button
        onClick={handleUpdateLocation}
        variant="outline"
        size="sm"
        className="w-full mt-2"
        disabled={isUpdatingLocation}
      >
        {isUpdatingLocation ? 'Updating Location...' : 'Update My Location Now'}
      </Button>
    </PrivacyControlsSection>
  );
};

export default LocationSharingSection;
