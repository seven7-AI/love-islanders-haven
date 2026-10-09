import { apiFetch } from './client';

export interface AppNotification {
  id: string;
  type: 'match' | 'message' | 'streak_like';
  actor_id: string | null;
  actor_name: string | null;
  actor_photo_url: string | null;
  match_id: string | null;
  streak_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPage {
  notifications: AppNotification[];
  unread_count: number;
  next_cursor: string | null;
}

export const fetchNotifications = () => apiFetch<NotificationPage>('/v1/notifications');

export const markNotificationsRead = (ids: string[]) =>
  apiFetch<{ marked_read: number }>('/v1/notifications/read', { method: 'POST', body: { ids } });

export const markAllNotificationsRead = () =>
  apiFetch<{ marked_read: number }>('/v1/notifications/read', { method: 'POST', body: { all: true } });

export function describeNotification(n: AppNotification): string {
  const who = n.actor_name ?? 'Someone';
  switch (n.type) {
    case 'match':
      return `You matched with ${who}!`;
    case 'message':
      return `New message from ${who}`;
    case 'streak_like':
      return `${who} liked your streak`;
  }
}
