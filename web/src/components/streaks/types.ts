export interface StreakPost {
  id: string;
  user_id: string;
  content: string[];
  caption?: string;
  created_at: string;
  streak_count: number;
  likes_count: number;
  liked_by_me: boolean;
  user_name: string;
  user_profile_image?: string;
  expires_at?: string;
}

export interface TopStreak {
  name: string;
  count: number;
}
