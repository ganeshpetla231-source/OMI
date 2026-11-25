import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { profileApi } from './profileApi';
import { settingsApi } from './settingsApi';
import { apiClient } from './client';
import { enqueueSyncOperation } from '../offline/syncQueue';
import { mockProfileApi } from '../mock/profileApi';
import { saveLocalSettings } from '../offline/profileSettings';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../offline/syncQueue', () => ({ enqueueSyncOperation: vi.fn() }));
vi.mock('../offline/profileSettings', () => ({
  saveLocalProfile: vi.fn(async (profile) => profile),
  clearCurrentUserData: vi.fn(),
  clearQuestionCache: vi.fn(),
  getLocalSettings: vi.fn(async () => ({
    language: 'en',
    theme: 'system',
    interviewPreferences: {},
    offline: { autoSync: true },
  })),
  saveLocalSettings: vi.fn(async (updates) => ({
    language: 'en',
    theme: 'system',
    interviewPreferences: {},
    offline: { autoSync: true },
    ...updates,
  })),
}));

vi.mock('../mock/profileApi', () => ({
  mockProfileApi: {
    get: vi.fn(),
    update: vi.fn(),
    updateSkills: vi.fn(),
    updatePreferences: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

describe('profile and settings API offline synchronization', () => {
  const initialOnline = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_USE_MOCK', 'false');
    localStorage.clear();
    localStorage.setItem('talkready_token', 'signed-in-token');
    localStorage.setItem('talkready_user', JSON.stringify({ id: 'student-1' }));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    enqueueSyncOperation.mockResolvedValue({});
    mockProfileApi.update.mockResolvedValue({ id: 'student-1', name: 'Updated' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: initialOnline });
  });

  it('saves profile changes locally and queues them after a network failure', async () => {
    const networkError = new Error('offline');
    networkError.code = 'NETWORK_ERROR';
    apiClient.put.mockRejectedValue(networkError);

    await profileApi.update({ name: 'Updated' });

    expect(mockProfileApi.update).toHaveBeenCalledWith({ name: 'Updated' });
    expect(enqueueSyncOperation).toHaveBeenCalledWith(
      'profile.update',
      { updates: { name: 'Updated' } },
      expect.objectContaining({ idempotencyKey: expect.stringContaining('profile.update:') }),
    );
  });

  it('queues signed-in settings updates made while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await settingsApi.update({ offline: { autoSync: false } });

    expect(saveLocalSettings).toHaveBeenCalledWith({ offline: { autoSync: false } });
    expect(enqueueSyncOperation).toHaveBeenCalledWith(
      'settings.update',
      { updates: { offline: { autoSync: false } } },
      expect.objectContaining({ idempotencyKey: expect.stringContaining('settings.update:') }),
    );
  });

  it('does not report server data deletion as successful while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await expect(settingsApi.deleteData()).rejects.toThrow('Connect to the internet');

    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(enqueueSyncOperation).not.toHaveBeenCalled();
  });
});
