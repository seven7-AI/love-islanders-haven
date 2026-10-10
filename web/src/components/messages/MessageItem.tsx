import { useMemo, useState } from 'react';
import { Check, CheckCheck, Music } from 'lucide-react';
import { Message } from '@/services/messages';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import SafeImage from '@/components/SafeImage';

interface MessageItemProps {
  message: Message;
  isCurrentUser: boolean;
  /** Fetches a fresh signed URL when the media URL has expired. */
  onMediaExpired?: (messageId: string) => Promise<string | null>;
}

const MessageItem = ({ message, isCurrentUser, onMediaExpired }: MessageItemProps) => {
  const { playAudio, isPlaying, currentAudioId } = useAudioPlayer();
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  const refresh = onMediaExpired ? () => onMediaExpired(message.id) : undefined;

  const handlePlay = async () => {
    if (message.media_url && (await playAudio(message.id, message.media_url))) return;
    // The signed URL may have expired: try once more with a fresh one.
    const fresh = refresh ? await refresh() : null;
    const played = fresh ? await playAudio(message.id, fresh) : false;
    setAudioUnavailable(!played);
  };
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formattedTime = useMemo(() => formatTime(message.created_at), [message.created_at]);

  const renderMessageContent = () => {
    switch (message.content_type) {
      case 'image':
        return (
          <div className="mb-2">
            <SafeImage
              src={message.media_url}
              alt="Photo"
              onExpired={refresh}
              className="rounded-md max-w-full max-h-60 min-h-24 min-w-24 object-contain cursor-pointer"
              onClick={(e) => window.open(e.currentTarget.currentSrc, '_blank', 'noopener')}
            />
          </div>
        );
      case 'audio':
        return (
          <div
            className="flex items-center space-x-2 cursor-pointer hover:opacity-90 p-2 bg-black/20 rounded-md mb-2"
            onClick={handlePlay}
          >
            <Music size={20} />
            <span className="text-sm">
              {isPlaying && currentAudioId === message.id
                ? 'Playing...'
                : audioUnavailable
                  ? 'Voice note unavailable'
                  : 'Audio message'}
            </span>
            {isPlaying && currentAudioId === message.id && (
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse delay-100"></div>
                <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse delay-200"></div>
              </div>
            )}
          </div>
        );
      default:
        return <p>{message.content}</p>;
    }
  };

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg ${
          isCurrentUser ? 'bg-love/80 text-white' : 'bg-gray-700/60 text-white'
        }`}
      >
        {renderMessageContent()}
        <p
          className={`text-xs mt-1 flex items-center gap-1 ${isCurrentUser ? 'justify-end text-white/70' : 'text-white/50'}`}
        >
          {formattedTime}
          {isCurrentUser &&
            (message.is_read ? (
              <CheckCheck size={14} aria-label="Read" role="img" />
            ) : (
              <Check size={14} aria-label="Sent" role="img" />
            ))}
        </p>
      </div>
    </div>
  );
};

export default MessageItem;
