import { supabase } from '@/integrations/supabase/client';
import { apiFetch } from './client';

export interface StreakPostData {
  id: string;
  user_id: string;
  author_name: string | null;
  author_photo_url: string | null;
  images: string[];
  caption: string | null;
  streak_count: number;
  likes_count: number;
  liked_by_me: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface StreakFeed {
  posts: StreakPostData[];
  next_cursor: string | null;
}

export interface StreakStatus {
  has_posted_today: boolean;
  streak_count: number;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string | null;
  streak_count: number;
}

export const fetchStreakFeed = (cursor?: string | null) =>
  apiFetch<StreakFeed>(`/v1/streaks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);

export const getStreakStatus = () => apiFetch<StreakStatus>('/v1/streaks/me');

export const getLeaderboard = (limit = 3) => apiFetch<LeaderboardEntry[]>(`/v1/streaks/leaderboard?limit=${limit}`);

export const setStreakLike = (postId: string, liked: boolean) =>
  apiFetch<{ liked: boolean; likes_count: number }>(`/v1/streaks/${postId}/like`, { method: liked ? 'PUT' : 'DELETE' });

/** Uploads one photo for a streak post and returns its storage path. */
export async function uploadStreakPhoto(photo: Blob): Promise<string> {
  const ticket = await apiFetch<{ bucket: string; path: string; token: string }>('/v1/streaks/uploads', {
    method: 'POST',
    body: { content_type: photo.type, size_bytes: photo.size },
  });
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, photo, { contentType: photo.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return ticket.path;
}

export const createStreakPost = (body: { media_paths: string[]; caption?: string; duration_hours: number }) =>
  apiFetch<StreakPostData>('/v1/streaks', { method: 'POST', body });
