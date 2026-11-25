import { apiClient } from './client';
import { mockAnswersApi } from '../mock/answersApi';
import {
  getLocalAnswer,
  getInterviewSnapshot,
  getInterviewIdMapping,
  listLocalAnswers,
  markAnswerSynced,
  saveLocalAnswer,
} from '../offline/localInterviewStore';
import { GUEST_MODE_KEY } from '../../utils/authStorage';
import { enqueueSyncOperation } from '../offline/syncQueue';
import { evaluateAnswer } from '../offline/localScorer';

function isGuest() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true';
}

function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

function isMockMode() {
  return import.meta.env.VITE_USE_MOCK === 'true';
}

function useLocalSource() {
  return isGuest() || isOffline() || isMockMode();
}

function shouldFallback(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500;
}

async function queueAnswer(interviewId, answer) {
  if (isGuest() || isMockMode()) return;
  const snapshot = await getInterviewSnapshot(interviewId);
  const clientId = snapshot?.interview?.clientId;
  await enqueueSyncOperation('answers.submit', {
    localId: interviewId,
    answers: [answer],
  }, {
    localId: interviewId,
    clientId,
    idempotencyKey: `answers.submit:${clientId || interviewId}:${answer.questionIndex}`,
  });
}

function answerFrom(response) {
  return response.data?.answer || response.data;
}

function answersFrom(response) {
  const payload = response.data;
  const items = Array.isArray(payload) ? payload : payload?.items || payload?.answers || [];
  return { items, pagination: response.pagination || payload?.pagination };
}

function localAnswerId(interviewId, questionIndex) {
  return `${interviewId}-answer-${questionIndex}`;
}

export const answersApi = {
  async submit(interviewId, payload) {
    if (useLocalSource()) {
      const result = await mockAnswersApi.submit(interviewId, payload);
      if (isOffline() && !isGuest() && !isMockMode()) {
        await queueAnswer(interviewId, result.answer);
        return { ...result, queued: true };
      }
      return result;
    }

    const remoteInterviewId = await getInterviewIdMapping(interviewId) || interviewId;
    const answers = await listLocalAnswers(interviewId);
    const previous = answers.find((answer) => answer.questionIndex === Number(payload.questionIndex));
    const localAnswer = await saveLocalAnswer(interviewId, {
      ...payload,
      id: localAnswerId(interviewId, payload.questionIndex),
      interviewId,
      attempt: (previous?.attempt || 0) + 1,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      const response = await apiClient.post(`/interviews/${encodeURIComponent(remoteInterviewId)}/answers`, payload);
      const answer = answerFrom(response);
      const saved = await saveLocalAnswer(interviewId, {
        ...localAnswer,
        ...answer,
        id: localAnswer.id,
        interviewId,
      });
      await markAnswerSynced(interviewId, localAnswer);
      return { answer: saved, offline: false };
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      const interview = (await getInterviewSnapshot(interviewId))?.interview;
      const question = interview?.questions?.[Number(payload.questionIndex)];
      if (!question) throw error;
      const answer = await saveLocalAnswer(interviewId, {
        ...localAnswer,
        evaluation: evaluateAnswer(question, localAnswer.answerText, {
          difficulty: interview.difficulty,
          category: interview.category,
          style: interview.style,
          language: interview.language,
          voiceMetrics: localAnswer.voiceMetrics,
          status: localAnswer.status,
        }),
      });
      await queueAnswer(interviewId, answer);
      return { answer, offline: true, queued: true };
    }
  },

  async list(interviewId) {
    if (useLocalSource()) return mockAnswersApi.list(interviewId);
    const remoteInterviewId = await getInterviewIdMapping(interviewId) || interviewId;
    try {
      const response = await apiClient.get(`/interviews/${encodeURIComponent(remoteInterviewId)}/answers`);
      const result = answersFrom(response);
      const items = await Promise.all(result.items.map((answer) => saveLocalAnswer(interviewId, {
        ...answer,
        id: localAnswerId(interviewId, answer.questionIndex),
        interviewId,
      })));
      return { ...result, items, offline: false };
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      return { items: await listLocalAnswers(interviewId), offline: true };
    }
  },

  async get(interviewId, answerId) {
    if (useLocalSource()) return mockAnswersApi.get(interviewId, answerId);
    const remoteInterviewId = await getInterviewIdMapping(interviewId) || interviewId;
    try {
      const response = await apiClient.get(`/interviews/${encodeURIComponent(remoteInterviewId)}/answers/${encodeURIComponent(answerId)}`);
      const answer = await saveLocalAnswer(interviewId, { ...answerFrom(response), interviewId });
      return { answer, offline: false };
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      return { answer: await getLocalAnswer(interviewId, answerId), offline: true };
    }
  },

  async evaluate(interviewId) {
    if (useLocalSource()) return mockAnswersApi.evaluate(interviewId);
    const remoteInterviewId = await getInterviewIdMapping(interviewId) || interviewId;
    try {
      const response = await apiClient.post(`/interviews/${encodeURIComponent(remoteInterviewId)}/evaluate`, {});
      return { ...(response.data || {}), offline: false };
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      return mockAnswersApi.evaluate(interviewId);
    }
  },

  async retry(interviewId, answerId, payload = {}) {
    if (useLocalSource()) {
      const result = await mockAnswersApi.retry(interviewId, answerId, payload);
      if (isOffline() && !isGuest() && !isMockMode()) await queueAnswer(interviewId, result.answer);
      return result;
    }
    const remoteInterviewId = await getInterviewIdMapping(interviewId) || interviewId;
    let previousAnswer = null;
    try {
      previousAnswer = await getLocalAnswer(interviewId, answerId);
    } catch (error) {
      if (error?.code !== 'ANSWER_NOT_FOUND') throw error;
    }
    try {
      const response = await apiClient.post(
        `/interviews/${encodeURIComponent(remoteInterviewId)}/answers/${encodeURIComponent(answerId)}/retry`,
        payload,
      );
      const responseAnswer = answerFrom(response);
      const answer = await saveLocalAnswer(interviewId, {
        ...previousAnswer,
        ...responseAnswer,
        id: previousAnswer?.id || localAnswerId(interviewId, payload.questionIndex ?? responseAnswer.questionIndex),
        interviewId,
      });
      return {
        answer,
        previousEvaluation: response.data?.previousEvaluation || previousAnswer?.evaluation,
        offline: false,
      };
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      const result = await mockAnswersApi.retry(interviewId, answerId, payload);
      await queueAnswer(interviewId, result.answer);
      return { ...result, offline: true, queued: true };
    }
  },
};
