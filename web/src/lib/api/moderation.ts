import { apiFetch } from './client';
import type { ReportReason } from './safety';

export interface Me {
  id: string;
  email: string | null;
  name: string | null;
  onboarding_completed: boolean;
  email_verified: boolean;
  /** Granted by an operator; e.g. ['moderator']. */
  roles: string[];
}

export const getMe = () => apiFetch<Me>('/v1/me');

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export interface ReportPerson {
  id: string;
  name: string | null;
  photo_url: string | null;
}

export interface ModerationReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reporter: ReportPerson;
  reported: ReportPerson & { reports_against: number };
  reviewed_by: ReportPerson | null;
  reviewed_at: string | null;
  resolution_note: string | null;
}

export interface ModerationReportPage {
  reports: ModerationReport[];
  next_cursor: string | null;
}

export function listReports(options: { status?: ReportStatus | null; cursor?: string | null } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  return apiFetch<ModerationReportPage>(`/v1/moderation/reports${query ? `?${query}` : ''}`);
}

export const reviewReport = (
  reportId: string,
  body: { status: Exclude<ReportStatus, 'open'>; resolution_note?: string },
) => apiFetch<ModerationReport>(`/v1/moderation/reports/${encodeURIComponent(reportId)}`, { method: 'PATCH', body });
