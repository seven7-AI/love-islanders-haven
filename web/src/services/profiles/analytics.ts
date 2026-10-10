import { fetchInsights, InsightsRange } from '@/lib/api/insights';

/** Activity numbers for the profile insights page. Rates are null when there is not enough activity yet. */
export interface ProfileStats {
  /** How often the profile was shown in other people's Discover feeds. */
  timesShown: number;
  likes: number;
  matches: number;
  messagesSent: number;
  averageResponseTime: number | null;
  responseRate: number | null;
  conversionRate: number | null;
}

/** Ages and cities of the people who liked the user in the period. */
export interface DemographicData {
  age: { age: string; count: number }[];
  location: { location: string; count: number }[];
}

export interface ProfileInsightsData {
  stats: ProfileStats;
  demographics: DemographicData;
}

const percent = (rate: number | null) => (rate === null ? null : Math.round(rate * 1000) / 10);

/** Stats and demographics for one period, from a single API call. */
export const fetchProfileInsights = async (timeRange: InsightsRange): Promise<ProfileInsightsData> => {
  const insights = await fetchInsights(timeRange);
  return {
    stats: {
      timesShown: insights.times_shown,
      likes: insights.likes_received,
      matches: insights.matches,
      messagesSent: insights.messages_sent,
      averageResponseTime: insights.average_reply_minutes,
      responseRate: percent(insights.reply_rate),
      conversionRate: percent(insights.like_to_match_rate),
    },
    demographics: {
      age: insights.liker_ages.map((b) => ({ age: b.label, count: b.count })),
      location: insights.liker_cities.map((b) => ({ location: b.label, count: b.count })),
    },
  };
};
