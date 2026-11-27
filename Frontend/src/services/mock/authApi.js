import { UserRole } from '../../config/constants';
import { TOKEN_KEY } from '../../utils/authStorage';
import { createApiError } from '../../utils/apiError';
import { validateEmail, validateName, validatePassword } from '../../utils/authValidation';

const USERS_KEY = 'talkready_mock_users';

function readUsers() {
  const saved = localStorage.getItem(USERS_KEY);
  if (!saved) return [];
  try {
    const users = JSON.parse(saved);
    if (!Array.isArray(users)) throw new Error('Expected an array of mock users.');
    return users;
  } catch {
    throw createApiError('Saved mock account data is invalid. Clear this browser’s TalkReady data and try again.', 500, [], 'MOCK_STORAGE_ERROR');
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function createPasswordSalt() {
  return [...globalThis.crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function passwordDigest(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw createApiError('Secure browser storage is unavailable. Use a secure browser context to use mock authentication.', 500, [], 'CRYPTO_UNAVAILABLE');
  }
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g), (part) => Number.parseInt(part, 16));
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 120_000, hash: 'SHA-256' },
    key,
    256,
  );
  const digest = new Uint8Array(bits);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toUser(record) {
  const user = { ...record };
  delete user.passwordDigest;
  return user;
}

function registrationErrors(payload) {
  const errors = [];
  const name = validateName(payload.name || '');
  const email = validateEmail(payload.email || '');
  const password = validatePassword(payload.password || '');
  if (name) errors.push({ field: 'name', message: 'Name must be between 2 and 60 characters.' });
  if (email) errors.push({ field: 'email', message: 'Enter a valid email address.' });
  if (password) errors.push({ field: 'password', message: 'Password must be at least 8 characters and include a letter and a number.' });
  return errors;
}

function requireLoginFields(payload) {
  const errors = [];
  if (validateEmail(payload.email || '')) errors.push({ field: 'email', message: 'Enter a valid email address.' });
  if (!payload.password) errors.push({ field: 'password', message: 'Password is required.' });
  if (errors.length) throw createApiError('Validation failed.', 400, errors, 'VALIDATION_ERROR');
}

function makeToken(userId) {
  return `mock.${userId}.${globalThis.crypto.randomUUID()}`;
}

export const mockAuthApi = {
  async register(payload) {
    const errors = registrationErrors(payload);
    if (errors.length) throw createApiError('Validation failed.', 400, errors, 'VALIDATION_ERROR');

    const users = readUsers();
    const email = payload.email.trim().toLowerCase();
    if (users.some((user) => user.email === email)) {
      throw createApiError('An account with this email already exists.', 409, [], 'DUPLICATE_EMAIL');
    }

    const now = new Date().toISOString();
    const user = {
      id: globalThis.crypto.randomUUID(),
      name: payload.name.trim(),
      email,
      role: UserRole.STUDENT,
      education: '',
      experience: '',
      jobRole: '',
      careerGoal: '',
      skills: [],
      preferences: {},
      createdAt: now,
      updatedAt: now,
    };
    const passwordSalt = createPasswordSalt();
    users.push({ ...user, passwordSalt, passwordDigest: await passwordDigest(payload.password, passwordSalt) });
    writeUsers(users);
    return { user, token: makeToken(user.id) };
  },

  async login(payload) {
    requireLoginFields(payload);
    const email = payload.email.trim().toLowerCase();
    const user = readUsers().find((record) => record.email === email);
    const digest = await passwordDigest(payload.password, user?.passwordSalt || '00000000000000000000000000000000');
    if (!user || user.passwordDigest !== digest) {
      throw createApiError('Invalid email or password.', 401, [], 'INVALID_CREDENTIALS');
    }
    return { user: toUser(user), token: makeToken(user.id) };
  },

  async logout() {
    return { message: 'Logged out successfully.' };
  },

  async getMe() {
    const token = localStorage.getItem(TOKEN_KEY);
    const userId = token?.split('.')[1];
    const user = userId ? readUsers().find((record) => record.id === userId) : null;
    if (!user || !token.startsWith('mock.')) {
      throw createApiError('Session expired, please log in again.', 401, [], 'SESSION_EXPIRED');
    }
    return toUser(user);
  },

  async changePassword(payload) {
    const token = localStorage.getItem(TOKEN_KEY);
    const userId = token?.split('.')[1];
    const users = readUsers();
    const index = users.findIndex((record) => record.id === userId);
    if (index < 0 || !token?.startsWith('mock.')) {
      throw createApiError('Session expired, please log in again.', 401, [], 'SESSION_EXPIRED');
    }
    const errors = [];
    if (!payload.currentPassword) errors.push({ field: 'currentPassword', message: 'Current password is required.' });
    const passwordError = validatePassword(payload.newPassword || '');
    if (passwordError) errors.push({ field: 'newPassword', message: 'Password must be at least 8 characters and include a letter and a number.' });
    if (payload.currentPassword && payload.currentPassword === payload.newPassword) {
      errors.push({ field: 'newPassword', message: 'New password must be different from the current password.' });
    }
    if (errors.length) throw createApiError('Validation failed.', 400, errors, 'VALIDATION_ERROR');
    const currentDigest = await passwordDigest(payload.currentPassword, users[index].passwordSalt);
    if (currentDigest !== users[index].passwordDigest) {
      throw createApiError('Current password is incorrect.', 401, [{ field: 'currentPassword', message: 'Current password is incorrect.' }], 'INVALID_CURRENT_PASSWORD');
    }
    users[index].passwordDigest = await passwordDigest(payload.newPassword, users[index].passwordSalt);
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);
    return { token: makeToken(users[index].id) };
  },

  async deleteAccount(payload) {
    const token = localStorage.getItem(TOKEN_KEY);
    const userId = token?.split('.')[1];
    const users = readUsers();
    const index = users.findIndex((record) => record.id === userId);
    if (index < 0 || !token?.startsWith('mock.')) {
      throw createApiError('Session expired, please log in again.', 401, [], 'SESSION_EXPIRED');
    }
    if (!payload?.password) {
      throw createApiError('Password is required to delete this account.', 400, [{ field: 'password', message: 'Password is required.' }], 'VALIDATION_ERROR');
    }
    const digest = await passwordDigest(payload.password, users[index].passwordSalt);
    if (digest !== users[index].passwordDigest) {
      throw createApiError('The password is incorrect.', 401, [{ field: 'password', message: 'The password is incorrect.' }], 'INVALID_PASSWORD');
    }
    users.splice(index, 1);
    writeUsers(users);
    return { message: 'Account deleted.' };
  },
};
