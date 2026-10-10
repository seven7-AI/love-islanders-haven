import { supabase } from '@/integrations/supabase/client';
import { apiFetch } from './client';

export type MessageContentType = 'text' | 'image' | 'audio';

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  content_type: MessageContentType;
  /** Short-lived signed URL for photo/voice messages (null if unavailable). */
  media_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface MessagePage {
  messages: ChatMessage[];
  older_cursor: string | null;
}

const base = (matchId: string) => `/v1/matches/${encodeURIComponent(matchId)}`;

export function listMessages(
  matchId: string,
  options: { before?: string | null; after?: string | null; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (options.before) params.set('before', options.before);
  if (options.after) params.set('after', options.after);
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return apiFetch<MessagePage>(`${base(matchId)}/messages${query ? `?${query}` : ''}`);
}

export const sendChatMessage = (
  matchId: string,
  body: { content: string; content_type: MessageContentType; media_path?: string },
) => apiFetch<ChatMessage>(`${base(matchId)}/messages`, { method: 'POST', body });

export const markConversationRead = (matchId: string) =>
  apiFetch<{ marked_read: number }>(`${base(matchId)}/read`, { method: 'POST' });

/** Uploads a chat photo or voice note to private storage and returns its path for sendChatMessage. */
export async function uploadChatMedia(matchId: string, file: Blob): Promise<string> {
  const ticket = await apiFetch<{ bucket: string; path: string; token: string }>(`${base(matchId)}/media/uploads`, {
    method: 'POST',
    // Recorders report e.g. "audio/webm;codecs=opus"; the API accepts the base type.
    body: { content_type: file.type.split(';')[0], size_bytes: file.size },
  });
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  return ticket.path;
}
