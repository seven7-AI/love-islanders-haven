import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Moderation from './Moderation';
import { ApiError } from '@/lib/api/client';
import type { ModerationReport } from '@/lib/api/moderation';

const roles = vi.hoisted(() => ({ isModerator: true, loading: false, error: null as string | null }));
const listReports = vi.fn();
const reviewReport = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/hooks/use-roles', () => ({ useRoles: () => roles }));
vi.mock('@/lib/api/moderation', () => ({
  listReports: (o: unknown) => listReports(o),
  reviewReport: (id: string, body: unknown) => reviewReport(id, body),
}));
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));

const report = (overrides: Partial<ModerationReport> = {}): ModerationReport => ({
  id: 'r1',
  reason: 'harassment',
  details: 'Kept messaging after I said stop.',
  status: 'open',
  created_at: '2026-10-10T09:00:00Z',
  reporter: { id: 'u1', name: 'Lydia', photo_url: null },
  reported: { id: 'u2', name: 'Eric', photo_url: null, reports_against: 2 },
  reviewed_by: null,
  reviewed_at: null,
  resolution_note: null,
  ...overrides,
});

describe('Moderation page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(roles, { isModerator: true, loading: false, error: null });
    listReports.mockResolvedValue({ reports: [report()], next_cursor: null });
  });

  it('lists open reports with their context', async () => {
    render(<Moderation />);
    const item = await screen.findByRole('listitem');
    expect(within(item).getByText('Harassment or threats')).toBeInTheDocument();
    expect(within(item).getByText('Eric')).toBeInTheDocument();
    expect(within(item).getByText('2 reports')).toBeInTheDocument();
    expect(within(item).getByText('Lydia')).toBeInTheDocument();
    expect(within(item).getByText(/Kept messaging/)).toBeInTheDocument();
    expect(listReports).toHaveBeenCalledWith({ status: 'open' });
  });

  it('filters by status', async () => {
    render(<Moderation />);
    await screen.findByRole('listitem');
    listReports.mockResolvedValue({ reports: [], next_cursor: null });
    fireEvent.click(screen.getByRole('radio', { name: 'Resolved' }));
    expect(await screen.findByText('No resolved reports.')).toBeInTheDocument();
    expect(listReports).toHaveBeenLastCalledWith({ status: 'resolved' });
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(listReports).toHaveBeenLastCalledWith({ status: null }));
  });

  it('resolves a report with a note and takes it off the open queue', async () => {
    reviewReport.mockResolvedValue(
      report({ status: 'resolved', resolution_note: 'Warned the user.', reviewed_at: '2026-10-10T10:00:00Z' }),
    );
    render(<Moderation />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  Warned the user.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await waitFor(() =>
      expect(reviewReport).toHaveBeenCalledWith('r1', { status: 'resolved', resolution_note: 'Warned the user.' }),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Report marked resolved');
    expect(await screen.findByText('No open reports.')).toBeInTheDocument();
  });

  it('keeps the report and says why when saving fails', async () => {
    reviewReport.mockRejectedValue(
      new ApiError(403, 'You cannot review a report that involves you', 'conflict_of_interest'),
    );
    render(<Moderation />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('You cannot review a report that involves you'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(reviewReport).toHaveBeenCalledWith('r1', { status: 'dismissed' });
  });

  it('shows the access message when the role is revoked mid-session', async () => {
    listReports.mockRejectedValue(new ApiError(403, 'Moderator access required', 'forbidden'));
    render(<Moderation />);
    expect(await screen.findByText('Moderators only')).toBeInTheDocument();
  });

  it('offers a retry when the queue cannot be loaded', async () => {
    listReports.mockRejectedValueOnce(new Error('Network down'));
    render(<Moderation />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('listitem')).toBeInTheDocument();
  });

  it('loads more pages', async () => {
    listReports
      .mockResolvedValueOnce({ reports: [report()], next_cursor: 'c1' })
      .mockResolvedValueOnce({ reports: [report({ id: 'r2', reason: 'spam' })], next_cursor: null });
    render(<Moderation />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Spam or scam')).toBeInTheDocument();
    expect(listReports).toHaveBeenLastCalledWith({ status: 'open', cursor: 'c1' });
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('does not load reports for regular users', async () => {
    roles.isModerator = false;
    render(<Moderation />);
    expect(screen.getByText('Moderators only')).toBeInTheDocument();
    expect(listReports).not.toHaveBeenCalled();
  });
});
