import { apiFetch } from './client';

const BASE = '/v1/integrations/google-calendar';

export interface GoogleCalendarStatus {
  available: boolean;
  connected: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  start: string;
  end: string | null;
}

export const getGoogleCalendarStatus = () => apiFetch<GoogleCalendarStatus>(BASE);

export const startGoogleCalendarAuth = (returnTo: string) =>
  apiFetch<{ authorization_url: string }>(`${BASE}/authorize`, { method: 'POST', body: { return_to: returnTo } });

export const completeGoogleCalendarAuth = (code: string, state: string) =>
  apiFetch<{ connected: boolean; return_to: string }>(`${BASE}/callback`, { method: 'POST', body: { code, state } });

export const fetchGoogleCalendarEvents = () => apiFetch<GoogleCalendarEvent[]>(`${BASE}/events`);

export const disconnectGoogleCalendar = () => apiFetch<void>(BASE, { method: 'DELETE' });
