import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { GUEST_MODE_KEY, TOKEN_KEY } from '../../utils/authStorage';
import { clearStore, getRecord } from '../offline/db';
import { generateQuestionsFromNote } from '../offline/notesProcessor';
import { createLocalInterview } from '../offline/localInterviewStore';
import { getSyncQueue, processSyncQueue } from '../offline/syncQueue';
import { notesApi } from './notesApi';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(TOKEN_KEY, 'notes-test-token');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  await Promise.all(['notes', 'syncQueue', 'settings'].map(clearStore));
});

describe('notes API and offline question generation', () => {
  it('creates, updates, and deletes offline notes in sync order', async () => {
    const calls = [];
    server.use(
      http.post('/api/notes', async ({ request }) => {
        calls.push('create');
        const note = await request.json();
        return HttpResponse.json({ success: true, data: { note: { ...note, id: 'server-note-1' } } });
      }),
      http.put('/api/notes/server-note-1', async ({ request }) => {
        calls.push('update');
        const updates = await request.json();
        return HttpResponse.json({ success: true, data: { note: { id: 'server-note-1', ...updates } } });
      }),
      http.delete('/api/notes/server-note-1', () => {
        calls.push('remove');
        return HttpResponse.json({ success: true, data: { id: 'server-note-1' } });
      }),
    );

    const created = await notesApi.create({ title: 'HTTP notes', content: 'REST is an architectural style.' });
    await notesApi.update(created.id, { title: 'HTTP and REST', content: 'REST is an architectural style for services.' });
    expect(await getSyncQueue()).toHaveLength(2);
    expect(await getRecord('notes', created.id)).toMatchObject({ syncStatus: 'pending', title: 'HTTP and REST' });

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await processSyncQueue();
    expect(calls).toEqual(['create', 'update']);
    expect(await getSyncQueue()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'notes.create', status: 'synced' }),
      expect.objectContaining({ type: 'notes.update', status: 'synced' }),
    ]));
    expect(await getRecord('settings', `note-map:${created.id}`)).toMatchObject({ serverId: 'server-note-1' });
    expect(await getRecord('notes', created.id)).toMatchObject({ syncStatus: 'synced', serverId: 'server-note-1' });

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await notesApi.remove(created.id);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await processSyncQueue();
    expect(calls).toEqual(['create', 'update', 'remove']);
  });

  it('keeps guest notes local without adding sync operations', async () => {
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    const note = await notesApi.create({ title: 'Local note', content: 'A guest note.' });

    expect(note).toMatchObject({ title: 'Local note', syncStatus: 'synced' });
    expect(await getSyncQueue()).toEqual([]);
  });

  it('generates a requested number of deterministic questions from a saved note', async () => {
    const note = await notesApi.create({
      title: 'Caching',
      topic: 'Web development',
      tags: ['frontend'],
      content: '# Caching\nCaching is storing frequently used data for faster access. Cache invalidation keeps stored values current.',
    });

    const first = await generateQuestionsFromNote(note.id, { count: 5, category: 'technical' });
    const second = await generateQuestionsFromNote(note.id, { count: 5, category: 'technical' });

    expect(first.items).toHaveLength(5);
    expect(first.items[0]).toMatchObject({
      category: 'technical',
      skill: 'Web development',
      source: 'notes',
      tags: ['Web development', 'frontend'],
    });
    expect(first.items.map((item) => item.text)).toEqual(second.items.map((item) => item.text));

    const interview = await createLocalInterview({
      source: 'notes',
      noteId: note.id,
      category: 'technical',
      jobRole: 'Software Engineer',
      difficulty: 'beginner',
      language: 'en',
      questionCount: 5,
    });
    expect(interview.questions).toHaveLength(5);
    expect(interview.questions[0]).toMatchObject({ source: 'notes', skill: 'Web development' });
  });
});
