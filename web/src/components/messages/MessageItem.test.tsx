import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MessageItem from './MessageItem';
import type { ChatMessage } from '@/lib/api/messages';

const playAudio = vi.fn();
vi.mock('@/hooks/use-audio-player', () => ({
  useAudioPlayer: () => ({
    playAudio: (id: string, src: string) => playAudio(id, src),
    isPlaying: false,
    currentAudioId: null,
  }),
}));

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  match_id: 'x',
  sender_id: 'me',
  content: 'Hello',
  content_type: 'text',
  media_url: null,
  is_read: false,
  created_at: '2026-10-10T10:00:00Z',
  ...overrides,
});

describe('MessageItem read receipts', () => {
  it('shows my unread message as sent', () => {
    render(<MessageItem message={message()} isCurrentUser />);
    expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument();
  });

  it('shows my message as read once the other person read it', () => {
    render(<MessageItem message={message({ is_read: true })} isCurrentUser />);
    expect(screen.getByRole('img', { name: 'Read' })).toBeInTheDocument();
  });

  it('shows no receipt on messages from the other person', () => {
    render(<MessageItem message={message({ sender_id: 'them', is_read: true })} isCurrentUser={false} />);
    expect(screen.queryByRole('img', { name: /Sent|Read/ })).not.toBeInTheDocument();
  });
});

describe('MessageItem media', () => {
  it('refreshes an expired photo URL through the API', async () => {
    const onMediaExpired = vi.fn().mockResolvedValue('https://signed/new');
    render(
      <MessageItem
        message={message({ content_type: 'image', media_url: 'https://signed/old' })}
        isCurrentUser={false}
        onMediaExpired={onMediaExpired}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', 'https://signed/new'),
    );
    expect(onMediaExpired).toHaveBeenCalledWith('m1');
  });

  it('retries a voice note with a fresh URL, then says when it is unavailable', async () => {
    playAudio.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const onMediaExpired = vi.fn().mockResolvedValue('https://signed/new');
    const audio = message({ content_type: 'audio', media_url: 'https://signed/old' });
    const { unmount } = render(<MessageItem message={audio} isCurrentUser={false} onMediaExpired={onMediaExpired} />);
    fireEvent.click(screen.getByText('Audio message'));
    await waitFor(() => expect(playAudio).toHaveBeenLastCalledWith('m1', 'https://signed/new'));
    expect(screen.queryByText('Voice note unavailable')).not.toBeInTheDocument();
    unmount();

    playAudio.mockResolvedValue(false);
    render(<MessageItem message={audio} isCurrentUser={false} onMediaExpired={vi.fn().mockResolvedValue(null)} />);
    fireEvent.click(screen.getByText('Audio message'));
    expect(await screen.findByText('Voice note unavailable')).toBeInTheDocument();
  });
});
