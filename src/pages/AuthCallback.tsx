import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth';

/** Reads an error returned by Supabase Auth in the redirect URL (query string or hash). */
export function getAuthRedirectError(search: string, hash: string): string | null {
  for (const raw of [search, hash.replace(/^#/, '?')]) {
    const params = new URLSearchParams(raw);
    const message = params.get('error_description') || params.get('error');
    if (message) return message;
  }
  return null;
}

/**
 * Landing page for links from Supabase Auth (email confirmation, Google sign-in).
 * supabase-js exchanges the URL for a session; this page waits for it and continues into the app.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const redirectError = useMemo(() => getAuthRedirectError(window.location.search, window.location.hash), []);

  useEffect(() => {
    if (!loading && session && !redirectError) {
      navigate('/discover', { replace: true });
    }
  }, [loading, session, redirectError, navigate]);

  const failed = redirectError || (!loading && !session);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-island-dark via-island to-island-dark p-4">
      <div className="glass-card w-full max-w-md p-6 rounded-xl shadow-lg text-center space-y-4">
        {failed ? (
          <>
            <p role="alert" className="text-white">
              {redirectError || 'This link is invalid or has expired.'}
            </p>
            <Link to="/login" className="text-love hover:underline text-sm">Back to sign in</Link>
          </>
        ) : (
          <div className="flex justify-center" aria-label="Signing you in">
            <Loader2 className="h-8 w-8 animate-spin text-love" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
