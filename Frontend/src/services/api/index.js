import { apiClient } from './client';
import { realAuthApi } from './authApi';
import { mockAuthApi } from '../mock/authApi';
import { dashboardApi } from './dashboardApi';
import { questionsApi } from './questionsApi';
import { interviewsApi } from './interviewsApi';
import { answersApi } from './answersApi';
import { reportsApi } from './reportsApi';
import { notesApi } from './notesApi';
import { resumesApi } from './resumesApi';
import { profileApi } from './profileApi';
import { settingsApi } from './settingsApi';
import { adminApi } from './adminApi';

export const apiMode = import.meta.env.VITE_USE_MOCK === 'true' ? 'mock' : 'real';
export const useMocks = apiMode === 'mock';

export function selectApiImplementation(realImplementation, mockImplementation) {
  return useMocks ? mockImplementation : realImplementation;
}

export const authApi = selectApiImplementation(realAuthApi, mockAuthApi);
export { apiClient, dashboardApi, questionsApi, interviewsApi, answersApi, reportsApi, notesApi, resumesApi, profileApi, settingsApi, adminApi };
