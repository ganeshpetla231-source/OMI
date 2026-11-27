import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import seedQuestions from '../../assets/seed/questions.en.json';

describe('local question cache', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ships at least 60 complete questions across all five categories', () => {
    expect(seedQuestions.length).toBeGreaterThanOrEqual(60);
    expect(new Set(seedQuestions.map((question) => question.category))).toEqual(new Set([
      'hr', 'technical', 'general', 'communication', 'coding',
    ]));
    seedQuestions.forEach((question) => {
      expect(question).toMatchObject({
        id: expect.any(String),
        text: expect.any(String),
        jobRole: expect.any(String),
        difficulty: expect.any(String),
        language: 'en',
        skill: expect.any(String),
        tags: expect.any(Array),
        expectedAnswer: expect.any(String),
        keywords: expect.any(Array),
        evaluationCriteria: expect.any(Array),
        timeLimitSeconds: expect.any(Number),
        isActive: true,
      });
    });
  });

  it('seeds IndexedDB on first use and filters cached questions locally', async () => {
    const { initializeQuestionCache, listLocalQuestions, getLocalCategories } = await import('./localQuestions');
    await initializeQuestionCache();

    const result = await listLocalQuestions({ category: 'coding', language: 'en', page: 1, limit: 3 });
    expect(result.items).toHaveLength(3);
    expect(result.pagination.total).toBe(12);
    expect(result.items.every((question) => question.category === 'coding')).toBe(true);
    expect(await getLocalCategories()).toEqual(['coding', 'communication', 'general', 'hr', 'technical']);
  });

  it('persists questions received from successful requests for later offline reads', async () => {
    const { cacheQuestions, getLocalQuestionById } = await import('./localQuestions');
    const question = { ...seedQuestions[0], id: 'api-cached-question', text: 'Cached question from network' };

    await cacheQuestions([question]);

    await expect(getLocalQuestionById(question.id)).resolves.toMatchObject({ text: question.text });
  });
});
