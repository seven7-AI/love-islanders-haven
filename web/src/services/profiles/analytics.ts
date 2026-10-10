import { fetchInsights, InsightsRange } from '@/lib/api/insights';

/** Activity numbers for the profile insights page. Rates are null when there is not enough activity yet. */
export interface ProfileStats {
  views: number;
  likes: number;
  matches: number;
  messagesSent: number;
  averageResponseTime: number | null;
  responseRate: number | null;
  conversionRate: number | null;
}

export interface DemographicData {
  age: { age: string; count: number }[];
  location: { location: string; count: number }[];
}

const percent = (rate: number | null) => (rate === null ? null : Math.round(rate * 1000) / 10);

export const fetchProfileStats = async (timeRange: InsightsRange): Promise<ProfileStats> => {
  const insights = await fetchInsights(timeRange);
  return {
    views: insights.times_shown,
    likes: insights.likes_received,
    matches: insights.matches,
    messagesSent: insights.messages_sent,
    averageResponseTime: insights.average_reply_minutes,
    responseRate: percent(insights.reply_rate),
    conversionRate: percent(insights.like_to_match_rate),
  };
};

/** Ages and cities of the people who liked the user in the given period. */
export const fetchDemographics = async (timeRange: InsightsRange = 'month'): Promise<DemographicData> => {
  const insights = await fetchInsights(timeRange);
  return {
    age: insights.liker_ages.map((b) => ({ age: b.label, count: b.count })),
    location: insights.liker_cities.map((b) => ({ location: b.label, count: b.count })),
  };
};
