import { describe, expect, it } from 'vitest';
import { validateAdminQuestion } from './adminQuestionValidation';

const validQuestion = {
  text: 'Describe a recent project.',
  category: 'technical',
  jobRole: 'Software Engineer',
  difficulty: 'beginner',
  language: 'en',
  skill: 'Problem solving',
  tags: [],
  expectedAnswer: 'Describe the approach and the result.',
  keywords: ['approach'],
  evaluationCriteria: ['Explain the steps'],
  timeLimitSeconds: 120,
  isActive: true,
};

describe('admin question validation', () => {
  it('enforces the server question text length limits', () => {
    expect(validateAdminQuestion({ ...validQuestion, text: '123456789' }).errors.text).toBe('tooShort');
    expect(validateAdminQuestion({ ...validQuestion, text: 'x'.repeat(501) }).errors.text).toBe('tooLong');
    expect(validateAdminQuestion({ ...validQuestion, text: '1234567890' }).valid).toBe(true);
    expect(validateAdminQuestion({ ...validQuestion, text: 'x'.repeat(500) }).valid).toBe(true);
  });
});
