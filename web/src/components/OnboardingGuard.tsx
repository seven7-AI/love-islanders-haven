import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { getMyProfile } from '@/lib/api/profile';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Ensures authenticated users with incomplete onboarding are
 * redirected to /onboarding before viewing any protected page.
 */
const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAuthenticatedUser = !!user?.id || isAuthenticated;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (loading || !hasAuthenticatedUser || !user?.id || location.pathname === '/onboarding') {
        return;
      }

      try {
        const profile = await getMyProfile();
        if (!cancelled && profile.onboarding_completed === false) {
          navigate('/onboarding', { replace: true });
        }
      } catch (err) {
        console.error('OnboardingGuard error:', err);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hasAuthenticatedUser, user?.id, loading, location.pathname, navigate]);

  return <>{children}</>;
};

export default OnboardingGuard;
