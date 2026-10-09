import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

const resetPassword = vi.fn();
vi.mock('@/context/auth', () => ({ useAuth: () => ({ resetPassword }) }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  );
const submit = (email: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
};

describe('ForgotPassword', () => {
  beforeEach(() => resetPassword.mockReset());

  it('rejects an invalid email without calling the auth provider', async () => {
    renderPage();
    submit('nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('valid email');
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('shows the same message whether or not the account exists', async () => {
    resetPassword.mockResolvedValue({});
    renderPage();
    submit('someone@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists for someone@example.com');
    expect(resetPassword).toHaveBeenCalledWith('someone@example.com');
  });

  it('surfaces provider errors instead of reporting success', async () => {
    resetPassword.mockResolvedValue({ error: new Error('Email rate limit exceeded') });
    renderPage();
    submit('someone@example.com');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email rate limit exceeded');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
