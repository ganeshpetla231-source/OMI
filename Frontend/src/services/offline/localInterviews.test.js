import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeLocalInterview,
  createLocalInterview,
  pauseLocalInterview,
  startLocalInterview,
} from './localInterviews';
import { clearStore } from './db';

describe('local interview creation', () => {
  beforeEach(async () => {
    await Promise.all(['questions', 'meta', 'interviews', 'answers', 'reports', 'syncQueue', 'settings', 'guest'].map(clearStore));
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubEnv('VITE_USE_MOCK', 'true');
    let id = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `test-uuid-${id += 1}` });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('creates and starts an interview for the dashboard recommendation defaults', async () => {
    const interview = await createLocalInterview({
      category: 'technical',
      jobRole: 'Software Engineer',
      difficulty: 'beginner',
      duration: 15,
      questionCount: 5,
      style: 'standard',
      language: 'en',
      mode: 'text',
      practiceType: 'practice',
      source: 'bank',
      skills: ['System design'],
    }, 'mock_');

    expect(interview).toMatchObject({
      id: expect.stringMatching(/^mock_/),
      category: 'technical',
      jobRole: 'Software Engineer',
      difficulty: 'beginner',
      questions: expect.arrayContaining([expect.objectContaining({ skill: 'System design' })]),
      status: 'draft',
    });
    expect(interview.questions).toHaveLength(5);

    await expect(startLocalInterview(interview.id)).resolves.toMatchObject({ status: 'in_progress' });
  });

  it('enforces interview state transitions and makes completion idempotent', async () => {
    const interview = await createLocalInterview({
      category: 'general',
      jobRole: 'Any role',
      difficulty: 'beginner',
      language: 'en',
      questionCount: 5,
    }, 'mock_');

    await expect(pauseLocalInterview(interview.id, 12)).rejects.toThrowError(expect.objectContaining({
      status: 400,
      code: 'INVALID_INTERVIEW_STATE',
    }));
    await startLocalInterview(interview.id);
    const paused = await pauseLocalInterview(interview.id, 12);
    expect(paused).toMatchObject({ status: 'paused', elapsedSeconds: 12 });
    await expect(startLocalInterview(interview.id)).resolves.toMatchObject({ status: 'in_progress', elapsedSeconds: 12 });

    const completed = await completeLocalInterview(interview.id, { elapsedSeconds: 18, totalScore: 82 });
    expect(completed).toMatchObject({ status: 'completed', elapsedSeconds: 18, totalScore: 82 });
    await expect(completeLocalInterview(interview.id)).resolves.toEqual(completed);
    await expect(startLocalInterview(interview.id)).rejects.toThrowError(expect.objectContaining({
      status: 400,
      code: 'INVALID_INTERVIEW_STATE',
    }));
  });
});
