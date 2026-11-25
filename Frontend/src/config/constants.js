export const UserRole = Object.freeze({
  STUDENT: 'student',
  ADMIN: 'admin',
});

export const Category = Object.freeze({
  HR: 'hr',
  TECHNICAL: 'technical',
  GENERAL: 'general',
  COMMUNICATION: 'communication',
  CODING: 'coding',
});

export const Difficulty = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
});

export const InterviewMode = Object.freeze({
  TEXT: 'text',
  VOICE: 'voice',
});

export const InterviewStyle = Object.freeze({
  STANDARD: 'standard',
  FRIENDLY: 'friendly',
  STRICT: 'strict',
  RAPID_FIRE: 'rapid-fire',
});

export const InterviewStatus = Object.freeze({
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});

export const Language = Object.freeze({
  ENGLISH: 'en',
  TELUGU: 'te',
  HINDI: 'hi',
});

export const Theme = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
});

export const EvaluationMethod = Object.freeze({
  RULE_BASED_V1: 'rule-based-v1',
});

export const AnswerStatus = Object.freeze({
  ANSWERED: 'answered',
  SKIPPED: 'skipped',
});

export const AnswerSource = Object.freeze({
  TEXT: 'text',
  VOICE: 'voice',
  OFFLINE: 'offline',
});

export const QuestionSource = Object.freeze({
  BANK: 'bank',
  NOTES: 'notes',
  RESUME: 'resume',
  TEMPLATE: 'template',
});

export const ResumeExtractionStatus = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported',
});
