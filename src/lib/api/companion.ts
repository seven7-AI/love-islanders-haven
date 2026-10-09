import { apiFetch } from './client';

export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const fetchCompanionHistory = (before?: string | null) =>
  apiFetch<{ messages: CompanionMessage[]; older_cursor: string | null }>(
    `/v1/companion/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`,
  );

export const sendCompanionMessage = (content: string) =>
  apiFetch<{ user_message: CompanionMessage; reply: CompanionMessage }>('/v1/companion/messages', {
    method: 'POST',
    body: { content },
  });
