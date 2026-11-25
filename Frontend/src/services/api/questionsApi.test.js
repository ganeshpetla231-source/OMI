import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { listLocalQuestions, randomLocalQuestions } from '../offline/localQuestions';
import { questionsApi } from './questionsApi';

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../offline/localQuestions', () => ({
  cacheQuestionOptions: vi.fn().mockResolvedValue(undefined),
  cacheQuestions: vi.fn().mockResolvedValue(undefined),
  getLocalCategories: vi.fn().mockResolvedValue(['coding']),
  getLocalQuestionById: vi.fn(),
  getLocalRoles: vi.fn().mockResolvedValue(['Backend Developer']),
  getLocalSkills: vi.fn().mockResolvedValue(['Arrays']),
  initializeQuestionCache: vi.fn().mockResolvedValue(undefined),
  listLocalQuestions: vi.fn().mockResolvedValue({
    items: [{ id: 'cached-1', text: 'Saved question', category: 'coding' }],
    pagination: { page: 1, limit: 10, total: 1, pages: 1 },
  }),
  randomLocalQuestions: vi.fn().mockResolvedValue({
    items: [{ id: 'cached-random', text: 'Saved random question' }],
    pagination: { page: 1, limit: 1, total: 1, pages: 1 },
  }),
}));

describe('questionsApi', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubEnv('VITE_USE_MOCK', 'false');
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.unstubAllEnvs();
  });

  it('maps supported filters and pagination to the list request parameters', async () => {
    apiClient.get.mockResolvedValue({
      data: { items: [{ id: 'remote-1', text: 'Remote question' }] },
      pagination: { page: 2, limit: 10, total: 11, pages: 2 },
    });

    await expect(questionsApi.list({
      category: 'coding',
      role: 'Backend Developer',
      skill: 'Arrays',
      difficulty: 'beginner',
      language: 'en',
      search: 'binary',
      page: 2,
      limit: 10,
    })).resolves.toMatchObject({
      items: [{ id: 'remote-1' }],
      pagination: { page: 2, total: 11 },
      offline: false,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/questions', {
      params: {
        category: 'coding',
        jobRole: 'Backend Developer',
        skill: 'Arrays',
        difficulty: 'beginner',
        language: 'en',
        search: 'binary',
        page: 2,
        limit: 10,
      },
    });
  });

  it('falls back to the IndexedDB adapter after a network error', async () => {
    apiClient.get.mockRejectedValue(Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' }));
    listLocalQuestions.mockResolvedValue({
      items: [{ id: 'cached-1', text: 'Saved question' }],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });
    await expect(questionsApi.list({ category: 'coding', page: 1, limit: 10 })).resolves.toMatchObject({
      items: [{ id: 'cached-1' }],
      offline: true,
    });
  });

  it('uses the local random-question selector while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await expect(questionsApi.random({ category: 'coding', count: 1 })).resolves.toMatchObject({
      items: [{ id: 'cached-random' }],
      offline: true,
    });
    expect(randomLocalQuestions).toHaveBeenCalledWith({ category: 'coding', count: 1 });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('does not hide validation failures behind cached results', async () => {
    apiClient.get.mockRejectedValue(Object.assign(new Error('Server rejected the request'), { code: 'API_ERROR', status: 400 }));

    await expect(questionsApi.list({ category: 'coding' })).rejects.toMatchObject({ status: 400 });
    expect(listLocalQuestions).not.toHaveBeenCalled();
  });

  it('falls back to cached questions after a server error', async () => {
    apiClient.get.mockRejectedValue(Object.assign(new Error('Server unavailable'), { code: 'API_ERROR', status: 503 }));

    await expect(questionsApi.list({ category: 'coding' })).resolves.toMatchObject({ offline: true });
    expect(listLocalQuestions).toHaveBeenCalled();
  });

  it('serves seeded mock questions and options in mock mode', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true');

    const categories = await questionsApi.getCategories();
    const result = await questionsApi.list({ category: 'coding', page: 1, limit: 20 });

    expect(categories.items).toContain('coding');
    expect(result.items).toHaveLength(12);
    expect(result.items.every((question) => question.category === 'coding')).toBe(true);
  });
});
