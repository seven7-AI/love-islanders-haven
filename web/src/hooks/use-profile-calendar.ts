import { useState, useEffect, useCallback } from 'react';
import { useDatePlans } from '@/hooks/safety/use-date-plans';
import { useAuth } from '@/context/auth';
import { useGoogleCalendar, CalendarEvent } from '@/hooks/use-google-calendar';

export function useProfileCalendar() {
  const [isLoading, setIsLoading] = useState(true);
  const { datePlans, fetchDatePlans } = useDatePlans({ autoLoad: false });
  const { isAuthenticated } = useAuth();
  const {
    googleEvents,
    isLoading: isLoadingGoogle,
    isAuthorized: isGoogleAuthorized,
    isAvailable: isGoogleAvailable,
    initiateGoogleAuth,
    fetchGoogleEvents,
  } = useGoogleCalendar();

  const loadDatePlans = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchDatePlans();
    } catch (error) {
      console.error('Error loading date plans:', error);
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
    refresh: async () => {
      await loadDatePlans();
      if (isGoogleAuthorized) {
        await fetchGoogleEvents();
      }
    },
    isGoogleAuthorized,
    isGoogleAvailable,
    initiateGoogleAuth,
  };
}
