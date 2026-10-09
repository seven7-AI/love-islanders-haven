import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api/client';
import ReportUserDialog from './ReportUserDialog';

const reportUser = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/lib/api/safety', () => ({ reportUser: (r: unknown) => reportUser(r) }));
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));

const setup = () => {
  const onOpenChange = vi.fn();
  const onBlocked = vi.fn();
  render(<ReportUserDialog open onOpenChange={onOpenChange} userId="user-42" userName="Jamie" onBlocked={onBlocked} />);
  return { onOpenChange, onBlocked };
};

describe('ReportUserDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('needs a reason before it can be sent', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
  });

  it('sends reason, details and also_block, then reports the block', async () => {
    reportUser.mockResolvedValue({ id: 'r1' });
    const { onBlocked, onOpenChange } = setup();

    fireEvent.click(screen.getByLabelText('Fake profile'));
    fireEvent.change(screen.getByLabelText('Details (optional)'), { target: { value: '  Uses stock photos  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() =>
      expect(reportUser).toHaveBeenCalledWith({
        user_id: 'user-42',
        reason: 'fake_profile',
        details: 'Uses stock photos',
        also_block: true,
      }),
    );
    await waitFor(() => expect(onBlocked).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('omits empty details and does not block when "also block" is unticked', async () => {
    reportUser.mockResolvedValue({ id: 'r2' });
    const { onBlocked } = setup();

    fireEvent.click(screen.getByLabelText('Spam or scam'));
    fireEvent.click(screen.getByLabelText('Also block Jamie'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(reportUser).toHaveBeenCalledWith({ user_id: 'user-42', reason: 'spam', also_block: false }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('shows the API error and keeps the dialog open when the report fails', async () => {
    reportUser.mockRejectedValue(new ApiError(429, 'Too many reports'));
    const { onBlocked, onOpenChange } = setup();

    fireEvent.click(screen.getByLabelText('Harassment or threats'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Too many reports'));
    expect(onBlocked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
