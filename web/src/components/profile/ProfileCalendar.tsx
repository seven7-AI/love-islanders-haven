import { useProfileCalendar } from '@/hooks/use-profile-calendar';
import { Share2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { CalendarEvent } from '@/hooks/use-google-calendar';

const EventList = ({ events, badge, empty }: { events: CalendarEvent[]; badge: 'Upcoming' | 'Past'; empty: string }) =>
  events.length > 0 ? (
    <ul className="space-y-4">
      {events.map((event) => (
        <li key={`${event.source}-${event.id}`} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium truncate">{event.title || event.location}</h3>
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.date_time), 'MMM d, yyyy h:mm a')}
              {event.source === 'google' ? ' · Google Calendar' : ''}
            </p>
          </div>
          <Badge variant={badge === 'Upcoming' ? 'secondary' : 'outline'}>{badge}</Badge>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{empty}</p>
  );

const ProfileCalendar = () => {
  const {
    upcomingDates,
    pastDates,
    isLoading,
    error,
    retry,
    isGoogleAuthorized,
    isGoogleAvailable,
    initiateGoogleAuth,
    disconnectGoogleCalendar,
  } = useProfileCalendar();

  return (
    <div className="space-y-6">
      {error ? (
        <Card role="alert">
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => void retry()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Dates</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm">Loading upcoming dates...</p>
              ) : (
                <EventList events={upcomingDates} badge="Upcoming" empty="No upcoming dates planned." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Past Dates</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm">Loading past dates...</p>
              ) : (
                <EventList events={pastDates} badge="Past" empty="No past dates yet." />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isGoogleAuthorized ? (
            <>
              <p className="text-sm text-muted-foreground">Connected. Your Google Calendar events are listed above.</p>
              <Button variant="outline" className="w-full" onClick={() => void disconnectGoogleCalendar()}>
                <Unlink size={16} className="mr-2" />
                Disconnect Google Calendar
              </Button>
            </>
          ) : isGoogleAvailable ? (
            <Button
              variant="outline"
              className="w-full bg-island-light/10 border-island-light/40"
              onClick={() => void initiateGoogleAuth()}
            >
              <Share2 size={16} className="mr-2" />
              Connect to Google Calendar
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center">Google Calendar sync isn't available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileCalendar;
