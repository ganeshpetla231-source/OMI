import { GUEST_PROFILE_KEY } from '../../utils/authStorage';

export function createGuestProfile() {
  const existing = readGuestProfile();
  if (existing) return existing;
  const profile = {
    guestId: globalThis.crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function readGuestProfile() {
  try {
    const value = localStorage.getItem(GUEST_PROFILE_KEY);
    if (!value) return null;
    const profile = JSON.parse(value);
    return typeof profile?.guestId === 'string' && typeof profile?.createdAt === 'string' ? profile : null;
  } catch {
    return null;
  }
}
