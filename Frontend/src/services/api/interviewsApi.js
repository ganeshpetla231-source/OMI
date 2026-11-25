import { apiClient } from './client';
import { answersApi } from './answersApi';
import {
  completeLocalInterview,
  createInterviewError,
  createLocalInterview,
  getLocalInterview,
  listLocalInterviews,
  pauseLocalInterview,
  removeLocalInterview,
  startLocalInterview,
  updateLocalInterview,
} from '../offline/localInterviews';
import { mockInterviewsApi } from '../mock/interviewsApi';
import {
  getInterviewIdMapping,
  getInterviewSnapshot,
  listInterviewSnapshots,
  removeInterviewSnapshot,
  saveInterviewSnapshot,
} from '../offline/localInterviewStore';
import { GUEST_MODE_KEY } from '../../utils/authStorage';
import { cancelQueuedInterview, enqueueSyncOperation } from '../offline/syncQueue';

const realInterviewsApi = {
  async create(payload) {
    const { preferredQuestionId, ...requestPayload } = payload;
    const response = await apiClient.post('/interviews', {
      ...requestPayload,
      clientId: payload.clientId || globalThis.crypto?.randomUUID?.(),
    });
    return response.data?.interview || response.data;
  },
  async list(filters = {}) {
    const response = await apiClient.get('/interviews', { params: filters });
    const payload = response.data;
    return {
      items: Array.isArray(payload) ? payload : payload?.items || payload?.interviews || [],
      pagination: response.pagination || payload?.pagination,
    };
  },
  async get(id) {
    const response = await apiClient.get(`/interviews/${encodeURIComponent(id)}`);
    return response.data?.interview || response.data;
  },
  async update(id, payload) {
    const response = await apiClient.put(`/interviews/${encodeURIComponent(id)}`, payload);
    return response.data?.interview || response.data;
  },
  async remove(id) {
    const response = await apiClient.delete(`/interviews/${encodeURIComponent(id)}`);
    return response.data?.interview || response.data;
  },
  async start(id, payload = {}) {
    const response = await apiClient.post(`/interviews/${encodeURIComponent(id)}/start`, payload);
    return response.data?.interview || response.data;
  },
  async pause(id, payload = {}) {
    const response = await apiClient.post(`/interviews/${encodeURIComponent(id)}/pause`, payload);
    return response.data?.interview || response.data;
  },
  async complete(id, payload = {}) {
    const response = await apiClient.post(`/interviews/${encodeURIComponent(id)}/complete`, payload);
    return response.data?.interview || response.data;
  },
};

function isLocalInterview(id) {
  return typeof id === 'string' && (id.startsWith('local_') || id.startsWith('mock_'));
}

function useLocalSource() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true'
    || (typeof navigator !== 'undefined' && !navigator.onLine);
}

function sourceApi() {
  if (useLocalSource()) {
    return {
      create: (payload) => createLocalInterview(payload),
      list: (filters) => listLocalInterviews(filters),
      get: getLocalInterview,
      update: updateLocalInterview,
      remove: removeLocalInterview,
      start: startLocalInterview,
      pause: pauseLocalInterview,
      complete: completeLocalInterview,
    };
  }
  return import.meta.env.VITE_USE_MOCK === 'true' ? mockInterviewsApi : realInterviewsApi;
}

function snapshotNotFound() {
  return createInterviewError('Interview not found in saved interview data.', 404, 'INTERVIEW_NOT_FOUND');
}

async function updateSavedSnapshot(method, id, payload = {}) {
  const saved = await getInterviewSnapshot(id);
  if (!saved?.interview) throw snapshotNotFound();
  const interview = saved.interview;
  const now = new Date().toISOString();
  let updated;

  if (method === 'get') return interview;
  if (method === 'update') {
    if (interview.status === 'completed') throw createInterviewError('A completed interview cannot be updated.');
    updated = { ...interview, ...payload, updatedAt: now };
  } else if (method === 'start') {
    if (interview.status !== 'draft' && interview.status !== 'paused') {
      throw createInterviewError(`Cannot start an interview in the ${interview.status} state.`);
    }
    updated = {
      ...interview,
      status: 'in_progress',
      startedAt: interview.startedAt || now,
      lastResumedAt: now,
      updatedAt: now,
    };
  } else if (method === 'pause') {
    if (interview.status !== 'in_progress') throw createInterviewError(`Cannot pause an interview in the ${interview.status} state.`);
    updated = {
      ...interview,
      status: 'paused',
      elapsedSeconds: Math.max(0, Number(payload.elapsedSeconds ?? saved.elapsedSeconds) || 0),
      pausedAt: now,
      updatedAt: now,
    };
    delete updated.lastResumedAt;
  } else if (method === 'complete') {
    if (interview.status === 'completed') return interview;
    if (interview.status !== 'in_progress' && interview.status !== 'paused') {
      throw createInterviewError(`Cannot complete an interview in the ${interview.status} state.`);
    }
    updated = {
      ...interview,
      status: 'completed',
      elapsedSeconds: Math.max(0, Number(payload.elapsedSeconds ?? saved.elapsedSeconds) || 0),
      ...(Number.isFinite(Number(payload.totalScore)) ? { totalScore: Number(payload.totalScore) } : {}),
      ...(payload.reportId ? { reportId: payload.reportId } : {}),
      completedAt: now,
      updatedAt: now,
    };
  } else if (method === 'remove') {
    await removeInterviewSnapshot(id);
    return interview;
  } else {
    throw new Error(`Unsupported saved interview operation: ${method}`);
  }

  await saveInterviewSnapshot({ ...saved, interview: updated });
  return updated;
}

async function listSavedInterviews(filters = {}, includeLocal = false) {
  const snapshots = await listInterviewSnapshots();
  const saved = snapshots
    .map((snapshot) => snapshot.interview)
    .filter(Boolean);
  const local = includeLocal ? (await listLocalInterviews({ page: 1, limit: 10000 })).items : [];
  const byId = new Map([...local, ...saved].map((interview) => [interview.id, interview]));
  const statusFiltered = [...byId.values()]
    .filter((interview) => !filters.status || interview.status === filters.status)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Number(filters.limit) || 20);
  const pages = Math.ceil(statusFiltered.length / limit);
  const currentPage = pages ? Math.min(page, pages) : 1;
  return {
    items: statusFiltered.slice((currentPage - 1) * limit, currentPage * limit),
    pagination: { page: currentPage, limit, total: statusFiltered.length, pages },
  };
}

function shouldFallback(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500;
}

function isGuest() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true';
}

async function queueInterviewOperation(method, id, request = {}) {
  if (isGuest()) return;
  const interview = await getLocalInterview(id);
  const types = {
    start: 'interview.start',
    update: 'interview.update',
    pause: 'interview.pause',
    complete: 'interview.complete',
    remove: 'interview.remove',
  };
  const type = types[method];
  if (!type) return;
  const payload = type === 'interview.update'
    ? { localId: id, updates: request }
    : { localId: id, request };
  await enqueueSyncOperation(type, payload, {
    localId: id,
    clientId: interview.clientId,
    idempotencyKey: `${type}:${interview.clientId || id}:${interview.updatedAt || Date.now()}`,
  });
}

async function completeLocally(id, payload = {}) {
  const evaluation = await answersApi.evaluate(id);
  const completed = await completeLocalInterview(id, {
    ...payload,
    totalScore: evaluation.totalScore,
    reportId: evaluation.report?.id,
  });
  return { ...completed, clientEvaluation: evaluation.report };
}

async function call(method, args) {
  const api = sourceApi();
  const id = method === 'create' || method === 'list' ? null : args[0];
  if (method === 'create' && api !== realInterviewsApi) {
    const interview = await api.create(args[0]);
    if (api !== mockInterviewsApi && !isGuest() && !String(interview.id).startsWith('mock_')) {
      await enqueueSyncOperation('interview.create', { localId: interview.id, interview }, {
        localId: interview.id,
        clientId: interview.clientId,
        idempotencyKey: `interview.create:${interview.clientId}`,
      });
    }
    return interview;
  }
  if (id && isLocalInterview(id)) {
    const mappedId = await getInterviewIdMapping(id);
    if (mappedId) return call(method, [mappedId, ...args.slice(1)]);
    if (method === 'get') return getLocalInterview(id);
    if (method === 'list') return listLocalInterviews(args[0]);
    let updated;
    if (method === 'update') updated = await updateLocalInterview(id, args[1]);
    if (method === 'remove') updated = await removeLocalInterview(id);
    if (method === 'start') updated = await startLocalInterview(id);
    if (method === 'pause') updated = await pauseLocalInterview(id, args[1]?.elapsedSeconds);
    if (method === 'complete') updated = await completeLocally(id, args[1]);
    if (updated && id.startsWith('local_')) {
      if (method === 'remove') await cancelQueuedInterview(id);
      else await queueInterviewOperation(method, id, method === 'complete'
        ? { ...args[1], clientEvaluation: updated.clientEvaluation }
        : args[1]);
    }
    return updated;
  }

  if (api !== realInterviewsApi && id && useLocalSource()) {
    const savedBefore = method === 'remove' ? await getInterviewSnapshot(id) : null;
    const evaluation = method === 'complete' ? await answersApi.evaluate(id) : null;
    const request = evaluation
      ? { ...args[1], totalScore: evaluation.totalScore, reportId: evaluation.report?.id, clientEvaluation: evaluation.report }
      : args[1];
    const updated = await updateSavedSnapshot(method, id, request);
    if (method === 'remove' && !isGuest() && savedBefore?.interview) {
      await enqueueSyncOperation('interview.remove', { localId: id }, {
        localId: id,
        clientId: savedBefore.interview.clientId,
        idempotencyKey: `interview.remove:${savedBefore.interview.clientId || id}:${savedBefore.interview.updatedAt || Date.now()}`,
      });
    } else {
      await queueInterviewOperation(method, id, request);
    }
    return updated;
  }
  if (method === 'list' && api !== realInterviewsApi && useLocalSource()) {
    return listSavedInterviews(args[0], true);
  }

  try {
    return await api[method](...args);
  } catch (error) {
    if (!shouldFallback(error)) throw error;
    if (method === 'create') {
      const interview = await createLocalInterview(args[0]);
      if (!isGuest()) {
        await enqueueSyncOperation('interview.create', { localId: interview.id, interview }, {
          localId: interview.id,
          clientId: interview.clientId,
          idempotencyKey: `interview.create:${interview.clientId}`,
        });
      }
      return interview;
    }
    if (method === 'get') return updateSavedSnapshot('get', id);
    if (method === 'list') return listSavedInterviews(args[0], true);
    if (['update', 'start', 'pause', 'complete', 'remove'].includes(method)) {
      const savedBefore = await getInterviewSnapshot(id);
      const evaluation = method === 'complete' ? await answersApi.evaluate(id) : null;
      const request = evaluation
        ? { ...args[1], totalScore: evaluation.totalScore, reportId: evaluation.report?.id, clientEvaluation: evaluation.report }
        : args[1];
      const updated = await updateSavedSnapshot(method, id, request);
      if (!isGuest() && savedBefore?.interview) {
        await enqueueSyncOperation(`interview.${method}`, { localId: id, request: request || {}, updates: request || {} }, {
          localId: id,
          clientId: savedBefore.interview.clientId,
          idempotencyKey: `interview.${method}:${savedBefore.interview.clientId || id}:${savedBefore.interview.updatedAt || Date.now()}`,
        });
      }
      return updated;
    }
    throw error;
  }
}

export const interviewsApi = {
  create: (payload) => call('create', [payload]),
  list: (filters) => call('list', [filters]),
  get: (id) => call('get', [id]),
  update: (id, payload) => call('update', [id, payload]),
  remove: (id) => call('remove', [id]),
  start: (id, payload) => call('start', [id, payload]),
  pause: (id, payload) => call('pause', [id, payload]),
  complete: (id, payload) => call('complete', [id, payload]),
};
