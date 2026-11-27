import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { interviewsApi } from './interviewsApi';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../offline/localInterviews', () => ({
  completeLocalInterview: vi.fn(),
  createInterviewError: vi.fn(),
  createLocalInterview: vi.fn(),
  getLocalInterview: vi.fn(),
  listLocalInterviews: vi.fn(),
  pauseLocalInterview: vi.fn(),
  removeLocalInterview: vi.fn(),
  startLocalInterview: vi.fn(),
  updateLocalInterview: vi.fn(),
}));

vi.mock('../mock/interviewsApi', () => ({
  mockInterviewsApi: {},
}));

vi.mock('../offline/localInterviewStore', () => ({
  getInterviewSnapshot: vi.fn(),
  listInterviewSnapshots: vi.fn(),
  removeInterviewSnapshot: vi.fn(),
  saveInterviewSnapshot: vi.fn(),
}));

describe('interviewsApi', () => {
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

  it('maps interview list and update operations to the contract endpoints', async () => {
    apiClient.get.mockResolvedValue({
      data: { interviews: [{ id: 'remote-1' }] },
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });
    apiClient.put.mockResolvedValue({ data: { interview: { id: 'remote-1', currentIndex: 2 } } });

    await expect(interviewsApi.list({ page: 1, limit: 10 })).resolves.toMatchObject({
      items: [{ id: 'remote-1' }],
      pagination: { total: 1 },
    });
    await expect(interviewsApi.update('remote-1', { currentIndex: 2 })).resolves.toMatchObject({ currentIndex: 2 });
    expect(apiClient.get).toHaveBeenCalledWith('/interviews', { params: { page: 1, limit: 10 } });
    expect(apiClient.put).toHaveBeenCalledWith('/interviews/remote-1', { currentIndex: 2 });
  });

  it('posts pause and complete actions with their timer state', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { interview: { id: 'remote-1', status: 'paused' } } })
      .mockResolvedValueOnce({ data: { interview: { id: 'remote-1', status: 'completed' } } });

    await interviewsApi.pause('remote-1', { elapsedSeconds: 32 });
    await interviewsApi.complete('remote-1', { elapsedSeconds: 60 });

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/interviews/remote-1/pause', { elapsedSeconds: 32 });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/interviews/remote-1/complete', { elapsedSeconds: 60 });
  });

  it('does not send the local-only preferred question hint to the server', async () => {
    apiClient.post.mockResolvedValue({ data: { interview: { id: 'remote-practice' } } });

    await interviewsApi.create({
      category: 'communication',
      questionCount: 1,
      preferredQuestionId: 'seed-communication-star-01',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/interviews', expect.objectContaining({
      category: 'communication',
      questionCount: 1,
    }));
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('preferredQuestionId');
  });
});
