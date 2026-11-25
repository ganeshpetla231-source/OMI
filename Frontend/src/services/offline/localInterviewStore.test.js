import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

describe('local interview store', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubEnv('VITE_USE_MOCK', 'true');
    let id = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `interview-test-${id += 1}` });
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('persists interview snapshots, answers, and queued network submissions', async () => {
    const store = await import('./localInterviewStore');
    const interview = { id: 'remote-1', status: 'in_progress', questions: [] };
    const answer = { questionIndex: 0, answerText: 'A saved response', status: 'answered' };

    await store.saveInterviewSnapshot({
      interview,
      answers: { '0': answer },
      currentIndex: 0,
      elapsedSeconds: 42,
      questionElapsedSeconds: 8,
    });
    await store.saveLocalAnswer(interview.id, answer);
    await store.queueAnswerForSync(interview.id, answer);
    const { enqueueSyncOperation } = await import('./syncQueue');
    await enqueueSyncOperation('answers.submit', { answers: [answer] }, {
      localId: interview.id,
      idempotencyKey: `answers.submit:${interview.id}:0`,
    });

    await expect(store.getInterviewSnapshot(interview.id)).resolves.toMatchObject({
      interview,
      answers: { '0': answer },
      elapsedSeconds: 42,
      questionElapsedSeconds: 8,
    });
    await expect(store.listLocalAnswers(interview.id)).resolves.toMatchObject([
      expect.objectContaining({ answerText: 'A saved response', interviewId: interview.id }),
    ]);
    await expect(store.listQueuedAnswers()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        answerText: 'A saved response',
        type: 'answers.submit',
        localId: interview.id,
      }),
      expect.objectContaining({
        id: `answers.submit:${interview.id}:0`,
        payload: { answers: [expect.objectContaining({ answerText: 'A saved response' })] },
      }),
    ]));

    await store.markAnswerSynced(interview.id, answer);
    await expect(store.listQueuedAnswers()).resolves.toEqual([]);
  });

  it('completes a five-question mock interview with saved answers', async () => {
    const { mockInterviewsApi } = await import('../mock/interviewsApi');
    const { mockAnswersApi } = await import('../mock/answersApi');
    const interview = await mockInterviewsApi.create({
      category: 'general',
      jobRole: 'Any role',
      difficulty: 'beginner',
      language: 'en',
      duration: 15,
      questionCount: 5,
      mode: 'text',
      style: 'standard',
      practiceType: 'practice',
      source: 'bank',
    });
    await mockInterviewsApi.start(interview.id);

    for (let questionIndex = 0; questionIndex < interview.questions.length; questionIndex += 1) {
      const question = interview.questions[questionIndex];
      await mockAnswersApi.submit(interview.id, {
        questionId: question.questionId,
        questionIndex,
        answerText: question.keywords.join(' '),
        status: 'answered',
        source: 'text',
        timeTakenSeconds: 30,
      });
    }

    const completed = await mockInterviewsApi.complete(interview.id, { elapsedSeconds: 150 });
    expect(completed).toMatchObject({ status: 'completed', elapsedSeconds: 150 });
    expect(completed.totalScore).toBeGreaterThan(0);
    expect(completed.totalScore).toBeLessThan(100);
    await expect(mockAnswersApi.list(interview.id)).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ status: 'answered' })]),
    });

  });

  it('uses the selected seeded question for a one-question communication drill', async () => {
    const { mockInterviewsApi } = await import('../mock/interviewsApi');
    const interview = await mockInterviewsApi.create({
      category: 'communication',
      jobRole: 'Any role',
      difficulty: 'beginner',
      language: 'en',
      duration: 5,
      questionCount: 1,
      mode: 'text',
      style: 'friendly',
      practiceType: 'practice',
      source: 'bank',
      skills: ['STAR method'],
      preferredQuestionId: 'seed-communication-star-01',
    });

    expect(interview.questions).toHaveLength(1);
    expect(interview.questions[0]).toMatchObject({
      questionId: 'seed-communication-star-01',
      skill: 'STAR method',
    });
  });
});
