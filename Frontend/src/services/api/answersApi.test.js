import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { answersApi } from './answersApi';
import { getInterviewSnapshot, saveLocalAnswer } from '../offline/localInterviewStore';
import { enqueueSyncOperation } from '../offline/syncQueue';

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../mock/answersApi', () => ({
  mockAnswersApi: { submit: vi.fn(), list: vi.fn(), get: vi.fn(), evaluate: vi.fn(), retry: vi.fn() },
}));

vi.mock('../offline/localInterviewStore', () => ({
  getLocalAnswer: vi.fn(),
  getInterviewSnapshot: vi.fn(),
  getInterviewIdMapping: vi.fn().mockResolvedValue(null),
  listLocalAnswers: vi.fn().mockResolvedValue([]),
  markAnswerSynced: vi.fn().mockResolvedValue(undefined),
  saveLocalAnswer: vi.fn(async (interviewId, answer) => ({ ...answer, interviewId })),
}));

vi.mock('../offline/syncQueue', () => ({
  enqueueSyncOperation: vi.fn().mockResolvedValue(undefined),
}));

describe('answersApi', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubEnv('VITE_USE_MOCK', 'false');
    vi.clearAllMocks();
    saveLocalAnswer.mockImplementation(async (interviewId, answer) => ({ ...answer, interviewId }));
    getInterviewSnapshot.mockResolvedValue({
      interview: {
        id: 'remote-1',
        clientId: 'client-1',
        status: 'in_progress',
        difficulty: 'beginner',
        category: 'general',
        questions: [{
          questionId: 'question-1',
          text: 'Describe a challenge.',
          expectedAnswer: 'Describe the action and result.',
          keywords: ['action', 'result'],
          difficulty: 'beginner',
        }],
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.unstubAllEnvs();
  });

  it('stores a local answer and queues it when submission loses the network', async () => {
    apiClient.post.mockRejectedValue(Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' }));
    const payload = {
      questionId: 'question-1',
      questionIndex: 0,
      answerText: 'A complete answer',
      status: 'answered',
      source: 'text',
      timeTakenSeconds: 14,
    };

    await expect(answersApi.submit('remote-1', payload)).resolves.toMatchObject({
      answer: { answerText: payload.answerText, questionIndex: 0 },
      offline: true,
      queued: true,
    });
    expect(apiClient.post).toHaveBeenCalledWith('/interviews/remote-1/answers', payload);
    expect(saveLocalAnswer).toHaveBeenCalledWith('remote-1', expect.objectContaining({ answerText: payload.answerText }));
    expect(enqueueSyncOperation).toHaveBeenCalledWith('answers.submit', expect.objectContaining({
      localId: 'remote-1',
      answers: [expect.objectContaining({ answerText: payload.answerText, evaluation: expect.any(Object) })],
    }), expect.objectContaining({ localId: 'remote-1' }));
  });

  it('does not queue server validation failures as offline submissions', async () => {
    apiClient.post.mockRejectedValue(Object.assign(new Error('Invalid answer'), { code: 'API_ERROR', status: 400 }));

    await expect(answersApi.submit('remote-1', {
      questionId: 'question-1',
      questionIndex: 0,
      answerText: 'Answer',
      status: 'answered',
    })).rejects.toMatchObject({ status: 400 });
    expect(enqueueSyncOperation).not.toHaveBeenCalled();
  });
});
