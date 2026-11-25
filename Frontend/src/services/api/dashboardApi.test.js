import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_KEY } from '../../utils/authStorage';
import { dashboardApi } from './dashboardApi';
import { clearStore } from '../offline/db';
import { saveInterviewSnapshot } from '../offline/localInterviewStore';

describe('dashboardApi source selection', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    localStorage.clear();
    await Promise.all(['questions', 'meta', 'interviews', 'answers', 'reports', 'syncQueue', 'settings', 'guest'].map(clearStore));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubEnv('VITE_USE_MOCK', 'true');
  });

  it('uses the mock implementation when mock mode is enabled', async () => {
    const [stats, activity, skills, recommendations] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getActivity(),
      dashboardApi.getSkills(),
      dashboardApi.getRecommendations(),
    ]);

    expect(stats.totalInterviews).toBeGreaterThan(0);
    expect(activity).toHaveLength(2);
    expect(skills.technical).toBeGreaterThan(0);
    expect(recommendations[0]).toMatchObject({
      category: 'technical',
      jobRole: 'Software Engineer',
      difficulty: 'beginner',
      skill: 'System design',
    });
  });

  it('uses local interview history for an offline authenticated user', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    localStorage.setItem(TOKEN_KEY, 'saved-token');
    await saveInterviewSnapshot({ interview: {
      id: 'local-1', status: 'completed', totalScore: 90, duration: 30, completedAt: '2025-11-20T10:00:00.000Z',
    } });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await expect(dashboardApi.getStats()).resolves.toMatchObject({
      totalInterviews: 1,
      averageScore: 90,
      practiceHours: 0.5,
      bestScore: 90,
    });
  });
});
