import { createInterviewError, getLocalInterview } from '../offline/localInterviews';
import {
  getInterviewSnapshot,
  getLocalAnswer,
  listLocalAnswers,
  saveLocalReport,
  saveLocalAnswer,
} from '../offline/localInterviewStore';
import { aggregateInterview, evaluateAnswer } from '../offline/localScorer';

function answerError(message, status = 400, code = 'INVALID_ANSWER') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function answerId(interviewId, questionIndex) {
  return `${interviewId}-answer-${questionIndex}`;
}

async function localInterviewOrSnapshot(interviewId) {
  try {
    return await getLocalInterview(interviewId);
  } catch (error) {
    if (error.code !== 'INTERVIEW_NOT_FOUND') throw error;
    const snapshot = await getInterviewSnapshot(interviewId);
    if (snapshot?.interview) return snapshot.interview;
    throw error;
  }
}

export async function evaluateSavedAnswers(interview, answers) {
  const savedAnswers = new Map(answers.map((answer) => [Number(answer.questionIndex), answer]));
  const evaluated = [];
  for (const [questionIndex, question] of interview.questions.entries()) {
    const saved = savedAnswers.get(questionIndex) || {
      id: answerId(interview.id, questionIndex),
      interviewId: interview.id,
      questionId: question.questionId,
      questionIndex,
      answerText: '',
      status: 'skipped',
      source: 'offline',
      timeTakenSeconds: 0,
    };
    const evaluation = evaluateAnswer(question, saved.answerText, {
      difficulty: interview.difficulty,
      category: interview.category,
      style: interview.style,
      language: interview.language,
      voiceMetrics: saved.voiceMetrics,
      status: saved.status,
    });
    evaluated.push(await saveLocalAnswer(interview.id, { ...saved, evaluation }));
  }
  const aggregate = aggregateInterview(
    evaluated.map((answer) => ({
      ...answer,
      question: interview.questions[answer.questionIndex],
      category: interview.category,
    })),
    interview,
  );
  await saveLocalReport(aggregate.report);
  return {
    items: aggregate.items,
    totalScore: aggregate.totalScore,
    contentScore: aggregate.contentScore,
    communicationScore: aggregate.communicationScore,
    report: aggregate.report,
    offline: true,
  };
}

export const mockAnswersApi = {
  async submit(interviewId, payload) {
    const interview = await localInterviewOrSnapshot(interviewId);
    if (interview.status !== 'in_progress') {
      throw createInterviewError(`Cannot submit an answer while the interview is ${interview.status}.`);
    }
    if (!Number.isInteger(Number(payload.questionIndex))
      || Number(payload.questionIndex) < 0
      || Number(payload.questionIndex) >= interview.questions.length) {
      throw answerError('The question index is invalid.');
    }
    if (!['answered', 'skipped'].includes(payload.status)) {
      throw answerError('Answer status must be answered or skipped.');
    }
    if (String(payload.answerText || '').length > 5000) {
      throw answerError('Answers cannot exceed 5,000 characters.');
    }
    const questionIndex = Number(payload.questionIndex);
    const existing = (await listLocalAnswers(interviewId)).find((item) => item.questionIndex === questionIndex);
    const answer = {
      id: answerId(interviewId, questionIndex),
      interviewId,
      questionId: payload.questionId || interview.questions[questionIndex].questionId,
      questionIndex,
      answerText: String(payload.answerText || ''),
      status: payload.status,
      source: payload.source || 'text',
      ...(payload.voiceMetrics ? { voiceMetrics: payload.voiceMetrics } : {}),
      timeTakenSeconds: Math.max(0, Number(payload.timeTakenSeconds) || 0),
      attempt: (existing?.attempt || 0) + 1,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    answer.evaluation = evaluateAnswer(interview.questions[questionIndex], answer.answerText, {
      difficulty: interview.difficulty,
      category: interview.category,
      style: interview.style,
      language: interview.language,
      voiceMetrics: answer.voiceMetrics,
      status: answer.status,
    });
    return { answer: await saveLocalAnswer(interviewId, answer), offline: true };
  },

  async list(interviewId) {
    return { items: await listLocalAnswers(interviewId), offline: true };
  },

  async get(interviewId, answerIdValue) {
    return { answer: await getLocalAnswer(interviewId, answerIdValue), offline: true };
  },

  async evaluate(interviewId) {
    const interview = await localInterviewOrSnapshot(interviewId);
    return evaluateSavedAnswers(interview, await listLocalAnswers(interviewId));
  },

  async retry(interviewId, answerIdValue, payload = {}) {
    const answer = await getLocalAnswer(interviewId, answerIdValue);
    const interview = await localInterviewOrSnapshot(interviewId);
    const previousEvaluation = answer.evaluation;
    const answerText = payload.answerText === undefined ? answer.answerText : String(payload.answerText);
    const evaluation = evaluateAnswer(interview.questions[answer.questionIndex], answerText, {
      difficulty: interview.difficulty,
      category: interview.category,
      style: interview.style,
      language: interview.language,
      voiceMetrics: answer.voiceMetrics,
      status: answer.status,
    });
    const updatedAnswer = await saveLocalAnswer(interviewId, {
      ...answer,
      answerText,
      evaluation,
      attempt: (answer.attempt || 0) + 1,
      updatedAt: new Date().toISOString(),
    });
    await evaluateSavedAnswers(interview, await listLocalAnswers(interviewId));
    return {
      answer: updatedAnswer,
      previousEvaluation,
      offline: true,
    };
  },
};
