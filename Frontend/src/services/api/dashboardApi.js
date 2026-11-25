import { apiClient } from './client';
import { mockDashboardApi } from '../mock/dashboardApi';
import { localDashboardApi } from '../offline/localDashboard';
import { GUEST_MODE_KEY, getStoredToken } from '../../utils/authStorage';

const realDashboardApi = {
  async getStats() {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },
  async getActivity() {
    const response = await apiClient.get('/dashboard/activity');
    return response.data;
  },
  async getSkills() {
    const response = await apiClient.get('/dashboard/skills');
    return response.data;
  },
  async getRecommendations() {
    const response = await apiClient.get('/dashboard/recommendations');
    return response.data;
  },
};

function selectDashboardApi() {
  if (localStorage.getItem(GUEST_MODE_KEY) === 'true'
    || (typeof navigator !== 'undefined' && !navigator.onLine)) return localDashboardApi;
  if (import.meta.env.VITE_USE_MOCK === 'true') return mockDashboardApi;
  return getStoredToken() ? realDashboardApi : localDashboardApi;
}

function useLocalFallback(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500;
}

async function invoke(method, args) {
  const selected = selectDashboardApi();
  try {
    return await selected[method](...args);
  } catch (error) {
    if (selected === localDashboardApi || import.meta.env.VITE_USE_MOCK === 'true' || !useLocalFallback(error)) throw error;
    return localDashboardApi[method](...args);
  }
}

export const dashboardApi = {
  getStats: (...args) => invoke('getStats', args),
  getActivity: (...args) => invoke('getActivity', args),
  getSkills: (...args) => invoke('getSkills', args),
  getRecommendations: (...args) => invoke('getRecommendations', args),
};
