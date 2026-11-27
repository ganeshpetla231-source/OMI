export const TOKEN_KEY = 'talkready_token';
export const USER_KEY = 'talkready_user';
export const GUEST_MODE_KEY = 'talkready_guest_mode';
export const GUEST_PROFILE_KEY = 'talkready_guest_profile';

export function getStoredUser() {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveAuth({ user, token }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(GUEST_MODE_KEY);
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

