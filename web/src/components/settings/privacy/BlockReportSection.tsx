import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, TrashIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { BlockedUser, fetchBlockedUsers, unblockUser } from '@/lib/api/safety';

const BlockReportSection = () => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setBlockedUsers(await fetchBlockedUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load blocked users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = async (blocked: BlockedUser) => {
    setUnblocking(blocked.user_id);
    try {
      await unblockUser(blocked.user_id);
      setBlockedUsers((prev) => prev.filter((u) => u.user_id !== blocked.user_id));
      toast.success(`${blocked.name ?? 'User'} has been unblocked`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unblock this user');
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocked Users</CardTitle>
        <CardDescription>
          Manage the users you've blocked. To block or report someone, use the menu in your chat with them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-love" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        ) : blockedUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't blocked any users.</p>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((blocked) => (
              <div key={blocked.user_id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2 min-w-0">
                  {blocked.photo_url && (
                    <img src={blocked.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  )}
                  <span className="truncate">{blocked.name || 'Unknown User'}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnblock(blocked)}
                  disabled={unblocking === blocked.user_id}
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockReportSection;
