import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Users, Clock, Eye, Heart, MessageCircle } from 'lucide-react';
import { fetchProfileInsights, type ProfileInsightsData } from '@/services/profiles/analytics';
import type { InsightsRange } from '@/lib/api/insights';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#F39C12'];
const RANGES: { value: InsightsRange; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const Stat = ({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string | number }) => (
  <Card>
    <CardContent className="p-4 flex flex-col items-center text-center">
      <Icon className="mb-2 text-love h-5 w-5" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </CardContent>
  </Card>
);

const Distribution = ({
  title,
  data,
  nameKey,
}: {
  title: string;
  data: { count: number; [key: string]: string | number }[];
  nameKey: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription>People who liked you in this period</CardDescription>
    </CardHeader>
    <CardContent>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No likes in this period yet.</p>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                dataKey="count"
                nameKey={nameKey}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>
);

const ProfileInsights = () => {
  const [timeRange, setTimeRange] = useState<InsightsRange>('month');
  const [data, setData] = useState<ProfileInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((range: InsightsRange) => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchProfileInsights(range)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error && err.message ? err.message : 'Could not load your insights');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(timeRange), [load, timeRange]);

  const stats = data?.stats;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle>Profile Insights</CardTitle>
          <CardDescription>Your activity and how others respond to your profile</CardDescription>
        </div>
        <ToggleGroup
          type="single"
          value={timeRange}
          onValueChange={(value) => value && setTimeRange(value as InsightsRange)}
          aria-label="Period"
          className="justify-start"
        >
          {RANGES.map((range) => (
            <ToggleGroupItem key={range.value} value={range.value} className="data-[state=on]:bg-love/20">
              {range.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent aria-busy={isLoading}>
        {error ? (
          <div role="alert" className="py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => load(timeRange)}>
              Try again
            </Button>
          </div>
        ) : !stats ? (
          <div className="h-80 flex items-center justify-center" aria-label="Loading insights">
            <div className="animate-pulse flex flex-col items-center gap-4 w-full">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-32 w-full bg-muted rounded" />
            </div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className={`space-y-4 ${isLoading ? 'opacity-60' : ''}`}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat icon={Eye} label="Shown in Discover" value={stats.timesShown} />
                <Stat icon={Heart} label="Likes received" value={stats.likes} />
                <Stat icon={Users} label="Matches" value={stats.matches} />
                <Stat
                  icon={Clock}
                  label="Avg. reply time"
                  value={stats.averageResponseTime != null ? `${Math.round(stats.averageResponseTime)}m` : '—'}
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Conversion Rate</CardTitle>
                  <CardDescription>
                    {stats.conversionRate != null
                      ? `${stats.conversionRate.toFixed(1)}% of likes lead to matches`
                      : 'Not enough likes yet'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Shown', value: stats.timesShown },
                          { name: 'Likes', value: stats.likes },
                          { name: 'Matches', value: stats.matches },
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#FF6B8B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="demographics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Distribution title="Age Distribution" data={data.demographics.age} nameKey="age" />
                <Distribution title="Location Distribution" data={data.demographics.location} nameKey="location" />
              </div>
            </TabsContent>

            <TabsContent value="engagement" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Stat
                  icon={MessageCircle}
                  label="Reply rate"
                  value={stats.responseRate != null ? `${stats.responseRate}%` : '—'}
                />
                <Stat icon={MessageCircle} label="Messages sent" value={stats.messagesSent} />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfileInsights;
