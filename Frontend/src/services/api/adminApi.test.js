import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { realAdminApi } from './adminApi';
import { cacheQuestions, getLocalQuestionById, removeCachedQuestion } from '../offline/localQuestions';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../offline/localQuestions', () => ({
  cacheQuestions: vi.fn(),
  getLocalQuestionById: vi.fn(),
  removeCachedQuestion: vi.fn(),
}));

const question = {
  id: 'question/one',
  text: 'How do you lead a project?',
  category: 'general',
  jobRole: 'Project Manager',
  difficulty: 'beginner',
  language: 'en',
  skill: 'Planning',
  tags: [],
  expectedAnswer: 'Describe a plan and how you measure progress.',
  keywords: ['plan'],
  evaluationCriteria: ['Explain the approach'],
  timeLimitSeconds: 120,
  isActive: true,
};

describe('real admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the admin dashboard and question endpoints', async () => {
    apiClient.get.mockResolvedValue({ data: { usersCount: 2 } });
    apiClient.post.mockResolvedValue({ data: { question } });
    apiClient.put.mockResolvedValue({ data: { item: question } });
    apiClient.delete.mockResolvedValue({ data: { softDeleted: true, message: 'Deactivated' } });
    getLocalQuestionById.mockResolvedValue(question);

    expect(await realAdminApi.getDashboard()).toEqual({ usersCount: 2 });
    expect(await realAdminApi.createQuestion(question)).toEqual({ question });
    expect(await realAdminApi.updateQuestion(question.id, { text: question.text })).toEqual({ question });
    expect(await realAdminApi.deleteQuestion(question.id)).toEqual({ softDeleted: true, message: 'Deactivated' });

    expect(apiClient.get).toHaveBeenCalledWith('/admin/dashboard');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/questions', question);
    expect(apiClient.put).toHaveBeenCalledWith('/admin/questions/question%2Fone', { text: question.text });
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/questions/question%2Fone');
    expect(cacheQuestions).toHaveBeenCalledWith([question]);
    expect(removeCachedQuestion).not.toHaveBeenCalled();
  });

  it('removes a hard-deleted question from the offline cache', async () => {
    apiClient.delete.mockResolvedValue({ data: { deleted: true } });
    getLocalQuestionById.mockResolvedValue(question);

    await realAdminApi.deleteQuestion(question.id);

    expect(removeCachedQuestion).toHaveBeenCalledWith(question.id);
  });
});
