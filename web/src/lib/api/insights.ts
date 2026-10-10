import { apiFetch } from './client';

export type InsightsRange = 'week' | 'month' | 'year';

export interface Insights {
  range: InsightsRange;
  times_shown: number;
  likes_received: number;
  matches: number;
  messages_sent: number;
  like_to_match_rate: number | null;
  reply_rate: number | null;
  average_reply_minutes: number | null;
  liker_ages: { label: string; count: number }[];
  liker_cities: { label: string; count: number }[];
}

export interface FeedbackEntry {
  id: string;
  category: string;
  content: string;
  created_at: string;
}

export const fetchInsights = (range: InsightsRange) => apiFetch<Insights>(`/v1/me/insights?range=${range}`);

export const sendFeedback = (category: string, content: string) =>
  apiFetch<FeedbackEntry>('/v1/feedback', { method: 'POST', body: { category, content } });

export const fetchMyFeedback = () => apiFetch<FeedbackEntry[]>('/v1/feedback');
