import { deleteRecord, getAllRecords, getRecord, putRecord } from './db';

function createId() {
  return `local_note_${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  return String(tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
}

function matchesSearch(note, search) {
  if (!search) return true;
  const query = search.toLocaleLowerCase();
  return [note.title, note.content, note.topic, ...(note.tags || [])]
    .some((value) => String(value || '').toLocaleLowerCase().includes(query));
}

export async function saveLocalNote(note) {
  if (!note?.id) throw new Error('A note ID is required.');
  const existing = await getRecord('notes', note.id);
  const record = {
    ...existing,
    ...note,
    tags: normalizeTags(note.tags ?? existing?.tags),
    updatedAt: note.updatedAt || new Date().toISOString(),
  };
  await putRecord('notes', record);
  return record;
}

export async function createLocalNote(payload) {
  const title = String(payload.title || '').trim();
  if (!title) throw new Error('A note title is required.');
  const now = new Date().toISOString();
  return saveLocalNote({
    id: createId(),
    title,
    topic: String(payload.topic || '').trim(),
    tags: normalizeTags(payload.tags),
    content: String(payload.content || ''),
    createdAt: now,
    updatedAt: now,
    syncStatus: payload.syncStatus || 'pending',
  });
}

export async function listLocalNotes(filters = {}) {
  const allNotes = (await getAllRecords('notes'))
    .filter((note) => !String(note.id).startsWith('draft:'))
    .filter((note) => !filters.topic || note.topic === filters.topic)
    .filter((note) => matchesSearch(note, String(filters.search || '').trim()))
    .sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Number(filters.limit) || 20);
  const pages = Math.ceil(allNotes.length / limit);
  const currentPage = pages ? Math.min(page, pages) : 1;
  return {
    items: allNotes.slice((currentPage - 1) * limit, currentPage * limit),
    pagination: { page: currentPage, limit, total: allNotes.length, pages },
  };
}

export async function getLocalNote(id) {
  const note = await getRecord('notes', id);
  if (!note || String(id).startsWith('draft:')) {
    const error = new Error('Note not found.');
    error.status = 404;
    error.code = 'NOTE_NOT_FOUND';
    throw error;
  }
  return note;
}

export async function updateLocalNote(id, updates = {}) {
  const existing = await getLocalNote(id);
  const title = updates.title === undefined ? existing.title : String(updates.title).trim();
  if (!title) throw new Error('A note title is required.');
  return saveLocalNote({
    ...existing,
    ...updates,
    title,
    topic: updates.topic === undefined ? existing.topic : String(updates.topic).trim(),
    tags: updates.tags === undefined ? existing.tags : normalizeTags(updates.tags),
    content: updates.content === undefined ? existing.content : String(updates.content),
    updatedAt: new Date().toISOString(),
  });
}

export async function removeLocalNote(id) {
  const note = await getLocalNote(id);
  await deleteRecord('notes', id);
  await deleteRecord('notes', `draft:${id}`);
  return note;
}

export async function saveNoteDraft(id, draft) {
  return putRecord('notes', {
    id: `draft:${id || 'new'}`,
    ...draft,
    tags: normalizeTags(draft.tags),
    updatedAt: new Date().toISOString(),
  });
}

export async function getNoteDraft(id) {
  return getRecord('notes', `draft:${id || 'new'}`);
}

export async function removeNoteDraft(id) {
  return deleteRecord('notes', `draft:${id || 'new'}`);
}

export function normalizeNoteTags(tags) {
  return normalizeTags(tags);
}
