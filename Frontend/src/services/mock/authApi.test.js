import { beforeEach, describe, expect, it } from 'vitest';
import { mockAuthApi } from './authApi';
import { TOKEN_KEY } from '../../utils/authStorage';

describe('mockAuthApi', () => {
  beforeEach(() => localStorage.clear());

  it('validates registration and reports duplicate email consistently', async () => {
    await expect(mockAuthApi.register({ name: 'S', email: 'bad', password: 'short' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'password' }),
      ]),
    });

    await mockAuthApi.register({ name: 'Sam User', email: 'sam@example.com', password: 'Secure123' });
    await expect(mockAuthApi.register({ name: 'Another User', email: 'SAM@example.com', password: 'Secure123' }))
      .rejects.toMatchObject({ status: 409, code: 'DUPLICATE_EMAIL' });
  });

  it('supports registration, session restoration, login, and password change without storing a plain password', async () => {
    const registered = await mockAuthApi.register({
      name: 'Sam User',
      email: 'sam@example.com',
      password: 'Secure123',
    });
    const storedMockUser = JSON.parse(localStorage.getItem('talkready_mock_users'))[0];
    expect(storedMockUser).not.toHaveProperty('password');
    expect(storedMockUser.passwordDigest).not.toBe('Secure123');
    localStorage.setItem(TOKEN_KEY, registered.token);

    await expect(mockAuthApi.getMe()).resolves.toMatchObject({ id: registered.user.id, email: 'sam@example.com' });
    const login = await mockAuthApi.login({ email: 'SAM@example.com', password: 'Secure123' });
    expect(login.user.id).toBe(registered.user.id);

    const changed = await mockAuthApi.changePassword({ currentPassword: 'Secure123', newPassword: 'NewSecure456' });
    localStorage.setItem(TOKEN_KEY, changed.token);
    await expect(mockAuthApi.login({ email: 'sam@example.com', password: 'NewSecure456' })).resolves.toMatchObject({
      user: { id: registered.user.id },
    });
    await expect(mockAuthApi.login({ email: 'sam@example.com', password: 'Secure123' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password.',
    });
  });

  it('returns the same credential error for an unknown email and a wrong password', async () => {
    await mockAuthApi.register({ name: 'Sam User', email: 'sam@example.com', password: 'Secure123' });
    const unknownEmail = mockAuthApi.login({ email: 'other@example.com', password: 'Secure123' });
    const wrongPassword = mockAuthApi.login({ email: 'sam@example.com', password: 'WrongPass1' });

    await Promise.all([
      expect(unknownEmail).rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' }),
      expect(wrongPassword).rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' }),
    ]);
  });
});
