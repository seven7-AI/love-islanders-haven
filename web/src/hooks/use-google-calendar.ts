import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth';
import {
  disconnectGoogleCalendar as disconnectApi,
  fetchGoogleCalendarEvents,
  getGoogleCalendarStatus,
  startGoogleCalendarAuth,
} from '@/lib/api/calendar';

export interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  notes?: string;
  date_time: string;
  end_time?: string;
  source: 'app' | 'google';
  location_sharing_enabled?: boolean;
}

const message = (error: unknown) => (error instanceof Error ? error.message : 'Please try again.');

export function useGoogleCalendar() {
  const { isAuthenticated } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getGoogleCalendarStatus()
      .then((status) => {
        setIsAvailable(status.available);
        setIsAuthorized(status.connected);
      })
      .catch((error) => console.error('Could not check Google Calendar status:', error));
  }, [isAuthenticated]);

  /** Sends the browser to Google; it comes back to /calendar/callback, which finishes the connection. */
  const initiateGoogleAuth = async () => {
    try {
      const { authorization_url } = await startGoogleCalendarAuth(window.location.pathname);
      window.location.assign(authorization_url);
    } catch (error) {
      toast.error(`Could not connect Google Calendar: ${message(error)}`);
    }
  };

  const fetchGoogleEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const events = await fetchGoogleCalendarEvents();
      setGoogleEvents(
        events.map((event) => ({
          id: event.id,
          title: event.title,
          location: event.location ?? undefined,
          notes: event.notes ?? undefined,
          date_time: event.start,
          end_time: event.end ?? undefined,
          source: 'google' as const,
        })),
      );
    } catch (error) {
      toast.error(`Could not load Google Calendar events: ${message(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectGoogleCalendar = async () => {
    try {
      await disconnectApi();
      setIsAuthorized(false);
      setGoogleEvents([]);
      toast.success('Google Calendar disconnected');
    } catch (error) {
      toast.error(`Could not disconnect Google Calendar: ${message(error)}`);
    }
  };

  return {
    isAvailable,
    isAuthorized,
    isLoading,
    googleEvents,
    initiateGoogleAuth,
    fetchGoogleEvents,
    disconnectGoogleCalendar,
  };
}
