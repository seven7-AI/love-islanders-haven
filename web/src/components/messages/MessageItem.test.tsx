import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageItem from './MessageItem';
import type { ChatMessage } from '@/lib/api/messages';

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
