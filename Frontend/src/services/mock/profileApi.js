import { createApiError } from '../../utils/apiError';
import { getLocalProfile, saveLocalProfile } from '../offline/profileSettings';
import { getStoredUser } from '../../utils/authStorage';
import { mockAuthApi } from './authApi';

function currentProfile(profile) {
  const user = getStoredUser();
  return {
    ...(user || {}),
    ...(profile || {}),
    ...(user?.id ? { id: user.id } : {}),
    ...(user?.email ? { email: user.email } : {}),
    ...(user?.name ? { name: user.name } : {}),
  };
}

export const mockProfileApi = {
  async get() {
    return currentProfile(await getLocalProfile());
  },
  async update(updates) {
    return saveLocalProfile({ ...currentProfile(await getLocalProfile()), ...updates });
  },
  async updateSkills(skills) {
    return saveLocalProfile({ ...currentProfile(await getLocalProfile()), skills: [...skills] });
  },
  async updatePreferences(preferences) {
    const profile = currentProfile(await getLocalProfile());
    return saveLocalProfile({
      ...profile,
      preferences: { ...(profile.preferences || {}), ...preferences },
    });
  },
  async deleteAccount(password) {
    if (!getStoredUser()) {
      throw createApiError('Sign in before deleting an account.', 401, [], 'AUTH_REQUIRED');
    }
    return mockAuthApi.deleteAccount({ password });
  },
};
