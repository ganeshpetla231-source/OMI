import { apiClient } from './client';
import { saveLocalProfile } from '../offline/profileSettings';
import { GUEST_MODE_KEY, getStoredToken } from '../../utils/authStorage';
import { mockProfileApi } from '../mock/profileApi';
import { enqueueSyncOperation } from '../offline/syncQueue';

function localOnly() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true'
    || !getStoredToken()
    || !navigator.onLine
    || import.meta.env.VITE_USE_MOCK === 'true';
}

function shouldFallback(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500;
}

function shouldQueueLocalChanges() {
  return localStorage.getItem(GUEST_MODE_KEY) !== 'true'
    && Boolean(getStoredToken())
    && import.meta.env.VITE_USE_MOCK !== 'true';
}

async function localCall(method, args, queue = false) {
  const result = await mockProfileApi[method](...args);
  if (!queue || !shouldQueueLocalChanges()) return result;
  const types = {
    update: 'profile.update',
    updateSkills: 'profile.skills',
    updatePreferences: 'profile.preferences',
  };
  const type = types[method];
  if (type) {
    await enqueueSyncOperation(type, {
      ...(method === 'update' ? { updates: args[0] } : {}),
      ...(method === 'updateSkills' ? { skills: args[0] } : {}),
      ...(method === 'updatePreferences' ? { preferences: args[0] } : {}),
    }, { idempotencyKey: `${type}:${Date.now()}:${globalThis.crypto?.randomUUID?.() || ''}` });
  }
  return result;
}

function profileFrom(response) {
  const profile = response.data?.profile || response.data?.user || response.data;
  if (!profile || typeof profile !== 'object') throw new Error('The server returned an invalid profile.');
  return profile;
}

export const realProfileApi = {
  async get() {
    const profile = profileFrom(await apiClient.get('/profile'));
    await saveLocalProfile(profile);
    return profile;
  },
  async update(updates) {
    const profile = profileFrom(await apiClient.put('/profile', updates));
    await saveLocalProfile(profile);
    return profile;
  },
  async updateSkills(skills) {
    const profile = profileFrom(await apiClient.put('/profile/skills', { skills }));
    await saveLocalProfile(profile);
    return profile;
  },
  async updatePreferences(preferences) {
    const profile = profileFrom(await apiClient.put('/profile/preferences', preferences));
    await saveLocalProfile(profile);
    return profile;
  },
  async deleteAccount(password) {
    const result = await apiClient.delete('/profile', { data: { password } });
    return result.data;
  },
};

async function call(method, args) {
  if (localOnly()) {
    if (method === 'deleteAccount' && shouldQueueLocalChanges()) {
      throw new Error('Connect to the internet before deleting your account.');
    }
    return localCall(method, args, method !== 'get' && method !== 'deleteAccount');
  }
  try {
    return await realProfileApi[method](...args);
  } catch (error) {
    if (!shouldFallback(error)) throw error;
    if (method === 'deleteAccount') throw error;
    return localCall(method, args, method !== 'get');
  }
}

export const profileApi = {
  get: () => call('get', []),
  update: (payload) => call('update', [payload]),
  updateSkills: (skills) => call('updateSkills', [skills]),
  updatePreferences: (preferences) => call('updatePreferences', [preferences]),
  deleteAccount: (password) => call('deleteAccount', [password]),
};
