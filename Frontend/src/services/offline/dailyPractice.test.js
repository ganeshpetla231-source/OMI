import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDailyPracticeStreak, recordDailyPracticeCompletion } from './dailyPractice';
import { getRecord, putRecord } from './db';

vi.mock('./db', () => ({
  getRecord: vi.fn(),
  putRecord: vi.fn(),
}));

describe('daily communication practice streak', () => {
  let saved;

  beforeEach(() => {
    saved = null;
    vi.clearAllMocks();
    getRecord.mockImplementation(async () => saved);
    putRecord.mockImplementation(async (_store, record) => {
      saved = record;
    });
  });

  it('starts, increments, and expires a daily streak by calendar day', async () => {
    const firstDay = new Date(2026, 0, 10, 12);
    const nextDay = new Date(2026, 0, 11, 12);
    const afterGap = new Date(2026, 0, 13, 12);

    await expect(recordDailyPracticeCompletion('interview-1', firstDay)).resolves.toMatchObject({ streakCount: 1 });
    await expect(recordDailyPracticeCompletion('interview-2', firstDay)).resolves.toMatchObject({ streakCount: 1 });
    await expect(recordDailyPracticeCompletion('interview-3', nextDay)).resolves.toMatchObject({ streakCount: 2 });
    await expect(getDailyPracticeStreak(afterGap)).resolves.toMatchObject({ streakCount: 0 });
  });

  it('rejects a completion that has no interview ID', async () => {
    await expect(recordDailyPracticeCompletion('')).rejects.toThrow('An interview ID is required');
    expect(putRecord).not.toHaveBeenCalled();
  });
});
