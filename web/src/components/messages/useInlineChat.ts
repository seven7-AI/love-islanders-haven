import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/auth';
import {
  ChatMessage,
  listMessages,
  markConversationRead,
  MessageContentType,
  sendChatMessage,
} from '@/lib/api/messages';

const POLL_INTERVAL_MS = 4000;

const merge = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
};

/**
 * Loads a conversation, polls for new messages while the page is visible, and marks incoming messages read.
 * Sent messages appear once the server has stored them.
 */
export const useInlineChat = (matchId: string) => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<string | null>(null);

  useEffect(() => {
    latest.current = messages.length ? messages[messages.length - 1].created_at : latest.current;
  }, [messages]);

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
    latest.current = null;
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
        // Until there is a message to anchor on, re-read the (empty or tiny) latest page.
        const page = await listMessages(matchId, latest.current ? { after: latest.current } : {});
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

  return { messages, isLoading, error, currentUserId, handleSendMessage, loadOlder, hasOlder: olderCursor !== null };
};
