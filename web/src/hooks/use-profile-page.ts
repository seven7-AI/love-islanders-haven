import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth';
import { getMyProfile } from '@/lib/api/profile';
import { fromOwnProfile, type ProfileView } from '@/lib/profile-view';
import { supabase } from '@/integrations/supabase/client';

const createDefaultProfile = (email?: string | null, id?: string): ProfileView => ({
  id: id || 'local-profile',
  name: email?.split('@')[0] || 'New User',
  age: null,
  showAge: true,
  bio: '',
  verified: false,
  occupation: null,
  education: null,
  location: null,
  relationshipGoal: null,
  heightCm: null,
  pronouns: null,
  interests: [],
  images: [],
});

export function useProfilePage() {
  const [profile, setProfile] = useState<ProfileView>(() => createDefaultProfile(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const { toast } = useToast();
  const { networkError } = useAuth();

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSessionUser(data.session?.user ?? null);
      } finally {
        if (mounted) {
          setAuthReady(true);
        }
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSessionUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAuthenticated = !!sessionUser?.id;
  const user = sessionUser;

  // Load user profile when component mounts or when auth state changes
  useEffect(() => {
    if (!authReady) {
      return; // Don't do anything while auth is loading
    }

    if (user?.id) {
      setProfile((current) => (current?.id === 'local-profile' ? createDefaultProfile(user.email, user.id) : current));
      void loadUserProfile();
    } else {
      toast({
        title: 'Authentication required',
        description: 'Please log in to view and edit your profile.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [authReady, user?.id, retryCount]);

  const loadUserProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!user?.id) {
        throw new Error('Authentication required');
      }

      setProfile(fromOwnProfile(await getMyProfile()));
    } catch (error: any) {
      console.error('Error loading profile:', error);
      setError(error?.message || 'Failed to load profile data');

      if (user?.id) {
        setProfile(createDefaultProfile(user.email, user.id));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProfile = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      // Reload profile when exiting edit mode to reflect changes
      loadUserProfile();
    }
  };

  const handleRetry = () => {
    // Initialize Supabase session if needed
    if (networkError) {
      supabase.auth.refreshSession();
    }
    setRetryCount((prev) => prev + 1);
  };

  const handleImagesChange = (newImages: string[]) => {
    if (profile) {
      setProfile({
        ...profile,
        images: newImages,
      });
    }
  };

  const handleVerificationSuccess = () => {
    if (profile) {
      setProfile({
        ...profile,
        verified: true,
      });
    }
  };

  const handlePreferencesUpdated = () => {
    loadUserProfile();
    toast({
      title: 'Profile updated',
      description: 'Your profile settings have been saved successfully.',
    });
  };

  return {
    profile,
    isLoading,
    isEditing,
    error,
    loading: !authReady,
    isAuthenticated,
    user,
    handleEditProfile,
    handleRetry,
    handleImagesChange,
    handleVerificationSuccess,
    handlePreferencesUpdated,
  };
}
