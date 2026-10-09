import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera } from "lucide-react";
import StreakPostForm from "@/components/streaks/StreakPostForm";
import UserStreakCard from "@/components/streaks/UserStreakCard";
import TopStreaksCard from "@/components/streaks/TopStreaksCard";
import StreaksList from "@/components/streaks/StreaksList";
import LoginRequired from "@/components/streaks/LoginRequired";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchStreakFeed, getLeaderboard, getStreakStatus, StreakPostData } from "@/lib/api/streaks";
import type { StreakPost } from "@/components/streaks/types";
import useStreaksActions from "@/hooks/streaks/use-streaks-actions";

const toPost = (p: StreakPostData): StreakPost => ({
  id: p.id,
  user_id: p.user_id,
  content: p.images,
  caption: p.caption ?? undefined,
  created_at: p.created_at,
  streak_count: p.streak_count,
  likes_count: p.likes_count,
  liked_by_me: p.liked_by_me,
  user_name: p.author_name ?? 'Someone',
  user_profile_image: p.author_photo_url ?? undefined,
  expires_at: p.expires_at ?? undefined,
});

const Streaks = () => {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<StreakPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [userStreakCount, setUserStreakCount] = useState(0);
  const [topStreaks, setTopStreaks] = useState<{ id: string; name: string; count: number }[]>([]);
  const [showPostForm, setShowPostForm] = useState(false);
  
  // Load data
  const fetchData = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const [feed, status, leaderboard] = await Promise.all([fetchStreakFeed(), getStreakStatus(), getLeaderboard()]);
      setPosts(feed.posts.map(toPost));
      setCursor(feed.next_cursor);
      setHasPostedToday(status.has_posted_today);
      setUserStreakCount(status.streak_count);
      setTopStreaks(leaderboard.map((e) => ({ id: e.user_id, name: e.name ?? 'Anonymous', count: e.streak_count })));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load streak data. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch data when component mounts or user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);
  
  // Actions
  const { handlePostSubmit, handleLikePost, isSubmitting } = useStreaksActions();

  const loadMore = async () => {
    if (!cursor) return;
    try {
      const feed = await fetchStreakFeed(cursor);
      setPosts((prev) => [...prev, ...feed.posts.map(toPost)]);
      setCursor(feed.next_cursor);
    } catch (error) {
      toast({ title: "Error", description: "Could not load more posts.", variant: "destructive" });
    }
  };
  
  const onPostSubmit = async (postData) => {
    const success = await handlePostSubmit(postData);
    if (success) {
      setShowPostForm(false);
      await fetchData(); // Refresh data
    }
    return success;
  };
  
  // If not authenticated, show login required
  if (!isAuthenticated) {
    return <LoginRequired />;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-island-dark via-island to-island-dark">
      <ScrollArea className="h-screen w-full overflow-auto">
        <div className="container max-w-md mx-auto px-4 pt-4 pb-28">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Streaks</h1>
            {!showPostForm && !hasPostedToday && (
              <Button onClick={() => setShowPostForm(true)} className="flex items-center gap-2">
                <Camera size={18} />
                <span>Post</span>
              </Button>
            )}
          </div>

          {showPostForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Create Streak Post</CardTitle>
              </CardHeader>
              <CardContent>
                <StreakPostForm 
                  onSubmit={onPostSubmit} 
                  onCancel={() => setShowPostForm(false)}
                  isSubmitting={isSubmitting}
                />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 mb-6">
            <UserStreakCard 
              streakCount={userStreakCount} 
              hasPostedToday={hasPostedToday} 
            />
            <TopStreaksCard topStreaks={topStreaks} />
          </div>

          <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>
          
          <StreaksList 
            loading={loading} 
            posts={posts} 
            onLike={handleLikePost} 
          />
          {cursor && !loading && (
            <Button variant="secondary" className="w-full mt-4" onClick={loadMore}>
              Load more
            </Button>
          )}
        </div>
      </ScrollArea>
      <Navbar />
    </div>
  );
};

export default Streaks;
