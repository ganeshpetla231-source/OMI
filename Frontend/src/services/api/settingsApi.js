import { apiClient } from './client';
import { clearCurrentUserData, clearQuestionCache, getLocalSettings, saveLocalSettings } from '../offline/profileSettings';
import { GUEST_MODE_KEY, getStoredToken } from '../../utils/authStorage';
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

function settingsFrom(response) {
  const settings = response.data?.settings || response.data;
  if (!settings || typeof settings !== 'object') throw new Error('The server returned invalid settings.');
  return settings;
}

async function clearDataLocally() {
  await clearCurrentUserData();
  localStorage.removeItem('talkready_language');
  localStorage.removeItem('talkready_theme');
  return { message: 'Local data was cleared.' };
}

function shouldQueueLocalChanges() {
  return localStorage.getItem(GUEST_MODE_KEY) !== 'true'
    && Boolean(getStoredToken())
    && import.meta.env.VITE_USE_MOCK !== 'true';
}

async function updateLocally(updates, queue = false) {
  const settings = await saveLocalSettings(updates);
  if (queue && shouldQueueLocalChanges()) {
    await enqueueSyncOperation('settings.update', { updates }, {
      idempotencyKey: `settings.update:${Date.now()}:${globalThis.crypto?.randomUUID?.() || ''}`,
    });
  }
  return settings;
}

export const realSettingsApi = {
  async get() {
    const settings = settingsFrom(await apiClient.get('/settings'));
    await saveLocalSettings(settings);
    return settings;
  },
  async update(updates) {
    const settings = settingsFrom(await apiClient.put('/settings', updates));
    await saveLocalSettings(settings);
    return settings;
  },
  async deleteData() {
    const result = await apiClient.delete('/settings/data', { data: { confirm: 'DELETE' } });
    await clearDataLocally();
    return result.data;
  },
};

export const mockSettingsApi = {
  get: getLocalSettings,
  update: updateLocally,
  async deleteData() {
    return clearDataLocally();
  },
};

async function call(method, args) {
  if (method === 'deleteData' && shouldQueueLocalChanges() && !navigator.onLine) {
    throw new Error('Connect to the internet before deleting your server data.');
  }
  if (localOnly()) return method === 'update'
    ? updateLocally(args[0], true)
    : mockSettingsApi[method](...args);
  try {
    return await realSettingsApi[method](...args);
  } catch (error) {
    if (!shouldFallback(error) || method === 'deleteData') throw error;
    return method === 'update' ? updateLocally(args[0], true) : mockSettingsApi[method](...args);
  }
}

export const settingsApi = {
  get: () => call('get', []),
  update: (updates) => call('update', [updates]),
  deleteData: () => call('deleteData', []),
  clearLocalData: clearDataLocally,
  clearQuestionCache,
};
