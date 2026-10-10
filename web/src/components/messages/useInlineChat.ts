import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/auth';
import {
  ChatMessage,
  getChatMessage,
  listMessages,
  markConversationRead,
  MessageContentType,
  sendChatMessage,
} from '@/lib/api/messages';

const POLL_INTERVAL_MS = 4000;
const POLL_LIMIT = 100;
/** At most this many already-loaded messages are re-read per poll, so new ones always fit in the page. */
const RECHECK_WINDOW = 50;

const merge = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
};

/**
 * Where the next poll starts. Normally after the newest message; while some of my messages are still unread, from
 * just before the oldest of them, so the poll also returns them with their current read state.
 */
export const pollAnchor = (messages: ChatMessage[], me: string | null): string | null => {
  const firstUnread = messages.findIndex((m) => m.sender_id === me && !m.is_read);
  if (firstUnread === -1) return messages.length ? messages[messages.length - 1].created_at : null;
  // Reading marks the whole conversation, so the newest unread messages are the ones worth re-checking.
  const start = Math.max(firstUnread, messages.length - RECHECK_WINDOW);
  return start > 0 ? messages[start - 1].created_at : null;
};

/**
 * Loads a conversation, polls for new messages and read receipts while the page is visible, and marks incoming
 * messages read.
 * Sent messages appear once the server has stored them.
 */
export const useInlineChat = (matchId: string) => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);

  useEffect(() => {
    anchor.current = pollAnchor(messages, currentUserId);
  }, [messages, currentUserId]);

  const markRead = useCallback(
    (incoming: ChatMessage[]) => {
      if (incoming.some((m) => m.sender_id !== currentUserId && !m.is_read)) {
        markConversationRead(matchId).catch((err) => console.error('Error marking messages read:', err));
      }
    },
    [matchId, currentUserId],
  );

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    anchor.current = null;
    setIsLoading(true);
    listMessages(matchId)
      .then((page) => {
        if (cancelled) return;
        setMessages(page.messages);
        setOlderCursor(page.older_cursor);
        setError(null);
        markRead(page.messages);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load messages'))
      .finally(() => !cancelled && setIsLoading(false));

    const timer = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        // Without an anchor (no messages yet, or my oldest loaded message is unread), re-read the latest page.
        const page = await listMessages(matchId, anchor.current ? { after: anchor.current, limit: POLL_LIMIT } : {});
        if (!cancelled && page.messages.length) {
          setMessages((prev) => merge(prev, page.messages));
          markRead(page.messages);
        }
      } catch (err) {
        console.error('Error polling messages:', err);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [matchId, markRead]);

  const loadOlder = async () => {
    if (!olderCursor) return;
    const page = await listMessages(matchId, { before: olderCursor });
    setMessages((prev) => merge(prev, page.messages));
    setOlderCursor(page.older_cursor);
  };

  /** Signed media URLs expire; fetches a fresh one for a message (null if the media is unavailable). */
  const refreshMedia = useCallback(
    async (messageId: string): Promise<string | null> => {
      try {
        const fresh = await getChatMessage(matchId, messageId);
        setMessages((prev) => merge(prev, [fresh]));
        return fresh.media_url;
      } catch (err) {
        console.error('Error refreshing message media:', err);
        return null;
      }
    },
    [matchId],
  );

  /** Returns true once the message is stored; false (with the reason logged) if sending failed. */
  const handleSendMessage = async (content: string, contentType: MessageContentType = 'text', mediaPath?: string) => {
    try {
      const sent = await sendChatMessage(matchId, { content, content_type: contentType, media_path: mediaPath });
      setMessages((prev) => merge(prev, [sent]));
      return true;
    } catch (err) {
      console.error('Failed to send message:', err);
      return false;
    }
  };

  return {
    messages,
    isLoading,
    error,
    currentUserId,
    handleSendMessage,
    loadOlder,
    hasOlder: olderCursor !== null,
    refreshMedia,
  };
};
