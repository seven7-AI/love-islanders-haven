import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@/lib/api/client';
import type { SafetyContact } from '@/lib/api/safety';
import EmergencyButton from './EmergencyButton';

const sendEmergencyAlert = vi.fn();

vi.mock('@/lib/api/safety', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/safety')>()),
  sendEmergencyAlert: (a: unknown) => sendEmergencyAlert(a),
}));

const contacts: SafetyContact[] = [
  { id: 'c1', name: 'Sam', phone: '+447700900001', email: null, is_primary: false },
  { id: 'c2', name: 'Alex', phone: '+447700900002', email: 'alex@example.com', is_primary: true },
];

const openAndSend = async () => {
  fireEvent.click(screen.getByRole('button', { name: /emergency alert/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Send Alert' }));
};

describe('EmergencyButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says alerts are not set up on 503 and never claims contacts were notified', async () => {
    sendEmergencyAlert.mockRejectedValue(
      new ApiError(503, 'Emergency alerts are not configured', 'alerts_not_configured'),
    );
    render(<EmergencyButton contacts={contacts} />);
    await openAndSend();

    expect(await screen.findByText("Emergency alerts aren't set up yet")).toBeInTheDocument();
    expect(screen.getByText(/call your local emergency number/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /call emergency services/i })[0]).toHaveAttribute('href', 'tel:112');
    // Manual fallback goes to the primary contact
    expect(screen.getByRole('link', { name: /text alex/i }).getAttribute('href')).toMatch(/^sms:\+447700900002\?body=/);
    expect(screen.getByRole('link', { name: /email alex/i }).getAttribute('href')).toMatch(/^mailto:alex@example\.com/);
    expect(screen.queryByText(/notified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alert sent/i)).not.toBeInTheDocument();
  });

  it('shows the API error for other failures without claiming success', async () => {
    sendEmergencyAlert.mockRejectedValue(new ApiError(500, 'Internal error'));
    render(<EmergencyButton contacts={contacts} />);
    await openAndSend();

    expect(await screen.findByText(/Internal error/)).toBeInTheDocument();
    expect(screen.queryByText(/notified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alert sent/i)).not.toBeInTheDocument();
  });

  it('confirms only when the API accepted the alert', async () => {
    sendEmergencyAlert.mockResolvedValue({});
    render(<EmergencyButton contacts={contacts} />);
    await openAndSend();

    expect(await screen.findByText('Alert sent to your safety contacts.')).toBeInTheDocument();
    expect(sendEmergencyAlert).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});
