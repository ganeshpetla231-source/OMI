import { beforeEach, describe, expect, it } from 'vitest';
import { localDashboardApi } from './localDashboard';
import { clearStore } from './db';
import { saveInterviewSnapshot } from './localInterviewStore';

describe('localDashboardApi', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all(['questions', 'meta', 'interviews', 'answers', 'reports', 'syncQueue', 'settings', 'guest'].map(clearStore));
  });

  it('returns friendly zero values when there is no local interview history', async () => {
    await expect(localDashboardApi.getStats()).resolves.toEqual({
      totalInterviews: 0,
      averageScore: 0,
      practiceHours: 0,
      bestScore: 0,
    });
    await expect(localDashboardApi.getActivity()).resolves.toEqual([]);
    await expect(localDashboardApi.getRecommendations()).resolves.toEqual([]);
  });

  it('computes summary values from completed local interviews', async () => {
    await Promise.all([
      saveInterviewSnapshot({ interview: {
        id: 'completed-1', status: 'completed', totalScore: 80, duration: 30, completedAt: '2025-11-20T10:00:00.000Z',
      } }),
      saveInterviewSnapshot({ interview: {
        id: 'completed-2', status: 'completed', totalScore: 100, duration: 30, completedAt: '2025-11-21T10:00:00.000Z',
      } }),
      saveInterviewSnapshot({ interview: { id: 'draft', status: 'draft', totalScore: 99, duration: 60 } }),
    ]);

    await expect(localDashboardApi.getStats()).resolves.toEqual({
      totalInterviews: 2,
      averageScore: 90,
      practiceHours: 1,
      bestScore: 100,
    });
    await expect(localDashboardApi.getActivity()).resolves.toHaveLength(2);
  });
});
