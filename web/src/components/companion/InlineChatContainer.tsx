import React, { useRef, useEffect } from 'react';
import Message from './Message';
import ChatInput from './ChatInput';
import { MessageType } from './types';
import { ScrollArea } from '@/components/ui/scroll-area';
interface InlineChatContainerProps {
  messages: MessageType[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}
const InlineChatContainer: React.FC<InlineChatContainerProps> = ({
  messages,
  isLoading,
  onSendMessage,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  // Scroll to the newest message when one arrives (not when earlier ones are loaded above).
  useEffect(() => {
    scrollToBottom();
  }, [lastId]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  };
  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      <ScrollArea className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {hasOlder && onLoadOlder && (
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-love hover:underline disabled:opacity-50"
                onClick={onLoadOlder}
                disabled={loadingOlder}
              >
                {loadingOlder ? 'Loading…' : 'Load earlier messages'}
              </button>
            </div>
          )}
          {messages.map((message, index) => (
            <Message key={message.id || index} message={message} isLast={index === messages.length - 1} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 my-[33px]">
        <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};
export default InlineChatContainer;
