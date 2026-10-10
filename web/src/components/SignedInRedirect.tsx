import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getMe, type Me } from '@/lib/api/moderation';

/**
 * Where a signed-in user starts: Discover once onboarded; the moderation queue for staff without a dating profile;
 * otherwise onboarding. If the account cannot be loaded, Discover (whose guard sends unfinished profiles onward).
 */
export const destinationFor = (me: Me | null) => {
  if (!me || me.onboarding_completed) return '/discover';
  return me.roles.includes('moderator') ? '/moderation' : '/onboarding';
};

/** Sends an already signed-in user to their start page; the only place that decides it. */
const SignedInRedirect = () => {
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .catch(() => null)
      .then((me) => !cancelled && setTo(destinationFor(me)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!to) {
    return (
      <div className="flex h-screen items-center justify-center bg-island-dark">
        <Loader2 className="h-12 w-12 animate-spin text-love" aria-label="Loading" />
      </div>
    );
  }
  return <Navigate to={to} replace />;
};

export default SignedInRedirect;
