import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  AppNotification,
  describeNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/lib/api/notifications';

const POLL_INTERVAL_MS = 30_000;

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const page = await fetchNotifications();
      setNotifications(page.notifications);
      setUnreadCount(page.unread_count);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = async (ids: string[]) => {
    try {
      await markNotificationsRead(ids);
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
      setUnreadCount((count) => Math.max(0, count - ids.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update notifications');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update notifications');
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.is_read) markRead([notification.id]);
    navigate(notification.type === 'streak_like' ? '/streaks' : '/matches');
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unreadCount} unread)`}>
          {unreadCount > 0 ? (
            <>
              <BellRing className="h-5 w-5 text-love" />
              <span className="absolute top-0 right-0 -mr-1 -mt-1 h-4 w-4 rounded-full bg-love text-[10px] font-medium text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[450px] flex flex-col" align="end">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {error ? (
            <div role="alert" className="text-center py-4 text-muted-foreground">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No notifications yet</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={`w-full text-left p-2 rounded-md flex justify-between items-start ${
                    notification.is_read ? 'bg-background' : 'bg-love/5'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div>
                    <p className="text-sm font-medium">{describeNotification(notification)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  {!notification.is_read && <span className="mt-1 h-2 w-2 rounded-full bg-love" aria-label="Unread" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
