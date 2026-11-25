import { beforeEach, describe, expect, it } from 'vitest';
import { mockAdminApi } from './adminApi';
import { mockQuestionsApi } from './questionsApi';

describe('mock admin question management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('makes a created question visible to the shared mock question bank', async () => {
    const created = await mockAdminApi.createQuestion({
      text: 'How do you design a reliable queue?',
      category: 'technical',
      jobRole: 'Platform Engineer',
      difficulty: 'intermediate',
      language: 'en',
      skill: 'System design',
      tags: ['systems'],
      expectedAnswer: 'Explain delivery guarantees and failure recovery.',
      keywords: ['delivery', 'recovery'],
      evaluationCriteria: ['Describe failure handling'],
      timeLimitSeconds: 180,
      isActive: true,
    });
    const list = await mockQuestionsApi.list({ search: 'reliable queue', includeInactive: true });

    expect(list.items).toContainEqual(created.question);
    expect((await mockQuestionsApi.getById(created.question.id)).item).toEqual(created.question);
  });

  it('soft-deletes a question and keeps it available to admin filtering', async () => {
    const created = await mockAdminApi.createQuestion({
      text: 'How do you monitor a service?',
      category: 'technical',
      jobRole: 'Platform Engineer',
      difficulty: 'beginner',
      language: 'en',
      skill: 'Monitoring',
      tags: [],
      expectedAnswer: 'Describe useful signals and how alerts guide action.',
      keywords: ['signals'],
      evaluationCriteria: ['Explain a monitoring approach'],
      timeLimitSeconds: 120,
      isActive: true,
    });

    const result = await mockAdminApi.deleteQuestion(created.question.id);
    const activeList = await mockQuestionsApi.list({ search: 'monitor a service' });
    const inactiveList = await mockQuestionsApi.list({ isActive: false, includeInactive: true, search: 'monitor a service' });

    expect(result.softDeleted).toBe(true);
    expect(activeList.items).toEqual([]);
    expect(inactiveList.items).toHaveLength(1);
    expect(inactiveList.items[0].isActive).toBe(false);
  });
});
