import { apiClient } from './client';
import { mockQuestionsApi } from '../mock/questionsApi';
import {
  cacheQuestionOptions,
  cacheQuestions,
  getLocalCategories,
  getLocalQuestionById,
  getLocalRoles,
  getLocalSkills,
  initializeQuestionCache,
  listLocalQuestions,
  randomLocalQuestions,
} from '../offline/localQuestions';
import { GUEST_MODE_KEY } from '../../utils/authStorage';
import { generateQuestionsFromNote, generateQuestionsFromResume } from '../offline/notesProcessor';

function listParams(filters = {}) {
  const params = {};
  const fields = ['category', 'difficulty', 'language', 'page', 'limit', 'skill', 'search'];
  fields.forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== '') params[key] = filters[key];
  });
  const jobRole = filters.jobRole || filters.role;
  if (jobRole) params.jobRole = jobRole;
  if (filters.isActive !== undefined) params.isActive = filters.isActive;
  if (filters.includeInactive) params.includeInactive = true;
  return params;
}

function itemsFrom(payload, keys = ['items', 'questions', 'results', 'generated']) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (payload?.question && typeof payload.question === 'object') return [payload.question];
  return [];
}

function normalizeListResponse(response) {
  const payload = response.data;
  const items = itemsFrom(payload);
  const pagination = response.pagination || payload?.pagination || {
    page: 1,
    limit: items.length,
    total: items.length,
    pages: items.length ? 1 : 0,
  };
  return { items, pagination, offline: false };
}

function shouldUseLocal() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true'
    || (typeof navigator !== 'undefined' && !navigator.onLine);
}

async function useRealOrFallback(request, localFallback) {
  try {
    return await request();
  } catch (error) {
    if (error.code !== 'NETWORK_ERROR' && !(error.status >= 500)) throw error;
    return localFallback();
  }
}

export const realQuestionsApi = {
  async list(filters = {}) {
    const response = await apiClient.get('/questions', { params: listParams(filters) });
    const result = normalizeListResponse(response);
    await cacheQuestions(result.items);
    return result;
  },

  async getById(id) {
    const response = await apiClient.get(`/questions/${encodeURIComponent(id)}`);
    const item = response.data?.question || response.data?.item || response.data;
    await cacheQuestions([item]);
    return { item, offline: false };
  },

  async getCategories() {
    const response = await apiClient.get('/questions/categories');
    const items = itemsFrom(response.data, ['items', 'categories', 'results']);
    await cacheQuestionOptions('categories', items);
    return { items, offline: false };
  },

  async getRoles(filters = {}) {
    const response = await apiClient.get('/questions/roles', { params: filters.category ? { category: filters.category } : {} });
    const items = itemsFrom(response.data, ['items', 'roles', 'results']);
    await cacheQuestionOptions(filters.category ? `roles:${filters.category}` : 'roles', items);
    return { items, offline: false };
  },

  async getSkills(filters = {}) {
    const params = {};
    if (filters.category) params.category = filters.category;
    if (filters.jobRole) params.jobRole = filters.jobRole;
    const response = await apiClient.get('/questions/skills', { params });
    const items = itemsFrom(response.data, ['items', 'skills', 'results']);
    await cacheQuestionOptions(`skills:${filters.category || '*'}:${filters.jobRole || '*'}`, items);
    return { items, offline: false };
  },

  async generate(payload = {}) {
    const response = await apiClient.post('/questions/generate', payload);
    const result = normalizeListResponse(response);
    await cacheQuestions(result.items);
    return result;
  },

  async random(filters = {}) {
    const response = await apiClient.get('/questions/random', { params: { ...listParams(filters), count: filters.count || 1 } });
    const result = normalizeListResponse(response);
    await cacheQuestions(result.items);
    return result;
  },
};

const localQuestionsApi = {
  async list(filters = {}) {
    const result = await listLocalQuestions(filters);
    return { ...result, offline: true };
  },
  async getById(id) {
    return { item: await getLocalQuestionById(id), offline: true };
  },
  async getCategories() {
    return { items: await getLocalCategories(), offline: true };
  },
  async getRoles(filters) {
    return { items: await getLocalRoles(filters?.category), offline: true };
  },
  async getSkills(filters) {
    return { items: await getLocalSkills(filters), offline: true };
  },
  async generate(filters = {}) {
    if (filters.resumeId) {
      const error = new Error('Resume-based questions need an internet connection and server-side extraction.');
      error.code = 'RESUME_ONLINE_REQUIRED';
      throw error;
    }
    if (filters.noteId) return generateQuestionsFromNote(filters.noteId, filters);
    const result = await listLocalQuestions({ ...filters, page: 1, limit: filters.count || 5 });
    if (!result.items.length) {
      const error = new Error('No saved questions match those filters.');
      error.status = 400;
      error.code = 'NO_QUESTIONS';
      throw error;
    }
    return { ...result, offline: true };
  },
  async random(filters = {}) {
    const result = await randomLocalQuestions(filters);
    return { ...result, offline: true };
  },
};

function sourceApi() {
  if (shouldUseLocal()) return localQuestionsApi;
  return import.meta.env.VITE_USE_MOCK === 'true' ? mockQuestionsApi : realQuestionsApi;
}

function invoke(method, args, localFallback) {
  const api = sourceApi();
  if (api === localQuestionsApi || api === mockQuestionsApi) return api[method](...args);
  return useRealOrFallback(() => api[method](...args), localFallback);
}

export const questionsApi = {
  initialize: initializeQuestionCache,
  list: (filters) => invoke('list', [filters], () => localQuestionsApi.list(filters)),
  getById: (id) => invoke('getById', [id], () => localQuestionsApi.getById(id)),
  getCategories: () => invoke('getCategories', [], () => localQuestionsApi.getCategories()),
  getRoles: (filters) => invoke('getRoles', [filters], () => localQuestionsApi.getRoles(filters)),
  getSkills: (filters) => invoke('getSkills', [filters], () => localQuestionsApi.getSkills(filters)),
  generate: (filters) => invoke('generate', [filters], () => localQuestionsApi.generate(filters)),
  random: (filters) => invoke('random', [filters], () => localQuestionsApi.random(filters)),
};
