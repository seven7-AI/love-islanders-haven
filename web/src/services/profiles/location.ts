import { apiFetch } from '@/lib/api/client';
import { toast } from 'sonner';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Saves the user's approximate location (the API keeps it at about 1 km precision and only shows rounded distances).
 */
export const updateUserLocation = async (location: UserLocation): Promise<boolean> => {
  try {
    await apiFetch<void>('/v1/me/location', {
      method: 'PUT',
      body: { latitude: location.latitude, longitude: location.longitude },
    });
    return true;
  } catch (error) {
    console.error('Error updating location:', error);
    return false;
  }
};

/** Removes the stored location (used when location sharing is turned off). */
export const clearUserLocation = () => apiFetch<void>('/v1/me/location', { method: 'DELETE' });

/**
 * Gets the user's current location using the browser's geolocation API
 */
export const getCurrentLocation = (): Promise<UserLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
      if (result.state === 'denied') {
        reject(new Error('Location permission is denied. Please enable location services in your browser settings.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Got location:', position.coords);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  });
};

/**
 * Request and update the user's current location
 */
export const requestAndUpdateLocation = async (): Promise<boolean> => {
  try {
    console.log('Requesting user location...');
    // Get current location
    const location = await getCurrentLocation();
    const success = await updateUserLocation(location);

    if (success) {
      console.log('Location updated successfully');
      toast.success('Your location has been updated successfully');
      return true;
    } else {
      console.error('Failed to update location');
      toast.error('Failed to update your location');
      return false;
    }
  } catch (error) {
    console.error('Error requesting and updating location:', error);

    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          toast.error('Location permission denied. Please enable location services.');
          break;
        case error.POSITION_UNAVAILABLE:
          toast.error('Location information is unavailable.');
          break;
        case error.TIMEOUT:
          toast.error('Location request timed out.');
          break;
        default:
          toast.error('An unknown error occurred while getting location.');
      }
    } else if (error instanceof Error) {
      toast.error(error.message);
    } else {
      toast.error('Failed to update location');
    }

    return false;
  }
};
