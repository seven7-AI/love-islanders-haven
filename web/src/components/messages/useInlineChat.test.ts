import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { pollAnchor, useInlineChat } from './useInlineChat';
import type { ChatMessage } from '@/lib/api/messages';

const listMessages = vi.fn();
const sendChatMessage = vi.fn();
const markConversationRead = vi.fn();

vi.mock('@/lib/api/messages', () => ({
  listMessages: (...a: unknown[]) => listMessages(...a),
  sendChatMessage: (...a: unknown[]) => sendChatMessage(...a),
  markConversationRead: (...a: unknown[]) => markConversationRead(...a),
}));
vi.mock('@/context/auth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

const msg = (id: string, sender: string, at: string, is_read = false): ChatMessage => ({
  id,
  match_id: 'm1',
  sender_id: sender,
  content: id,
  content_type: 'text',
  media_url: null,
  is_read,
  created_at: at,
});

describe('useInlineChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markConversationRead.mockResolvedValue({ marked_read: 1 });
  });
  afterEach(() => vi.useRealTimers());

  it('loads the conversation and marks unread incoming messages read', async () => {
    listMessages.mockResolvedValue({ messages: [msg('a', 'them', '2026-01-01T10:00:00Z')], older_cursor: 'c' });
    const { result } = renderHook(() => useInlineChat('m1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(['a']);
    expect(result.current.hasOlder).toBe(true);
    expect(markConversationRead).toHaveBeenCalledWith('m1');
  });

  it('does not mark read when nothing new came from the other person', async () => {
    listMessages.mockResolvedValue({ messages: [msg('a', 'me', '2026-01-01T10:00:00Z')], older_cursor: null });
    const { result } = renderHook(() => useInlineChat('m1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it('shows a sent message only once the server stored it', async () => {
    listMessages.mockResolvedValue({ messages: [], older_cursor: null });
    sendChatMessage.mockResolvedValue(msg('s', 'me', '2026-01-01T10:01:00Z'));
    const { result } = renderHook(() => useInlineChat('m1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let ok = false;
    await act(async () => {
      ok = await result.current.handleSendMessage('hello');
    });
    expect(ok).toBe(true);
    expect(sendChatMessage).toHaveBeenCalledWith('m1', {
      content: 'hello',
      content_type: 'text',
      media_path: undefined,
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['s']);
  });

  it('reports a failed send and adds nothing', async () => {
    listMessages.mockResolvedValue({ messages: [], older_cursor: null });
    sendChatMessage.mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useInlineChat('m1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let ok = true;
    await act(async () => {
      ok = await result.current.handleSendMessage('hello');
    });
    expect(ok).toBe(false);
    expect(result.current.messages).toEqual([]);
  });

  it('polls for messages newer than the latest one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listMessages
      .mockResolvedValueOnce({ messages: [msg('a', 'them', '2026-01-01T10:00:00Z', true)], older_cursor: null })
      .mockResolvedValue({ messages: [msg('b', 'them', '2026-01-01T10:05:00Z')], older_cursor: null });
    const { result } = renderHook(() => useInlineChat('m1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    expect(listMessages).toHaveBeenLastCalledWith('m1', { after: '2026-01-01T10:00:00Z', limit: 100 });
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['a', 'b']));
  });

  it('refreshes my unread messages so they show as read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = msg('a', 'them', '2026-01-01T10:00:00Z', true);
    const mine = msg('b', 'me', '2026-01-01T10:01:00Z');
    listMessages
      .mockResolvedValueOnce({ messages: [first, mine], older_cursor: null })
      .mockResolvedValue({ messages: [{ ...mine, is_read: true }], older_cursor: null });
    const { result } = renderHook(() => useInlineChat('m1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    // Polls from just before my unread message, so the answer includes it.
    expect(listMessages).toHaveBeenLastCalledWith('m1', { after: '2026-01-01T10:00:00Z', limit: 100 });
    await waitFor(() => expect(result.current.messages[1].is_read).toBe(true));
  });

  it('keeps polling an empty conversation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listMessages.mockResolvedValue({ messages: [], older_cursor: null });
    renderHook(() => useInlineChat('m1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    expect(listMessages).toHaveBeenLastCalledWith('m1', {});
  });

  it('stops polling when closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listMessages.mockResolvedValue({ messages: [], older_cursor: null });
    const { unmount } = renderHook(() => useInlineChat('m1'));
    unmount();
    const calls = listMessages.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(listMessages.mock.calls.length).toBe(calls);
  });
});

describe('pollAnchor', () => {
  const at = (n: number) => `2026-01-01T10:${String(n).padStart(2, '0')}:00Z`;

  it('starts after the newest message when all of mine are read', () => {
    expect(pollAnchor([msg('a', 'me', at(0), true), msg('b', 'them', at(1))], 'me')).toBe(at(1));
  });

  it('starts before my oldest unread message', () => {
    const messages = [msg('a', 'them', at(0)), msg('b', 'me', at(1)), msg('c', 'me', at(2))];
    expect(pollAnchor(messages, 'me')).toBe(at(0));
    expect(pollAnchor(messages.slice(1), 'me')).toBeNull(); // the first loaded message is unread: latest page
  });

  it('re-reads at most the last 50 loaded messages', () => {
    const messages = Array.from({ length: 60 }, (_, i) => msg(String(i), 'me', at(i)));
    expect(pollAnchor(messages, 'me')).toBe(at(9));
  });

  it('has no anchor without messages', () => {
    expect(pollAnchor([], 'me')).toBeNull();
  });
});
