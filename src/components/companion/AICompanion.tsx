import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import InlineChatContainer from './InlineChatContainer';
import { MessageType } from './types';
import { ApiError } from '@/lib/api/client';
import { CompanionMessage, fetchCompanionHistory, sendCompanionMessage } from '@/lib/api/companion';

// Shown when there is no history yet; it is part of the page, not a stored message.
const WELCOME: MessageType = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Welcome to Isla, your dating companion! I can help you with dating advice, profile feedback, and conversation starters. How can I assist you today?',
  timestamp: new Date(),
  type: 'chat',
};

const toMessage = (m: CompanionMessage): MessageType => ({
  id: m.id,
  role: m.role,
  content: m.content,
  timestamp: new Date(m.created_at),
  type: 'chat',
});

export const companionErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.code === 'ai_not_configured') return 'Isla is not available right now. Please try again later.';
    if (error.status === 429) return error.message;
  }
  return 'Isla could not answer. Please try again.';
};

const AICompanion: React.FC = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCompanionHistory()
      .then((page) => setMessages(page.messages.length ? page.messages.map(toMessage) : [WELCOME]))
      .catch((error) => {
        setMessages([WELCOME]);
        toast.error(`Could not load your conversation: ${error instanceof Error ? error.message : 'unknown error'}`);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSendMessage = async (content: string) => {
    const text = content.trim();
    if (!text) return;
    const pending: MessageType = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      type: 'chat',
    };
    setMessages((prev) => [...prev.filter((m) => m.id !== 'welcome'), pending]);
    setIsLoading(true);
    try {
      const exchange = await sendCompanionMessage(text);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== pending.id),
        toMessage(exchange.user_message),
        toMessage(exchange.reply),
      ]);
    } catch (error) {
      // Nothing was stored; take the unsent message back out and say why.
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== pending.id);
        return rest.length ? rest : [WELCOME];
      });
      toast.error(companionErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full">
      <InlineChatContainer messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default AICompanion;
