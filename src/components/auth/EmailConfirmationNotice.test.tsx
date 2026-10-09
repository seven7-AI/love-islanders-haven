import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import EmailConfirmationNotice from './EmailConfirmationNotice';

const resend = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { resend: (...args: unknown[]) => resend(...args) } },
}));

describe('EmailConfirmationNotice', () => {
  beforeEach(() => resend.mockReset());

  it('asks the auth provider to resend the confirmation email', async () => {
    resend.mockResolvedValue({ error: null });
    render(<EmailConfirmationNotice email="a@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Resend confirmation email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('new confirmation link to a@example.com');
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'a@example.com' }));
  });

  it('shows the provider error instead of claiming success', async () => {
    resend.mockResolvedValue({
      error: new Error('For security purposes, you can only request this after 60 seconds.'),
    });
    render(<EmailConfirmationNotice email="a@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Resend confirmation email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('60 seconds');
  });
});
