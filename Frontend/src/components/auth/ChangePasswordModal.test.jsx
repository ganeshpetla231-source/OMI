import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ui/Toast';
import { AuthContext } from '../../context/AuthContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { ChangePasswordModal } from './ChangePasswordModal';

describe('ChangePasswordModal', () => {
  it('validates, submits the new password, and closes on success', async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn().mockResolvedValue({ token: 'replacement-token' });
    const onClose = vi.fn();
    render(
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthContext.Provider value={{ changePassword }}>
              <ChangePasswordModal open onClose={onClose} />
            </AuthContext.Provider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>,
    );

    await user.type(screen.getByLabelText('Current password'), 'Current123');
    await user.type(screen.getByLabelText('New password'), 'Better456');
    await user.type(screen.getByLabelText('Confirm password'), 'Better456');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'Current123', newPassword: 'Better456' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Your password was updated.');
  });
});
