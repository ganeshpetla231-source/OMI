import { beforeEach, describe, expect, it } from 'vitest';
import { getAllRecords, putRecord } from './db';
import { clearCurrentUserData, getLocalSettings, saveLocalSettings } from './profileSettings';

describe('offline profile and settings storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists settings changes in IndexedDB for the next visit', async () => {
    await saveLocalSettings({
      language: 'te',
      interviewPreferences: { category: 'technical', duration: 10 },
      offline: { autoSync: false },
    });
    const stored = await getLocalSettings();
    expect(stored).toMatchObject({
      language: 'te',
      interviewPreferences: { category: 'technical', duration: 10, questionCount: 5 },
      offline: { autoSync: false },
    });
  });

  it('clears local user records without deleting the signed-in identity', async () => {
    localStorage.setItem('talkready_user', JSON.stringify({ id: 'student-1', email: 'student@example.com' }));
    localStorage.setItem('talkready_token', 'local-token');
    await putRecord('notes', { id: 'note-1', title: 'Saved note' });
    await putRecord('reports', { id: 'report-1' });
    await putRecord('questions', { id: 'question-1' });

    await clearCurrentUserData();

    expect(await getAllRecords('notes')).toEqual([]);
    expect(await getAllRecords('reports')).toEqual([]);
    expect(await getAllRecords('questions')).toEqual([]);
    expect(JSON.parse(localStorage.getItem('talkready_user'))).toMatchObject({ id: 'student-1' });
    expect(localStorage.getItem('talkready_token')).toBe('local-token');
  });
});
