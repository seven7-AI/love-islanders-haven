import { apiFetch } from './client';

export interface PublicProfile {
  id: string;
  name: string | null;
  bio: string | null;
  age: number | null;
  gender: string | null;
  relationship_goal: string | null;
  height_cm: number | null;
  occupation: string | null;
  education: string | null;
  city: string | null;
  country: string | null;
  pronouns: string | null;
  interests: string[];
  verified: boolean;
  images: string[];
}

export interface DiscoverPage {
  profiles: PublicProfile[];
  next_cursor: string | null;
}

export type SwipeDirection = 'left' | 'right' | 'super';

export interface SwipeResult {
  matched: boolean;
  match_id: string | null;
}

export interface MatchSummary {
  id: string;
  created_at: string;
  partner: { id: string; name: string | null; age: number | null; photo_url: string | null };
  last_message: { content: string; sender_id: string; created_at: string } | null;
  unread_count: number;
}

export interface MatchPage {
  matches: MatchSummary[];
  next_cursor: string | null;
}

const query = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const fetchDiscoverPage = (cursor?: string | null, limit = 20) =>
  apiFetch<DiscoverPage>(`/v1/discover${query({ cursor, limit })}`);

export const swipe = (targetId: string, direction: SwipeDirection) =>
  apiFetch<SwipeResult>('/v1/swipes', { method: 'POST', body: { target_id: targetId, direction } });

export const fetchMatches = (cursor?: string | null, limit = 20) =>
  apiFetch<MatchPage>(`/v1/matches${query({ cursor, limit })}`);

export const unmatch = (matchId: string) => apiFetch<void>(`/v1/matches/${matchId}`, { method: 'DELETE' });
