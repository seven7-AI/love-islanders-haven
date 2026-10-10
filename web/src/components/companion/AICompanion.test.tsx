import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AICompanion, { companionErrorMessage } from './AICompanion';
import { ApiError } from '@/lib/api/client';

const fetchCompanionHistory = vi.fn();
const sendCompanionMessage = vi.fn();
const toastError = vi.fn();
vi.mock('@/lib/api/companion', () => ({
  fetchCompanionHistory: (before?: string) => fetchCompanionHistory(before),
  sendCompanionMessage: (c: string) => sendCompanionMessage(c),
}));
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }));
Element.prototype.scrollIntoView = vi.fn();

const send = (text: string) => {
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest('form')!);
};

describe('AICompanion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the stored exchange returned by the server', async () => {
    fetchCompanionHistory.mockResolvedValue({ messages: [], older_cursor: null });
    sendCompanionMessage.mockResolvedValue({
      user_message: { id: 'u1', role: 'user', content: 'Tips?', created_at: '2026-10-09T10:00:00Z' },
      reply: { id: 'a1', role: 'assistant', content: 'Be yourself.', created_at: '2026-10-09T10:00:01Z' },
    });
    render(<AICompanion />);
    await screen.findByText(/Welcome to Isla/);
    send('Tips?');
    expect(await screen.findByText('Be yourself.')).toBeInTheDocument();
    expect(screen.queryByText(/Welcome to Isla/)).not.toBeInTheDocument();
  });

  it('does not invent a reply when the companion is unavailable', async () => {
    fetchCompanionHistory.mockResolvedValue({ messages: [], older_cursor: null });
    sendCompanionMessage.mockRejectedValue(new ApiError(503, 'unavailable', 'ai_not_configured'));
    render(<AICompanion />);
    await screen.findByText(/Welcome to Isla/);
    send('Hello?');
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Isla is not available right now. Please try again later.'),
    );
    expect(screen.queryByText('Hello?')).not.toBeInTheDocument();
  });

  it('loads earlier messages above the current ones', async () => {
    const message = (id: string, content: string, at: string) => ({ id, role: 'user', content, created_at: at });
    fetchCompanionHistory
      .mockResolvedValueOnce({ messages: [message('m2', 'Newer', '2026-10-09T10:00:00Z')], older_cursor: 'c1' })
      .mockResolvedValueOnce({ messages: [message('m1', 'Older', '2026-10-08T10:00:00Z')], older_cursor: null });
    render(<AICompanion />);
    await screen.findByText('Newer');
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));
    await screen.findByText('Older');
    expect(fetchCompanionHistory).toHaveBeenLastCalledWith('c1');
    const texts = screen.getAllByText(/Newer|Older/).map((el) => el.textContent);
    expect(texts).toEqual(['Older', 'Newer']);
    expect(screen.queryByRole('button', { name: 'Load earlier messages' })).not.toBeInTheDocument();
  });

  it('says so when earlier messages cannot be loaded', async () => {
    fetchCompanionHistory
      .mockResolvedValueOnce({ messages: [], older_cursor: 'c1' })
      .mockRejectedValueOnce(new Error('offline'));
    render(<AICompanion />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load earlier messages' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not load earlier messages: offline'));
  });

  it('explains rate limits', () => {
    expect(companionErrorMessage(new ApiError(429, "You've reached the hourly limit", 'rate_limited'))).toMatch(
      'hourly limit',
    );
  });
});
