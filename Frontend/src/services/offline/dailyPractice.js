import { getRecord, putRecord } from './db';

const STREAK_KEY = 'practice-daily-streak';

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function offsetDateKey(key, offset) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

function currentStreak(record, today) {
  if (!record?.lastCompletedDate) return 0;
  return record.lastCompletedDate === today || record.lastCompletedDate === offsetDateKey(today, -1)
    ? Number(record.streakCount) || 0
    : 0;
}

export async function getDailyPracticeStreak(now = new Date()) {
  const today = dateKey(now);
  const record = await getRecord('settings', STREAK_KEY);
  return {
    streakCount: currentStreak(record, today),
    lastCompletedDate: record?.lastCompletedDate || null,
  };
}

export async function recordDailyPracticeCompletion(interviewId, now = new Date()) {
  if (!interviewId) throw new Error('An interview ID is required to record daily practice.');
  const today = dateKey(now);
  const record = await getRecord('settings', STREAK_KEY);
  if (record?.lastCompletedDate === today) {
    return { streakCount: Number(record.streakCount) || 1, lastCompletedDate: today };
  }
  const streakCount = record?.lastCompletedDate === offsetDateKey(today, -1)
    ? (Number(record.streakCount) || 0) + 1
    : 1;
  const next = { key: STREAK_KEY, streakCount, lastCompletedDate: today, lastInterviewId: interviewId };
  await putRecord('settings', next);
  return { streakCount, lastCompletedDate: today };
}
