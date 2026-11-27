import {
  completeLocalInterview,
  createLocalInterview,
  getLocalInterview,
  listLocalInterviews,
  pauseLocalInterview,
  removeLocalInterview,
  startLocalInterview,
  updateLocalInterview,
} from '../offline/localInterviews';
import { mockAnswersApi } from './answersApi';

export const mockInterviewsApi = {
  create: (payload) => createLocalInterview(payload, 'mock_'),
  get: async (id) => getLocalInterview(id),
  list: async (filters) => listLocalInterviews(filters),
  update: async (id, payload) => updateLocalInterview(id, payload),
  remove: async (id) => removeLocalInterview(id),
  start: async (id) => startLocalInterview(id),
  pause: async (id, payload) => pauseLocalInterview(id, payload?.elapsedSeconds),
  complete: async (id, payload = {}) => {
    const interview = await getLocalInterview(id);
    if (interview.status === 'completed') return interview;
    if (interview.status !== 'in_progress' && interview.status !== 'paused') {
      return completeLocalInterview(id, payload);
    }
    const evaluated = await mockAnswersApi.evaluate(id);
    return completeLocalInterview(id, {
      ...payload,
      totalScore: evaluated.totalScore,
      reportId: evaluated.report?.id,
    });
  },
};
