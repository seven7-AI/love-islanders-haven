import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResetPassword from './ResetPassword';

const updatePassword = vi.fn();
let authState: Record<string, unknown>;
vi.mock('@/context/auth', () => ({ useAuth: () => ({ ...authState, updatePassword }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/discover" element={<p>discover page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const fill = (password: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
};

describe('ResetPassword', () => {
  beforeEach(() => {
    updatePassword.mockReset();
    authState = { session: { user: { id: 'u1' } }, loading: false, passwordRecovery: true };
  });

  it('refuses to show the form without a recovery session', () => {
    authState = { session: null, loading: false, passwordRecovery: false };
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('refuses to show the form for a normal (non-recovery) session', () => {
    authState = { session: { user: { id: 'u1' } }, loading: false, passwordRecovery: false };
    renderPage();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('validates that the passwords match', async () => {
    renderPage();
    fill('secret12', 'secret13');
    expect(await screen.findByRole('alert')).toHaveTextContent("Passwords don't match");
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password and continues into the app', async () => {
    updatePassword.mockResolvedValue({});
    renderPage();
    fill('secret12', 'secret12');
    await waitFor(() => expect(screen.getByText('discover page')).toBeInTheDocument());
    expect(updatePassword).toHaveBeenCalledWith('secret12');
  });

  it('shows provider errors and stays on the page', async () => {
    updatePassword.mockResolvedValue({ error: new Error('New password should be different from the old password.') });
    renderPage();
    fill('secret12', 'secret12');
    expect(await screen.findByRole('alert')).toHaveTextContent('should be different');
    expect(screen.queryByText('discover page')).not.toBeInTheDocument();
  });
});
