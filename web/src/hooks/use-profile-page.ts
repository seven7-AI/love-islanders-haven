import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth';
import { getMyProfile } from '@/lib/api/profile';
import { fromOwnProfile, type ProfileView } from '@/lib/profile-view';

/** Loads the signed-in user's profile. `profile` stays null until it has loaded; failures are reported in `error`. */
export function useProfilePage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadUserProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setProfile(fromOwnProfile(await getMyProfile()));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to load your profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) void loadUserProfile();
  }, [userId, loadUserProfile]);

  const handleEditProfile = () => {
    if (isEditing) void loadUserProfile(); // show what was saved while editing
    setIsEditing(!isEditing);
  };

  const handleImagesChange = (newImages: string[]) => {
    setProfile((current) => (current ? { ...current, images: newImages } : current));
  };

  const handleVerificationSuccess = () => {
    setProfile((current) => (current ? { ...current, verified: true } : current));
  };

  const handlePreferencesUpdated = () => {
    void loadUserProfile();
    toast({ title: 'Profile updated', description: 'Your profile settings have been saved.' });
  };

  return {
    profile,
    isLoading,
    isEditing,
    error,
    handleEditProfile,
    handleRetry: loadUserProfile,
    handleImagesChange,
    handleVerificationSuccess,
    handlePreferencesUpdated,
  };
}
