import { apiClient } from '../api/client';
import { GUEST_MODE_KEY, getStoredToken } from '../../utils/authStorage';
import { deleteRecord, getAllRecords, getRecord, putRecord } from './db';
import { getInterviewSnapshot, replaceLocalInterview, saveInterviewSnapshot } from './localInterviewStore';
import { getLocalNote, saveLocalNote } from './localNotes';

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const TYPE_ORDER = {
  'interview.create': 0,
  'interview.start': 1,
  'interview.update': 2,
  'interview.pause': 3,
  'answers.submit': 4,
  'interview.complete': 5,
  'interview.remove': 6,
  'notes.create': 7,
  'notes.update': 8,
  'notes.remove': 9,
  'profile.update': 10,
  'profile.skills': 11,
  'profile.preferences': 12,
  'settings.update': 13,
};

let activeSync = null;

function isGuest() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true';
}

function isConflict(error) {
  return error?.status === 409;
}

function retryable(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500 || error?.status === 408;
}

export async function enqueueSyncOperation(type, payload, { localId, clientId, idempotencyKey } = {}) {
  if (isGuest()) return null;
  const createdAt = new Date().toISOString();
  const id = idempotencyKey || `${type}:${clientId || localId}:${payload?.questionIndex ?? createdAt}`;
  const existing = await getRecord('syncQueue', id);
  const entry = {
    ...(existing || {}),
    id,
    type,
    localId: localId || payload?.localId || payload?.interviewId,
    clientId: clientId || payload?.clientId,
    payload,
    createdAt: existing?.createdAt || createdAt,
    attempts: existing?.attempts || 0,
    status: 'pending',
    nextAttemptAt: null,
    lastError: null,
  };
  await putRecord('syncQueue', entry);
  window.dispatchEvent(new CustomEvent('talkready:sync-queue-changed'));
  return entry;
}

export async function cancelQueuedInterview(localId) {
  for (const entry of await getSyncQueue()) {
    if (entry.localId === localId && entry.status !== 'synced') await deleteRecord('syncQueue', entry.id);
  }
  window.dispatchEvent(new CustomEvent('talkready:sync-queue-changed'));
}

export async function cancelQueuedNote(localId) {
  for (const entry of await getSyncQueue()) {
    if (entry.localId === localId && entry.type.startsWith('notes.') && entry.status !== 'synced') {
      await deleteRecord('syncQueue', entry.id);
    }
  }
  window.dispatchEvent(new CustomEvent('talkready:sync-queue-changed'));
}

export async function getSyncQueue() {
  return (await getAllRecords('syncQueue')).filter((item) => item.type);
}

export async function getPendingSyncCount() {
  return (await getSyncQueue()).filter((item) => item.status !== 'synced').length;
}

async function serverIdFor(entry) {
  if (entry.serverId) return entry.serverId;
  if (entry.localId) {
    const mappingKey = entry.type.startsWith('notes.') ? `note-map:${entry.localId}` : `interview-map:${entry.localId}`;
    const mapping = await getRecord('settings', mappingKey);
    if (mapping?.serverId) return mapping.serverId;
  }
  return entry.localId;
}

async function saveSyncedNote(localId, note, serverId) {
  if (!localId || !note) return;
  const existing = await getLocalNote(localId).catch((error) => {
    if (error.status === 404) return null;
    throw error;
  });
  if (existing) {
    await saveLocalNote({ ...existing, ...note, id: localId, serverId, syncStatus: 'synced' });
  }
}

async function setNoteSyncStatus(localId, syncStatus) {
  const note = await getLocalNote(localId).catch((error) => {
    if (error.status === 404) return null;
    throw error;
  });
  if (note) await saveLocalNote({ ...note, syncStatus });
}

async function saveServerSnapshot(localId, serverInterview) {
  if (!localId || !serverInterview?.id || !String(localId).startsWith('local_')) return;
  const localSnapshot = await getInterviewSnapshot(localId);
  if (!localSnapshot) return;
  await saveInterviewSnapshot({
    ...localSnapshot,
    id: serverInterview.id,
    interview: { ...localSnapshot.interview, ...serverInterview, id: serverInterview.id },
  });
}

async function send(entry) {
  const payload = entry.payload || {};
  const interviewId = await serverIdFor(entry);
  const requiresMapping = ['interview.start', 'interview.update', 'interview.pause', 'answers.submit', 'interview.complete', 'interview.remove', 'notes.update', 'notes.remove']
    .includes(entry.type);
  if (requiresMapping && String(entry.localId || '').startsWith('local_') && interviewId === entry.localId) {
    const error = new Error('Waiting for this item to be created on the server.');
    error.code = 'SYNC_DEPENDENCY_PENDING';
    throw error;
  }

  if (entry.type === 'interview.create') {
    const interview = payload.interview || payload;
    const response = await apiClient.post('/interviews', { ...interview, id: undefined, clientId: entry.clientId || interview.clientId });
    const serverInterview = response.data?.interview || response.data;
    if (!serverInterview?.id) throw new Error('The server did not return the synchronized interview ID.');
    await putRecord('settings', { key: `interview-map:${entry.localId}`, serverId: serverInterview.id });
    return { serverInterview };
  }
  if (entry.type === 'interview.start') {
    const response = await apiClient.post(`/interviews/${encodeURIComponent(interviewId)}/start`, payload.request || {});
    return { serverInterview: response.data?.interview || response.data };
  }
  if (entry.type === 'interview.update') {
    const response = await apiClient.put(`/interviews/${encodeURIComponent(interviewId)}`, payload.updates || {});
    return { serverInterview: response.data?.interview || response.data };
  }
  if (entry.type === 'interview.pause') {
    const response = await apiClient.post(`/interviews/${encodeURIComponent(interviewId)}/pause`, payload.request || {});
    return { serverInterview: response.data?.interview || response.data };
  }
  if (entry.type === 'answers.submit') {
    const response = await apiClient.post(`/interviews/${encodeURIComponent(interviewId)}/answers`, {
      answers: payload.answers || [],
    });
    return { answers: response.data?.answers || response.data?.items || [] };
  }
  if (entry.type === 'interview.complete') {
    const response = await apiClient.post(`/interviews/${encodeURIComponent(interviewId)}/complete`, payload.request || {});
    const serverInterview = response.data?.interview || response.data;
    const report = response.data?.report || serverInterview?.report;
    if (serverInterview?.id && entry.localId && String(entry.localId).startsWith('local_')) {
      await replaceLocalInterview(entry.localId, serverInterview);
      if (report) await putRecord('reports', report);
    }
    return { serverInterview, report };
  }
  if (entry.type === 'interview.remove') {
    await apiClient.delete(`/interviews/${encodeURIComponent(interviewId)}`);
    return {};
  }
  if (entry.type === 'notes.create') {
    const notePayload = { ...(payload.note || payload) };
    ['id', 'scope', 'serverId', 'syncStatus'].forEach((field) => delete notePayload[field]);
    const response = await apiClient.post('/notes', notePayload);
    const note = response.data?.note || response.data?.item || response.data;
    if (!note?.id) throw new Error('The server did not return the synchronized note ID.');
    await putRecord('settings', { key: `note-map:${entry.localId}`, serverId: note.id });
    await saveSyncedNote(entry.localId, note, note.id);
    return { note };
  }
  if (entry.type === 'notes.update') {
    const response = await apiClient.put(`/notes/${encodeURIComponent(interviewId)}`, payload.updates || {});
    const note = response.data?.note || response.data?.item || response.data;
    await saveSyncedNote(entry.localId, note, interviewId);
    return { note };
  }
  if (entry.type === 'notes.remove') {
    await apiClient.delete(`/notes/${encodeURIComponent(interviewId)}`);
    return {};
  }
  if (entry.type === 'profile.update') {
    const response = await apiClient.put('/profile', payload.updates || {});
    return { profile: response.data?.profile || response.data?.user || response.data };
  }
  if (entry.type === 'profile.skills') {
    const response = await apiClient.put('/profile/skills', { skills: payload.skills || [] });
    return { profile: response.data?.profile || response.data?.user || response.data };
  }
  if (entry.type === 'profile.preferences') {
    const response = await apiClient.put('/profile/preferences', payload.preferences || {});
    return { profile: response.data?.profile || response.data?.user || response.data };
  }
  if (entry.type === 'settings.update') {
    const response = await apiClient.put('/settings', payload.updates || {});
    return { settings: response.data?.settings || response.data };
  }
  throw new Error(`Unsupported sync operation: ${entry.type}`);
}

function ordered(entries) {
  return entries.sort((left, right) => (
    String(left.createdAt).localeCompare(String(right.createdAt))
    || (TYPE_ORDER[left.type] ?? 99) - (TYPE_ORDER[right.type] ?? 99)
  ));
}

async function processQueue(force) {
  if (isGuest() || !getStoredToken() || !navigator.onLine) {
    return { synced: 0, pending: await getPendingSyncCount(), failed: 0 };
  }
  let synced = 0;
  const now = Date.now();
  const entries = ordered(await getSyncQueue());
  for (const original of entries) {
    if (original.status === 'synced') continue;
    if (original.status === 'failed' && !force) continue;
    if (original.status === 'pending' && Number(original.nextAttemptAt) > now && !force) continue;
    const entry = { ...original, status: 'syncing' };
    await putRecord('syncQueue', entry);
    try {
      const result = await send(entry);
      await saveServerSnapshot(entry.localId, result.serverInterview);
      await putRecord('syncQueue', { ...entry, status: 'synced', syncedAt: new Date().toISOString(), lastError: null });
      synced += 1;
    } catch (error) {
      if (isConflict(error)) {
        if (entry.type.startsWith('notes.') && entry.type !== 'notes.remove') {
          await setNoteSyncStatus(entry.localId, 'synced');
        }
        await putRecord('syncQueue', { ...entry, status: 'synced', syncedAt: new Date().toISOString(), lastError: null });
        synced += 1;
        continue;
      }
      if (error.code === 'SYNC_DEPENDENCY_PENDING') {
        await putRecord('syncQueue', { ...entry, status: 'pending' });
        continue;
      }
      const attempts = Number(entry.attempts || 0) + 1;
      const backoff = Math.min(1000 * (2 ** (attempts - 1)), MAX_BACKOFF_MS);
      const status = attempts >= MAX_ATTEMPTS || !retryable(error) ? 'failed' : 'pending';
      await putRecord('syncQueue', {
        ...entry,
        attempts,
        status,
        nextAttemptAt: new Date(Date.now() + backoff).getTime(),
        lastError: error.message || 'Synchronization failed.',
      });
      if (entry.type.startsWith('notes.') && entry.type !== 'notes.remove') {
        await setNoteSyncStatus(entry.localId, status === 'failed' ? 'failed' : 'pending');
      }
    }
  }
  const queue = await getSyncQueue();
  const failed = queue.filter((entry) => entry.status === 'failed').length;
  const pending = queue.filter((entry) => entry.status !== 'synced').length;
  if (synced) await putRecord('settings', { key: 'lastSyncAt', value: new Date().toISOString() });
  window.dispatchEvent(new CustomEvent('talkready:sync-complete', { detail: { synced, pending, failed } }));
  return { synced, pending, failed };
}

export function processSyncQueue({ force = false } = {}) {
  if (activeSync) return activeSync;
  activeSync = processQueue(force).finally(() => { activeSync = null; });
  return activeSync;
}

export async function retryFailedSync() {
  for (const entry of await getSyncQueue()) {
    if (entry.status !== 'failed') continue;
    await putRecord('syncQueue', { ...entry, attempts: 0, status: 'pending', nextAttemptAt: null, lastError: null });
  }
  return processSyncQueue({ force: true });
}

export async function getLastSyncAt() {
  return (await getRecord('settings', 'lastSyncAt'))?.value || null;
}
