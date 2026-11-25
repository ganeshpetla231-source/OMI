import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, setUnauthorizedHandler } from './client';
import { TOKEN_KEY } from '../../utils/authStorage';

const originalAdapter = apiClient.defaults.adapter;

function respondWithUnauthorized(config) {
  return Promise.reject({
    config,
    response: {
      config,
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      data: { success: false, message: 'Invalid email or password.', errors: [] },
    },
  });
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  setUnauthorizedHandler(null);
  localStorage.clear();
});

describe('API client auth handling', () => {
  it('does not treat failed login credentials as an expired session', async () => {
    const unauthorizedHandler = vi.fn();
    apiClient.defaults.adapter = respondWithUnauthorized;
    setUnauthorizedHandler(unauthorizedHandler);

    await expect(apiClient.post('/auth/login', { email: 'bad@example.com', password: 'bad' }))
      .rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' });

    expect(unauthorizedHandler).not.toHaveBeenCalled();
  });

  it('clears and redirects an expired authenticated session', async () => {
    const unauthorizedHandler = vi.fn();
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    apiClient.defaults.adapter = respondWithUnauthorized;
    setUnauthorizedHandler(unauthorizedHandler);

    await expect(apiClient.get('/auth/me')).rejects.toMatchObject({ status: 401 });

    expect(unauthorizedHandler).toHaveBeenCalledOnce();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
