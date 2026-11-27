import { apiClient } from './client';
import { GUEST_MODE_KEY, getStoredToken } from '../../utils/authStorage';
import { deleteRecord, getRecord, putRecord } from '../offline/db';
import {
  createLocalNote,
  getLocalNote,
  listLocalNotes,
  normalizeNoteTags,
  removeLocalNote,
  saveLocalNote,
  updateLocalNote,
} from '../offline/localNotes';
import { cancelQueuedNote, enqueueSyncOperation, getSyncQueue } from '../offline/syncQueue';

function isGuest() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true';
}

function isLocalId(id) {
  return String(id).startsWith('local_note_');
}

function shouldUseLocal() {
  return isGuest() || !navigator.onLine || !getStoredToken();
}

function shouldFallback(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500;
}

function noteFrom(response) {
  const note = response.data?.note || response.data?.item || response.data;
  if (!note?.id) throw new Error('The server returned an invalid note.');
  return note;
}

function itemsFrom(response) {
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload?.items || payload?.notes || [];
}

async function saveServerNote(note) {
  const existing = await getRecord('notes', note.id);
  if (existing?.syncStatus === 'pending' || existing?.syncStatus === 'failed') return existing;
  const saved = { ...note, serverId: note.id, syncStatus: 'synced' };
  await saveLocalNote(saved);
  return saved;
}

async function mappedId(id) {
  const mapping = await getRecord('settings', `note-map:${id}`);
  return mapping?.serverId || id;
}

async function queueNote(type, id, payload) {
  if (isGuest() || !getStoredToken()) return;
  const operationId = `${type}:${id}:${Date.now()}`;
  await enqueueSyncOperation(type, payload, {
    localId: id,
    idempotencyKey: operationId,
  });
  const note = await getRecord('notes', id);
  if (note && type !== 'notes.remove') await saveLocalNote({ ...note, syncStatus: 'pending' });
}

async function createLocal(payload, { queue = true } = {}) {
  const shouldQueue = queue && !isGuest() && Boolean(getStoredToken());
  const note = await createLocalNote({ ...payload, syncStatus: shouldQueue ? 'pending' : 'synced' });
  if (shouldQueue) {
    await queueNote('notes.create', note.id, { localId: note.id, note });
  }
  return note;
}

async function updateLocal(id, updates, { queue = true } = {}) {
  const shouldQueue = queue && !isGuest() && Boolean(getStoredToken());
  const note = await updateLocalNote(id, { ...updates, syncStatus: shouldQueue ? 'pending' : 'synced' });
  if (shouldQueue) await queueNote('notes.update', id, { localId: id, updates });
  return note;
}

async function removeLocal(id, { queue = true } = {}) {
  const queued = await getSyncQueue();
  const hasPendingCreate = queued.some((entry) => entry.localId === id && entry.type === 'notes.create' && entry.status !== 'synced');
  if (hasPendingCreate) {
    await cancelQueuedNote(id);
    await removeLocalNote(id);
    return { id };
  }
  const note = await getLocalNote(id);
  await removeLocalNote(id);
  if (queue) await queueNote('notes.remove', id, { localId: id });
  return { id: note.id };
}

export const realNotesApi = {
  async create(payload) {
    const response = await apiClient.post('/notes', { ...payload, tags: normalizeNoteTags(payload.tags) });
    return saveServerNote(noteFrom(response));
  },
  async list(filters = {}) {
    const response = await apiClient.get('/notes', { params: filters });
    const items = await Promise.all(itemsFrom(response).map(saveServerNote));
    const localPending = (await listLocalNotes({ search: filters.search, topic: filters.topic, page: 1, limit: 1000 }))
      .items.filter((note) => note.syncStatus === 'pending' || note.syncStatus === 'failed')
      .filter((note) => !items.some((item) => item.id === note.id));
    const pagination = response.pagination || response.data?.pagination || {
      page: Number(filters.page) || 1,
      limit: Number(filters.limit) || items.length,
      total: items.length,
      pages: items.length ? 1 : 0,
    };
    const total = Number(pagination.total ?? items.length) + localPending.length;
    const limit = Number(pagination.limit) || Number(filters.limit) || items.length;
    return {
      items: [...items, ...localPending],
      pagination: { ...pagination, total, ...(limit ? { pages: Math.ceil(total / limit) } : {}) },
    };
  },
  async get(id) {
    const response = await apiClient.get(`/notes/${encodeURIComponent(await mappedId(id))}`);
    const note = await saveServerNote(noteFrom(response));
    if (isLocalId(id)) {
      await saveLocalNote({ ...note, id, serverId: note.id });
      return getLocalNote(id);
    }
    return note;
  },
  async update(id, updates) {
    const response = await apiClient.put(`/notes/${encodeURIComponent(await mappedId(id))}`, {
      ...updates,
      ...(updates.tags === undefined ? {} : { tags: normalizeNoteTags(updates.tags) }),
    });
    const note = noteFrom(response);
    if (isLocalId(id)) return saveLocalNote({ ...(await getLocalNote(id)), ...note, id, serverId: note.id, syncStatus: 'synced' });
    return saveServerNote(note);
  },
  async remove(id) {
    await apiClient.delete(`/notes/${encodeURIComponent(await mappedId(id))}`);
    await deleteRecord('notes', id);
    await deleteRecord('notes', `draft:${id}`);
    return { id };
  },
};

export const mockNotesApi = {
  create: (payload) => createLocal(payload, { queue: false }),
  list: (filters) => listLocalNotes(filters),
  get: (id) => getLocalNote(id),
  update: (id, updates) => updateLocal(id, updates, { queue: false }),
  remove: (id) => removeLocal(id, { queue: false }),
};

async function localList(filters) {
  return listLocalNotes(filters);
}

async function call(method, args) {
  if (shouldUseLocal()) {
    if (method === 'create') return createLocal(args[0]);
    if (method === 'list') return localList(args[0]);
    if (method === 'get') return getLocalNote(args[0]);
    if (method === 'update') return updateLocal(args[0], args[1]);
    if (method === 'remove') return removeLocal(args[0]);
  }

  if (import.meta.env.VITE_USE_MOCK === 'true') return mockNotesApi[method](...args);

  if (['get', 'update', 'remove'].includes(method) && isLocalId(args[0])) {
    const mapping = await getRecord('settings', `note-map:${args[0]}`);
    if (!mapping?.serverId) {
      if (method === 'get') return getLocalNote(args[0]);
      if (method === 'update') return updateLocal(args[0], args[1]);
      return removeLocal(args[0]);
    }
  }

  try {
    return await realNotesApi[method](...args);
  } catch (error) {
    if (!shouldFallback(error)) throw error;
    if (method === 'create') return createLocal(args[0]);
    if (method === 'list') return localList(args[0]);
    if (method === 'get') return getLocalNote(args[0]);
    if (method === 'update') return updateLocal(args[0], args[1]);
    if (method === 'remove') return removeLocal(args[0]);
    throw error;
  }
}

export const notesApi = {
  create: (payload) => call('create', [payload]),
  list: (filters = {}) => call('list', [filters]),
  get: (id) => call('get', [id]),
  update: (id, updates) => call('update', [id, updates]),
  remove: (id) => call('remove', [id]),
};
