import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InlineChatHeader from './InlineChatHeader';

const unmatch = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/lib/api/discovery', () => ({ unmatch: (id: string) => unmatch(id) }));
vi.mock('@/lib/api/safety', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/safety')>()),
  blockUser: vi.fn(),
  reportUser: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));

// Radix opens the menu from the keyboard in jsdom (its pointer handling needs real pointer events).
const openMenu = () => fireEvent.keyDown(screen.getByRole('button', { name: 'Chat options' }), { key: 'Enter' });

const openMenuItem = async (name: string) => {
  openMenu();
  fireEvent.click(await screen.findByRole('menuitem', { name }));
};

describe('InlineChatHeader unmatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ends the match after confirmation', async () => {
    unmatch.mockResolvedValue(undefined);
    const onUnmatched = vi.fn();
    render(
      <InlineChatHeader matchName="Amani" matchId="m1" partnerId="u2" onClose={vi.fn()} onUnmatched={onUnmatched} />,
    );
    await openMenuItem('Unmatch');
    expect(await screen.findByText('Unmatch Amani?')).toBeInTheDocument();
    expect(unmatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Unmatch' }));
    await waitFor(() => expect(onUnmatched).toHaveBeenCalled());
    expect(unmatch).toHaveBeenCalledWith('m1');
    expect(toastSuccess).toHaveBeenCalledWith('You unmatched Amani');
  });

  it('keeps the match and says why when unmatching fails', async () => {
    unmatch.mockRejectedValue(new Error('Match not found'));
    const onUnmatched = vi.fn();
    render(
      <InlineChatHeader matchName="Amani" matchId="m1" partnerId="u2" onClose={vi.fn()} onUnmatched={onUnmatched} />,
    );
    await openMenuItem('Unmatch');
    fireEvent.click(await screen.findByRole('button', { name: 'Unmatch' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Match not found'));
    expect(onUnmatched).not.toHaveBeenCalled();
  });

  it('has no unmatch option without a match', async () => {
    render(<InlineChatHeader matchName="Amani" partnerId="u2" onClose={vi.fn()} />);
    openMenu();
    await screen.findByRole('menuitem', { name: 'Block' });
    expect(screen.queryByRole('menuitem', { name: 'Unmatch' })).not.toBeInTheDocument();
  });
});
