import { getRecord, putRecord } from './db';
import {
  createLocalInterview as createStoredInterview,
  getInterviewSnapshot,
  listInterviewSnapshots,
  removeInterviewSnapshot,
  saveInterviewSnapshot,
} from './localInterviewStore';

const LEGACY_KEYS = ['talkready_local_interviews', 'talkready_interviews'];
const LEGACY_MIGRATION_KEY = 'legacy-local-interviews-migrated';
let migrationPromise;

async function migrateLegacyLocalStorage() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      if ((await getRecord('meta', LEGACY_MIGRATION_KEY))?.value) return;
      for (const key of LEGACY_KEYS) {
        const saved = localStorage.getItem(key);
        if (!saved) continue;
        const interviews = JSON.parse(saved);
        if (!Array.isArray(interviews)) throw new Error('Saved interview history is invalid.');
        for (const interview of interviews) {
          if (!interview?.id || await getInterviewSnapshot(interview.id)) continue;
          await saveInterviewSnapshot({
            interview,
            answers: {},
            currentIndex: Number(interview.currentIndex) || 0,
            elapsedSeconds: Number(interview.elapsedSeconds) || 0,
            questionElapsedSeconds: 0,
          });
        }
      }
      await putRecord('meta', { key: LEGACY_MIGRATION_KEY, value: true });
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  await migrationPromise;
}

export function createInterviewError(message, status = 400, code = 'INVALID_INTERVIEW_STATE') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function createLocalInterview(payload, prefix = 'local_') {
  await migrateLegacyLocalStorage();
  return createStoredInterview(payload, prefix);
}

export async function getLocalInterview(id) {
  await migrateLegacyLocalStorage();
  const snapshot = await getInterviewSnapshot(id);
  if (!snapshot?.interview) {
    throw createInterviewError('Interview not found.', 404, 'INTERVIEW_NOT_FOUND');
  }
  return snapshot.interview;
}

export async function listLocalInterviews({ status, page = 1, limit = 20 } = {}) {
  await migrateLegacyLocalStorage();
  const interviews = (await listInterviewSnapshots())
    .map((snapshot) => snapshot.interview)
    .filter((interview) => interview && (!status || interview.status === status))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const pages = Math.ceil(interviews.length / safeLimit);
  const currentPage = pages ? Math.min(safePage, pages) : 1;
  const offset = (currentPage - 1) * safeLimit;
  return {
    items: interviews.slice(offset, offset + safeLimit),
    pagination: { page: currentPage, limit: safeLimit, total: interviews.length, pages },
  };
}

async function updateInterview(id, update) {
  await migrateLegacyLocalStorage();
  const snapshot = await getInterviewSnapshot(id);
  if (!snapshot?.interview) throw createInterviewError('Interview not found.', 404, 'INTERVIEW_NOT_FOUND');
  const interview = update(snapshot.interview);
  await saveInterviewSnapshot({ ...snapshot, interview });
  return interview;
}

export async function startLocalInterview(id) {
  return updateInterview(id, (saved) => {
    if (saved.status !== 'draft' && saved.status !== 'paused') {
      throw createInterviewError(`Cannot start an interview in the ${saved.status} state.`);
    }
    const now = new Date().toISOString();
    return {
      ...saved,
      status: 'in_progress',
      startedAt: saved.startedAt || now,
      lastResumedAt: now,
      updatedAt: now,
    };
  });
}

export async function pauseLocalInterview(id, elapsedSeconds) {
  return updateInterview(id, (saved) => {
    if (saved.status !== 'in_progress') {
      throw createInterviewError(`Cannot pause an interview in the ${saved.status} state.`);
    }
    const now = new Date().toISOString();
    const interview = {
      ...saved,
      status: 'paused',
      elapsedSeconds: Math.max(0, Number(elapsedSeconds ?? saved.elapsedSeconds) || 0),
      pausedAt: now,
      updatedAt: now,
    };
    delete interview.lastResumedAt;
    return interview;
  });
}

export async function updateLocalInterview(id, updates = {}) {
  return updateInterview(id, (saved) => {
    if (saved.status === 'completed') {
      throw createInterviewError('A completed interview cannot be updated.');
    }
    const currentIndex = updates.currentIndex === undefined ? saved.currentIndex : Number(updates.currentIndex);
    const elapsedSeconds = updates.elapsedSeconds === undefined ? saved.elapsedSeconds : Number(updates.elapsedSeconds);
    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= saved.questions.length) {
      throw createInterviewError('The current question index is invalid.', 400, 'INVALID_INTERVIEW_UPDATE');
    }
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw createInterviewError('Elapsed time must be a non-negative number.', 400, 'INVALID_INTERVIEW_UPDATE');
    }
    return { ...saved, currentIndex, elapsedSeconds, updatedAt: new Date().toISOString() };
  });
}

export async function completeLocalInterview(id, { elapsedSeconds, totalScore, reportId } = {}) {
  const saved = await getLocalInterview(id);
  if (saved.status === 'completed') return saved;
  if (saved.status !== 'in_progress' && saved.status !== 'paused') {
    throw createInterviewError(`Cannot complete an interview in the ${saved.status} state.`);
  }
  const now = new Date().toISOString();
  return updateInterview(id, (interview) => ({
    ...interview,
    status: 'completed',
    elapsedSeconds: Math.max(0, Number(elapsedSeconds ?? interview.elapsedSeconds) || 0),
    ...(Number.isFinite(Number(totalScore)) ? { totalScore: Number(totalScore) } : {}),
    ...(reportId ? { reportId } : {}),
    completedAt: now,
    updatedAt: now,
  }));
}

export async function removeLocalInterview(id) {
  const saved = await getLocalInterview(id);
  if (saved.status !== 'draft') {
    throw createInterviewError('Only a draft interview can be deleted.');
  }
  await removeInterviewSnapshot(id);
  return saved;
}
