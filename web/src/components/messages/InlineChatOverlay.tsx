import React from 'react';
import { AudioPlayerProvider } from '@/hooks/use-audio-player';
import { useInlineChat } from './useInlineChat';
import InlineChatHeader from './InlineChatHeader';
import InlineChatContent from './InlineChatContent';

interface InlineChatOverlayProps {
  matchId: string;
  matchName: string;
  /** The other person's user id, for blocking and reporting. */
  partnerId?: string;
  onClose: () => void;
  /** Called after the partner was blocked; the chat should be closed and the match removed. */
  onBlocked?: () => void;
}

const InlineChatOverlay: React.FC<InlineChatOverlayProps> = ({ matchId, matchName, partnerId, onClose, onBlocked }) => {
  const { messages, isLoading, error, currentUserId, handleSendMessage, loadOlder, hasOlder } = useInlineChat(matchId);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <AudioPlayerProvider>
        <div className="bg-island-dark border border-island-light/20 rounded-lg w-full max-w-md h-[85dvh] flex flex-col overflow-hidden animate-fade-in chat-container">
          <InlineChatHeader matchName={matchName} partnerId={partnerId} onClose={onClose} onBlocked={onBlocked} />

          <InlineChatContent
            matchId={matchId}
            messages={messages}
            isLoading={isLoading}
            error={error}
            currentUserId={currentUserId}
            hasOlder={hasOlder}
            onLoadOlder={loadOlder}
            onSendMessage={handleSendMessage}
          />
        </div>
      </AudioPlayerProvider>
    </div>
  );
};

export default InlineChatOverlay;
