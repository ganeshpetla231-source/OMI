import { getAllRecords, getRecord, putRecord, deleteRecord } from './db';
import { GUEST_MODE_KEY, GUEST_PROFILE_KEY, USER_KEY } from '../../utils/authStorage';

const PROFILE_KEY = 'profile';
const SETTINGS_KEY = 'userSettings';

export const DEFAULT_SETTINGS = {
  language: 'en',
  theme: 'system',
  interviewPreferences: {
    category: 'general',
    difficulty: 'beginner',
    duration: 15,
    questionCount: 5,
    style: 'standard',
    mode: 'text',
  },
  offline: { autoSync: true, keepRecordings: false },
  notifications: {},
};

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function getLocalProfile() {
  return (await getRecord('settings', PROFILE_KEY))?.value || storedUser() || {};
}

export async function saveLocalProfile(updates) {
  const profile = { ...(await getLocalProfile()), ...updates, updatedAt: new Date().toISOString() };
  await putRecord('settings', { key: PROFILE_KEY, value: profile });
  const currentUser = storedUser();
  if (currentUser && profile.id === currentUser.id) {
    localStorage.setItem(USER_KEY, JSON.stringify({ ...currentUser, ...profile }));
  }
  return profile;
}

function mergeSettings(current, updates) {
  return {
    ...current,
    ...updates,
    interviewPreferences: {
      ...current.interviewPreferences,
      ...(updates.interviewPreferences || {}),
    },
    offline: { ...current.offline, ...(updates.offline || {}) },
    notifications: { ...current.notifications, ...(updates.notifications || {}) },
  };
}

export async function getLocalSettings() {
  const browserDefaults = {
    language: localStorage.getItem('talkready_language') || DEFAULT_SETTINGS.language,
    theme: localStorage.getItem('talkready_theme') || DEFAULT_SETTINGS.theme,
  };
  return mergeSettings(
    { ...DEFAULT_SETTINGS, ...browserDefaults },
    (await getRecord('settings', SETTINGS_KEY))?.value || {},
  );
}

export async function saveLocalSettings(updates) {
  const settings = mergeSettings(await getLocalSettings(), updates);
  await putRecord('settings', { key: SETTINGS_KEY, value: settings });
  return settings;
}

const USER_STORES = ['interviews', 'answers', 'reports', 'notes', 'resumes', 'syncQueue', 'guest'];

export async function clearQuestionCache() {
  for (const store of ['questions', 'meta']) {
    for (const record of await getAllRecords(store)) {
      const key = record.id ?? record.key;
      if (key !== undefined) await deleteRecord(store, key);
    }
  }
}

export async function clearCurrentUserData({ includeQuestionCache = true } = {}) {
  for (const store of USER_STORES) {
    const records = await getAllRecords(store);
    for (const record of records) {
      const key = record.id ?? record.key;
      if (key !== undefined) await deleteRecord(store, key);
    }
  }

  const settings = await getAllRecords('settings');
  for (const setting of settings) {
    if (setting.key !== PROFILE_KEY && setting.key !== SETTINGS_KEY) {
      await deleteRecord('settings', setting.key);
    }
  }
  await deleteRecord('settings', PROFILE_KEY);
  await deleteRecord('settings', SETTINGS_KEY);

  if (includeQuestionCache) await clearQuestionCache();

  Object.keys(localStorage)
    .filter((key) => key.startsWith('talkready_interview_setup_'))
    .forEach((key) => localStorage.removeItem(key));
  if (localStorage.getItem(GUEST_MODE_KEY) === 'true') localStorage.removeItem(GUEST_PROFILE_KEY);
}
