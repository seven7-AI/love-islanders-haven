import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Message as MessageType } from '@/services/messages';
import MessageItem from '@/components/messages/MessageItem';
import MessageInput from '@/components/messages/MessageInput';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InlineChatContentProps {
  matchId: string;
  messages: MessageType[];
  isLoading: boolean;
  error?: string | null;
  currentUserId: string | null;
  hasOlder?: boolean;
  onLoadOlder?: () => Promise<void>;
  onSendMessage: (content: string, contentType: 'text' | 'image' | 'audio', mediaPath?: string) => Promise<boolean>;
}

const InlineChatContent: React.FC<InlineChatContentProps> = ({
  matchId,
  messages,
  isLoading,
  error,
  currentUserId,
  hasOlder,
  onLoadOlder,
  onSendMessage,
}) => {
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  // Scroll to the newest message when one arrives (not when older ones are loaded above).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastId]);

  const handleSendMessage = async (
    content: string,
    contentType: 'text' | 'image' | 'audio' = 'text',
    mediaPath?: string,
  ) => {
    setIsSending(true);
    try {
      const success = await onSendMessage(content, contentType, mediaPath);
      if (!success) {
        toast({ title: 'Message not sent', description: 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <ScrollArea className="flex-1 p-4 space-y-4">
        {isLoading ? (
          <div className="text-center text-white/60 py-8">Loading messages...</div>
        ) : error ? (
          <div role="alert" className="text-center text-white/80 py-8">
            Could not load this conversation: {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-white/60 py-8">No messages yet. Say hello to start the conversation!</div>
        ) : (
          <div className="space-y-4">
            {hasOlder && onLoadOlder && (
              <div className="text-center">
                <button type="button" className="text-sm text-love hover:underline" onClick={() => onLoadOlder()}>
                  Load earlier messages
                </button>
              </div>
            )}
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} isCurrentUser={msg.sender_id === currentUserId} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="mt-auto">
        <MessageInput onSendMessage={handleSendMessage} isSending={isSending} matchId={matchId} />
      </div>
    </>
  );
};

export default InlineChatContent;
