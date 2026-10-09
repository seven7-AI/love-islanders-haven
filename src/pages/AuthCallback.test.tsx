import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthCallback, { getAuthRedirectError } from './AuthCallback';

let authState: Record<string, unknown>;
vi.mock('@/context/auth', () => ({ useAuth: () => authState }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/discover" element={<p>discover page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('getAuthRedirectError', () => {
  it('reads error_description from the hash', () => {
    expect(getAuthRedirectError('', '#error=access_denied&error_description=Email+link+is+invalid')).toBe('Email link is invalid');
  });

  it('reads error from the query string', () => {
    expect(getAuthRedirectError('?error=server_error', '')).toBe('server_error');
  });

  it('returns null when there is no error', () => {
    expect(getAuthRedirectError('', '#access_token=abc&type=signup')).toBeNull();
  });
});

describe('AuthCallback', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/auth/callback');
  });

  it('continues into the app once a session exists', async () => {
    authState = { session: { user: { id: 'u1' } }, loading: false };
    renderPage();
    await waitFor(() => expect(screen.getByText('discover page')).toBeInTheDocument());
  });

  it('reports an invalid link when no session was created', () => {
    authState = { session: null, loading: false };
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
  });

  it('waits while the session is being established', () => {
    authState = { session: null, loading: true };
    renderPage();
    expect(screen.getByLabelText('Signing you in')).toBeInTheDocument();
  });
});
