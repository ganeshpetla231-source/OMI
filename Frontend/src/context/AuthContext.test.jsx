import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import { AuthContext, AuthProvider, useAuth } from './AuthContext';
import { LanguageProvider } from './LanguageContext';
import { GUEST_MODE_KEY, GUEST_PROFILE_KEY, TOKEN_KEY, USER_KEY } from '../utils/authStorage';
import { authApi } from '../services/api';

vi.mock('../services/api', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
    changePassword: vi.fn(),
  },
}));

function AuthControls() {
  const auth = useAuth();
  return (
    <div>
      <output>{auth.isAuthenticated ? 'Authenticated' : 'Not authenticated'}</output>
      <output>{auth.isGuest ? 'Guest' : 'Not guest'}</output>
      <button type="button" onClick={() => auth.continueAsGuest()}>Continue as guest</button>
      <button type="button" onClick={() => auth.register({ name: 'Sam User', email: 'sam@example.com', password: 'Secure123' })}>Register</button>
      <button type="button" onClick={() => auth.logout()}>Log out</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider><AuthControls /></AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

function renderAuthWithRoutes() {
  return render(
    <MemoryRouter initialEntries={['/private']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<p>Sign in after session expiry</p>} />
              <Route path="*" element={<AuthControls />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts a persistent guest session without making an auth API call', async () => {
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole('button', { name: 'Continue as guest' }));

    expect(screen.getByText('Guest')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(GUEST_PROFILE_KEY))).toEqual(expect.objectContaining({
      guestId: expect.any(String),
      createdAt: expect.any(String),
    }));
    expect(localStorage.getItem(GUEST_MODE_KEY)).toBe('true');
    expect(authApi.getMe).not.toHaveBeenCalled();
  });

  it('persists the returned account and token after registration', async () => {
    const user = userEvent.setup();
    const account = { id: 'user-1', name: 'Sam User', role: 'student' };
    authApi.register.mockResolvedValue({ user: account, token: 'mock-token' });
    renderAuth();
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Authenticated')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('mock-token');
    expect(JSON.parse(localStorage.getItem(USER_KEY))).toEqual(account);
  });

  it('restores a saved session through getMe on startup', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved-token');
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'user-2', name: 'Saved User' }));
    authApi.getMe.mockResolvedValue({ id: 'user-2', name: 'Restored User', role: 'student' });
    renderAuth();

    expect(await screen.findByText('Authenticated')).toBeInTheDocument();
    expect(authApi.getMe).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(USER_KEY)).name).toBe('Restored User');
  });

  it('keeps a cached account session available when the server is unreachable', async () => {
    const cachedUser = { id: 'user-offline', name: 'Offline User', role: 'student' };
    localStorage.setItem(TOKEN_KEY, 'saved-token');
    localStorage.setItem(USER_KEY, JSON.stringify(cachedUser));
    authApi.getMe.mockRejectedValue(Object.assign(new Error('Network unavailable'), { code: 'NETWORK_ERROR' }));
    renderAuth();

    expect(await screen.findByText('Authenticated')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(USER_KEY))).toEqual(cachedUser);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears an expired token, announces the session expiry, and redirects to sign in', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'expired-user', name: 'Expired User' }));
    authApi.getMe.mockRejectedValue(Object.assign(new Error('Session expired, please log in again.'), { status: 401 }));
    renderAuthWithRoutes();

    expect(await screen.findByText('Sign in after session expiry')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Session expired');
  });

  it('clears local auth state and reports a remote logout failure', async () => {
    const user = userEvent.setup();
    localStorage.setItem(TOKEN_KEY, 'saved-token');
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'user-3', name: 'Saved User' }));
    authApi.getMe.mockResolvedValue({ id: 'user-3', name: 'Saved User', role: 'student' });
    authApi.logout.mockRejectedValue(new Error('Network failed'));
    renderAuth();
    await screen.findByText('Authenticated');
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBeNull());
    expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You were signed out on this device');
  });
});


