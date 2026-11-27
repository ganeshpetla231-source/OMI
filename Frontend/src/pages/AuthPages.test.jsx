import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { OfflineProvider } from '../context/OfflineContext';
import { ThemeProvider } from '../context/ThemeContext';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';

vi.mock('../services/api/client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { status: 'ok' } }) },
}));

function renderAuthPage(path, page, auth) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <OfflineProvider>
              <AuthContext.Provider value={auth}>
                <Routes>
                  <Route path={path} element={page} />
                  <Route path="/" element={<p>Home landing</p>} />
                </Routes>
              </AuthContext.Provider>
            </OfflineProvider>
          </MemoryRouter>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>,
  );
}

describe('authentication pages', () => {
  beforeEach(() => localStorage.clear());

  it('submits valid login credentials and navigates to the landing page', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ id: 'user-1' });
    renderAuthPage('/login', <LoginPage />, {
      login,
      continueAsGuest: vi.fn(),
      isAuthenticated: false,
      isGuest: false,
      user: null,
    });

    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secure123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Home landing')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({ email: 'sam@example.com', password: 'Secure123' });
  });

  it('shows the server message for invalid login credentials', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(Object.assign(new Error('Invalid email or password.'), { status: 401, errors: [] }));
    renderAuthPage('/login', <LoginPage />, {
      login,
      continueAsGuest: vi.fn(),
      isAuthenticated: false,
      isGuest: false,
      user: null,
    });

    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('shows registration field errors on submit and validates on blur', async () => {
    const user = userEvent.setup();
    renderAuthPage('/register', <RegisterPage />, {
      register: vi.fn(),
      continueAsGuest: vi.fn(),
      isAuthenticated: false,
      isGuest: false,
      user: null,
    });

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Name must be between 2 and 60 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();

    const nameInput = screen.getByRole('textbox', { name: 'Full name' });
    await user.type(nameInput, 'A');
    fireEvent.blur(nameInput);
    expect(screen.getByText('Name must be between 2 and 60 characters.')).toBeInTheDocument();
  });

  it('registers and continues into an authenticated session', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue({ id: 'new-user' });
    renderAuthPage('/register', <RegisterPage />, {
      register,
      continueAsGuest: vi.fn(),
      isAuthenticated: false,
      isGuest: false,
      user: null,
    });

    await user.type(screen.getByRole('textbox', { name: 'Full name' }), 'Sam User');
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secure123');
    await user.type(screen.getByLabelText('Confirm password'), 'Secure123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Home landing')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith({ name: 'Sam User', email: 'sam@example.com', password: 'Secure123' });
  });
});
