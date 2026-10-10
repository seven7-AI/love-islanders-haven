import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import NotificationBell from '@/components/NotificationBell';
import InlineChatOverlay from '@/components/messages/InlineChatOverlay';
import EmptyMatchState from '@/components/matches/EmptyMatchState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2 } from 'lucide-react';
import { fetchMatches, MatchSummary } from '@/lib/api/discovery';

const Matches = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; partnerId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchMatches();
      setMatches(page.matches);
      setCursor(page.next_cursor);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchMatches(cursor);
      setMatches((prev) => [...prev, ...page.matches]);
      setCursor(page.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more matches');
    } finally {
      setLoadingMore(false);
    }
  };

  const preview = (m: MatchSummary) => {
    if (!m.last_message) return 'New match! Say hello';
    const prefix = m.last_message.sender_id === user?.id ? 'You: ' : '';
    return prefix + m.last_message.content;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-island-dark via-island to-island-dark pb-20">
      <header className="flex items-center justify-between pt-4 mb-6 px-4">
        <h1 className="text-2xl font-bold text-gradient">Matches</h1>
        <NotificationBell />
      </header>

      <main className="container max-w-md mx-auto px-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-love" />
          </div>
        ) : error ? (
          <div className="text-center space-y-3 py-12">
            <p role="alert" className="text-white">
              {error}
            </p>
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          </div>
        ) : matches.length === 0 ? (
          <EmptyMatchState />
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <Card key={m.id} className="border-love/20 bg-island-light/20">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-island-light">
                    {m.partner.photo_url ? (
                      <img
                        src={m.partner.photo_url}
                        alt={m.partner.name ?? ''}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">💕</div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h2 className="font-semibold truncate">
                      {m.partner.name ?? 'Someone'}
                      {m.partner.age ? `, ${m.partner.age}` : ''}
                    </h2>
                    <p className="text-sm text-love-light truncate">{preview(m)}</p>
                  </div>
                  {m.unread_count > 0 && (
                    <span
                      className="bg-love text-white text-xs rounded-full px-2 py-0.5"
                      aria-label={`${m.unread_count} unread`}
                    >
                      {m.unread_count}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    className="bg-love/10 hover:bg-love/20 p-2 rounded-full"
                    aria-label={`Message ${m.partner.name ?? 'match'}`}
                    onClick={() => setActiveChat({ id: m.id, name: m.partner.name ?? '', partnerId: m.partner.id })}
                  >
                    <MessageCircle size={20} className="text-love" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {cursor && (
              <Button variant="secondary" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </div>
        )}
      </main>

      {activeChat && (
        <InlineChatOverlay
          matchId={activeChat.id}
          matchName={activeChat.name}
          partnerId={activeChat.partnerId}
          onClose={() => setActiveChat(null)}
          onBlocked={() => {
            const blockedId = activeChat.partnerId;
            setActiveChat(null);
            setMatches((prev) => prev.filter((m) => m.partner.id !== blockedId));
          }}
          onUnmatched={() => {
            const endedId = activeChat.id;
            setActiveChat(null);
            setMatches((prev) => prev.filter((m) => m.id !== endedId));
          }}
        />
      )}
    </div>
  );
};

export default Matches;
