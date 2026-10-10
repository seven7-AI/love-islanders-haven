import { useState, useEffect, useCallback } from 'react';
import { useDatePlans } from '@/hooks/safety/use-date-plans';
import { useAuth } from '@/context/auth';
import { useGoogleCalendar, CalendarEvent } from '@/hooks/use-google-calendar';

export function useProfileCalendar() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { datePlans, fetchDatePlans } = useDatePlans({ autoLoad: false });
  const { isAuthenticated } = useAuth();
  const {
    googleEvents,
    isLoading: isLoadingGoogle,
    isAuthorized: isGoogleAuthorized,
    isAvailable: isGoogleAvailable,
    initiateGoogleAuth,
    fetchGoogleEvents,
    disconnectGoogleCalendar,
  } = useGoogleCalendar();

  const loadDatePlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fetchDatePlans();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not load your dates');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDatePlans]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDatePlans();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, loadDatePlans]);

  // Google events can only be fetched once the connection status is known to be connected.
  useEffect(() => {
    if (isGoogleAuthorized) void fetchGoogleEvents();
  }, [isGoogleAuthorized, fetchGoogleEvents]);

  // App dates (not cancelled) with a time, in the same shape as Google Calendar events.
  const appEvents: CalendarEvent[] = datePlans
    .filter((plan) => plan.date_time && plan.status !== 'cancelled')
    .map((plan) => ({
      id: plan.id,
      title: plan.title,
      location: plan.location ?? plan.title,
      notes: plan.notes ?? undefined,
      date_time: plan.date_time as string,
      source: 'app' as const,
    }));

  const allEvents = [...appEvents, ...googleEvents];

  const now = new Date();
  const upcomingDates = allEvents
    .filter((event) => new Date(event.date_time) > now)
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const pastDates = allEvents
    .filter((event) => new Date(event.date_time) <= now)
    .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());

  return {
    datePlans,
    upcomingDates,
    pastDates,
    isLoading: isLoading || isLoadingGoogle,
    error,
    retry: loadDatePlans,
    isGoogleAuthorized,
    isGoogleAvailable,
    initiateGoogleAuth,
    disconnectGoogleCalendar,
  };
}
