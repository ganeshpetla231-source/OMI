import { apiClient } from './client';
import { cacheQuestions, getLocalQuestionById, removeCachedQuestion } from '../offline/localQuestions';
import { mockAdminApi } from '../mock/adminApi';

function normalizeQuestion(response) {
  const question = response.data?.question || response.data?.item || response.data;
  if (!question || typeof question !== 'object') {
    throw new Error('The server returned an invalid question.');
  }
  return question;
}

export const realAdminApi = {
  async getDashboard() {
    const response = await apiClient.get('/admin/dashboard');
    return response.data?.dashboard || response.data;
  },
  async createQuestion(payload) {
    const response = await apiClient.post('/admin/questions', payload);
    const question = normalizeQuestion(response);
    await cacheQuestions([question]);
    return { question };
  },
  async updateQuestion(id, payload) {
    const response = await apiClient.put(`/admin/questions/${encodeURIComponent(id)}`, payload);
    const question = normalizeQuestion(response);
    await cacheQuestions([question]);
    return { question };
  },
  async deleteQuestion(id) {
    let cachedQuestion = null;
    try {
      cachedQuestion = await getLocalQuestionById(id);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    const response = await apiClient.delete(`/admin/questions/${encodeURIComponent(id)}`);
    const result = response.data || {};
    const question = result.question || result.item;
    const softDeleted = result.softDeleted === true || result.hardDeleted === false
      || result.deleted === false || result.type === 'soft';
    const hardDeleted = result.hardDeleted === true || result.deleted === true || result.type === 'hard';
    if (question) await cacheQuestions([question]);
    else if (softDeleted && cachedQuestion) await cacheQuestions([{ ...cachedQuestion, isActive: false }]);
    else if (hardDeleted) await removeCachedQuestion(id);
    return result;
  },
};

function selectedApi() {
  return import.meta.env.VITE_USE_MOCK === 'true' ? mockAdminApi : realAdminApi;
}

export const adminApi = {
  getDashboard: (...args) => selectedApi().getDashboard(...args),
  createQuestion: (...args) => selectedApi().createQuestion(...args),
  updateQuestion: (...args) => selectedApi().updateQuestion(...args),
  deleteQuestion: (...args) => selectedApi().deleteQuestion(...args),
};
