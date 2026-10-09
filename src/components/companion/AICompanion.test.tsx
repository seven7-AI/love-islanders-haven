import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AICompanion, { companionErrorMessage } from './AICompanion';
import { ApiError } from '@/lib/api/client';

const fetchCompanionHistory = vi.fn();
const sendCompanionMessage = vi.fn();
const toastError = vi.fn();
vi.mock('@/lib/api/companion', () => ({
  fetchCompanionHistory: () => fetchCompanionHistory(),
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

  it('explains rate limits', () => {
    expect(companionErrorMessage(new ApiError(429, "You've reached the hourly limit", 'rate_limited'))).toMatch(
      'hourly limit',
    );
  });
});
