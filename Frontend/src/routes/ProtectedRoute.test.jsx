import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { AdminRoute, GuestOrAuthRoute, ProtectedRoute } from './ProtectedRoute';

const noSession = { isAuthenticated: false, isGuest: false, user: null };

function renderGuard(initialEntry, guard, value = noSession) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<p>Sign in page</p>} />
          <Route path="/403" element={<p>Forbidden page</p>} />
          <Route path="/dashboard" element={<p>Dashboard page</p>} />
          <Route path="/private" element={guard} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('route guards', () => {
  beforeEach(() => localStorage.clear());

  it('redirects an account-only route to sign in and preserves its destination', () => {
    renderGuard('/private', <ProtectedRoute><p>Private page</p></ProtectedRoute>);
    expect(screen.getByText('Sign in page')).toBeInTheDocument();
    expect(screen.queryByText('Private page')).not.toBeInTheDocument();
  });

  it('allows the guest-or-account route for a guest', () => {
    renderGuard('/private', <GuestOrAuthRoute><p>Guest-ready page</p></GuestOrAuthRoute>, { ...noSession, isGuest: true });
    expect(screen.getByText('Guest-ready page')).toBeInTheDocument();
  });

  it('redirects a guest-disallowed route to sign in', () => {
    renderGuard('/private', <GuestOrAuthRoute><p>Guest-ready page</p></GuestOrAuthRoute>);
    expect(screen.getByText('Sign in page')).toBeInTheDocument();
  });

  it('redirects a non-admin account to the 403 page', () => {
    renderGuard('/private', <AdminRoute><p>Admin page</p></AdminRoute>, {
      ...noSession,
      isAuthenticated: true,
      user: { role: 'student' },
    });
    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
  });

  it('allows an admin account to open admin content', () => {
    renderGuard('/private', <AdminRoute><p>Admin page</p></AdminRoute>, {
      ...noSession,
      isAuthenticated: true,
      user: { role: 'admin' },
    });
    expect(screen.getByText('Admin page')).toBeInTheDocument();
  });

  it('renders account-only content for an authenticated account', () => {
    renderGuard('/private', <ProtectedRoute><p>Private page</p></ProtectedRoute>, {
      ...noSession,
      isAuthenticated: true,
      user: { role: 'student' },
    });
    expect(screen.getByText('Private page')).toBeInTheDocument();
  });
});
