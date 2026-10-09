import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { completeGoogleCalendarAuth } from '@/lib/api/calendar';

/**
 * Google redirects here after consent. The code is exchanged by the API with the signed-in user's token, so a link
 * started by someone else cannot attach their calendar to this account.
 */
const CalendarCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get('code');
    const state = params.get('state');
    if (params.get('error') || !code || !state) {
      setError('Google Calendar was not connected.');
      return;
    }
    completeGoogleCalendarAuth(code, state)
      .then((result) => {
        toast.success('Google Calendar connected');
        navigate(result.return_to.startsWith('/') ? result.return_to : '/profile', { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Google Calendar was not connected.'));
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-island-dark via-island to-island-dark p-4">
      <div className="glass-card w-full max-w-md p-6 rounded-xl shadow-lg text-center space-y-4">
        {error ? (
          <>
            <p role="alert" className="text-white">
              {error}
            </p>
            <Link to="/profile" className="text-love hover:underline text-sm">
              Back to your profile
            </Link>
          </>
        ) : (
          <div className="flex justify-center" aria-label="Connecting Google Calendar">
            <Loader2 className="h-8 w-8 animate-spin text-love" />
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarCallback;
