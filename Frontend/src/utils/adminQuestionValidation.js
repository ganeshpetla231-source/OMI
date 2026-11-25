import { Difficulty, Language } from '../config/constants';

const DIFFICULTIES = new Set(Object.values(Difficulty));
const LANGUAGES = new Set(Object.values(Language));

export function normalizeQuestionPayload(values) {
  const cleanList = (items) => [...new Set((Array.isArray(items) ? items : [])
    .map((item) => String(item).trim())
    .filter(Boolean))];
  return {
    text: String(values.text || '').trim(),
    category: String(values.category || '').trim(),
    jobRole: String(values.jobRole || '').trim(),
    difficulty: values.difficulty,
    language: values.language,
    skill: String(values.skill || '').trim(),
    tags: cleanList(values.tags),
    expectedAnswer: String(values.expectedAnswer || '').trim(),
    keywords: cleanList(values.keywords),
    evaluationCriteria: cleanList(values.evaluationCriteria),
    timeLimitSeconds: Number(values.timeLimitSeconds),
    isActive: Boolean(values.isActive),
  };
}

export function validateAdminQuestion(values) {
  const question = normalizeQuestionPayload(values);
  const errors = {};
  if (!question.text) errors.text = 'required';
  else if (question.text.length < 10) errors.text = 'tooShort';
  else if (question.text.length > 500) errors.text = 'tooLong';
  if (!question.category) errors.category = 'required';
  if (!question.jobRole) errors.jobRole = 'required';
  if (!question.skill) errors.skill = 'required';
  if (!DIFFICULTIES.has(question.difficulty)) errors.difficulty = 'invalid';
  if (!LANGUAGES.has(question.language)) errors.language = 'invalid';
  if (!question.expectedAnswer) errors.expectedAnswer = 'required';
  if (!question.keywords.length) errors.keywords = 'required';
  if (!question.evaluationCriteria.length) errors.evaluationCriteria = 'required';
  if (!Number.isInteger(question.timeLimitSeconds) || question.timeLimitSeconds <= 0) {
    errors.timeLimitSeconds = 'invalid';
  }
  return { question, errors, valid: Object.keys(errors).length === 0 };
}
