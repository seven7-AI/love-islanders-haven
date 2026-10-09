import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDiscoverPage, PublicProfile, swipe, SwipeDirection, SwipeResult } from "@/lib/api/discovery";
import {
  DEFAULT_DISCOVER_PREFERENCES,
  DiscoverPreferences,
  getDiscoverFilters,
  saveDiscoverFilters,
} from "@/services/profiles/profile-preferences";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

// Fetch the next page when this many unseen profiles remain.
const PREFETCH_THRESHOLD = 3;

export const useDiscoverProfiles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DiscoverPreferences>(DEFAULT_DISCOVER_PREFERENCES);
  const loadingMore = useRef(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchDiscoverPage();
      setProfiles(page.profiles);
      setCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const page = await fetchDiscoverPage(cursor);
      setProfiles((prev) => [...prev, ...page.profiles.filter((p) => !prev.some((q) => q.id === p.id))]);
      setCursor(page.next_cursor);
      setHasMore(page.next_cursor !== null);
    } catch (err) {
      console.error("Error loading more profiles:", err);
    } finally {
      loadingMore.current = false;
    }
  }, [cursor, hasMore]);

  useEffect(() => {
    if (!user?.id) return;
    getDiscoverFilters().then(setFiltersState).catch((err) => console.error("Error loading preferences:", err));
    loadFirstPage();
  }, [user?.id, loadFirstPage]);

  useEffect(() => {
    if (profiles.length <= PREFETCH_THRESHOLD) loadMore();
  }, [profiles.length, loadMore]);

  /** Saves the preferences to the profile (the server applies them) and reloads the feed. */
  const setFilters = async (next: DiscoverPreferences) => {
    try {
      await saveDiscoverFilters(next);
      setFiltersState(next);
      await loadFirstPage();
    } catch (err) {
      toast({
        title: "Could not save your preferences",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  /** Records the swipe; the card only advances once the server has saved it. */
  const handleSwipe = async (profileId: string, direction: SwipeDirection): Promise<SwipeResult | null> => {
    setSwiping(true);
    try {
      const result = await swipe(profileId, direction);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      return result;
    } catch (err) {
      toast({
        title: "Could not save your swipe",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setSwiping(false);
    }
  };

  return {
    currentProfile: profiles[0] ?? null,
    isLoading: loading,
    swiping,
    error,
    filters,
    setFilters,
    refreshProfiles: loadFirstPage,
    handleSwipe,
  };
};

export default useDiscoverProfiles;
