import { apiFetch } from './client';

// Blocking & reports

export interface BlockedUser {
  user_id: string;
  name: string | null;
  photo_url: string | null;
  blocked_at: string;
}

export type ReportReason = 'harassment' | 'spam' | 'fake_profile' | 'inappropriate_content' | 'underage' | 'other';

export interface ReportInput {
  user_id: string;
  reason: ReportReason;
  details?: string;
  also_block?: boolean;
}

export const fetchBlockedUsers = () => apiFetch<BlockedUser[]>('/v1/blocks');

export const blockUser = (userId: string) =>
  apiFetch<void>('/v1/blocks', { method: 'POST', body: { user_id: userId } });

export const unblockUser = (userId: string) =>
  apiFetch<void>(`/v1/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const reportUser = (report: ReportInput) =>
  apiFetch<{ id: string }>('/v1/reports', { method: 'POST', body: report });

// Safety contacts

export interface SafetyContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

export interface SafetyContactInput {
  name: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
}

/** PATCH body; null clears a phone number or email. */
export interface SafetyContactUpdate {
  name?: string;
  phone?: string | null;
  email?: string | null;
  is_primary?: boolean;
}

export const MAX_SAFETY_CONTACTS = 5;

export const fetchSafetyContacts = () => apiFetch<SafetyContact[]>('/v1/safety-contacts');

export const createSafetyContact = (contact: SafetyContactInput) =>
  apiFetch<SafetyContact>('/v1/safety-contacts', { method: 'POST', body: contact });

export const updateSafetyContact = (id: string, changes: SafetyContactUpdate) =>
  apiFetch<SafetyContact>(`/v1/safety-contacts/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });

export const deleteSafetyContact = (id: string) =>
  apiFetch<void>(`/v1/safety-contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Date plans

export type DatePlanStatus = 'planned' | 'completed' | 'cancelled';

export interface DatePlan {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date_time: string | null;
  partner_name: string | null;
  status: DatePlanStatus;
  notes: string | null;
  contact_id: string | null;
  location_sharing_enabled: boolean;
}

export interface DatePlanInput {
  title: string;
  description?: string;
  location?: string;
  date_time?: string;
  partner_name?: string;
  notes?: string;
  contact_id?: string;
  location_sharing_enabled?: boolean;
}

export type DatePlanUpdate = Partial<Omit<DatePlanInput, 'contact_id'>> & {
  contact_id?: string | null;
  status?: DatePlanStatus;
};

export const fetchDatePlans = () => apiFetch<DatePlan[]>('/v1/date-plans');

export const createDatePlan = (plan: DatePlanInput) =>
  apiFetch<DatePlan>('/v1/date-plans', { method: 'POST', body: plan });

export const updateDatePlan = (id: string, changes: DatePlanUpdate) =>
  apiFetch<DatePlan>(`/v1/date-plans/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });

export const deleteDatePlan = (id: string) =>
  apiFetch<void>(`/v1/date-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Emergency alerts

export interface EmergencyAlertInput {
  message?: string;
  latitude?: number;
  longitude?: number;
}

/** Error code the API returns (with 503) while no SMS/email provider is configured. */
export const ALERTS_NOT_CONFIGURED = 'alerts_not_configured';

export const sendEmergencyAlert = (alert: EmergencyAlertInput) =>
  apiFetch<unknown>('/v1/safety/alerts', { method: 'POST', body: alert });
