const mongoose = require("mongoose");
const Answer = require("../models/Answer");
const Interview = require("../models/Interview");
const ApiError = require("../utils/ApiError");
const { scoreAnswer } = require("./scoringService");

async function findOwnedInterview(userId, interviewId) {
  if (!mongoose.isValidObjectId(interviewId)) throw new ApiError(404, "Interview not found");
  const interview = await Interview.findOne({ _id: interviewId, user: userId });
  if (!interview) throw new ApiError(404, "Interview not found");
  return interview;
}

function findSnapshot(interview, questionId) {
  return interview.questions.find((question) => String(question.questionId) === String(questionId));
}

async function submitAnswer(userId, interviewId, payload) {
  const interview = await findOwnedInterview(userId, interviewId);
  if (!["in_progress", "paused"].includes(interview.status)) {
    throw new ApiError(400, "Answers can only be submitted while an interview is in progress or paused");
  }

  const snapshot = findSnapshot(interview, payload.questionId);
  if (!snapshot) throw new ApiError(400, "Question is not part of this interview");

  const skipped = payload.status === "skipped" || !payload.answerText?.trim();
  const answerText = skipped ? "" : String(payload.answerText);
  const evaluation = scoreAnswer(snapshot, answerText, {
    interviewStyle: interview.style,
    language: interview.language,
    voiceMetrics: payload.voiceMetrics
  });

  const existing = await Answer.findOne({ interview: interview._id, questionId: payload.questionId });
  if (existing) {
    existing.answerText = answerText;
    existing.status = skipped ? "skipped" : "answered";
    existing.source = payload.source || "text";
    existing.timeTakenSeconds = payload.timeTakenSeconds || 0;
    existing.voiceMetrics = payload.voiceMetrics || {};
    existing.evaluation = evaluation;
    existing.questionIndex = interview.questions.findIndex((item) => item.questionId === snapshot.questionId);
    await existing.save();
    return existing;
  }

  return Answer.create({
    interview: interview._id,
    user: userId,
    questionId: payload.questionId,
    questionIndex: interview.questions.findIndex((item) => item.questionId === snapshot.questionId),
    answerText,
    status: skipped ? "skipped" : "answered",
    source: payload.source || "text",
    timeTakenSeconds: payload.timeTakenSeconds || 0,
    voiceMetrics: payload.voiceMetrics || {},
    attempt: 1,
    evaluation
  });
}

async function submitAnswers(userId, body) {
  if (Array.isArray(body.answers)) {
    const items = [];
    for (const payload of body.answers) {
      items.push(await submitAnswer(userId, body.interviewId, payload));
    }
    return items;
  }
  return submitAnswer(userId, body.interviewId, body);
}

async function listAnswers(userId, interviewId) {
  await findOwnedInterview(userId, interviewId);
  const answers = await Answer.find({ interview: interviewId, user: userId }).sort({ questionIndex: 1 });
  return answers.map((answer) => answer.toJSON());
}

async function getAnswer(userId, answerId) {
  if (!mongoose.isValidObjectId(answerId)) throw new ApiError(404, "Answer not found");
  const answer = await Answer.findOne({ _id: answerId, user: userId });
  if (!answer) throw new ApiError(404, "Answer not found");
  return answer;
}

async function recomputeInterview(userId, interviewId) {
  const interview = await findOwnedInterview(userId, interviewId);
  const answers = await Answer.find({ interview: interview._id, user: userId });
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

  let total = 0;
  let content = 0;
  let communication = 0;
  const count = interview.questions.length;

  for (const snapshot of interview.questions) {
    const answer = byQuestion.get(snapshot.questionId);
    if (!answer) continue;
    total += answer.status === "skipped" ? 0 : answer.evaluation?.score || 0;
    content += answer.status === "skipped" ? 0 : answer.evaluation?.contentScore || 0;
    communication += answer.status === "skipped" ? 0 : answer.evaluation?.communicationScore || 0;
  }

  interview.totalScore = count ? Math.round(total / count) : 0;
  interview.contentScore = count ? Math.round(content / count) : 0;
  interview.communicationScore = count ? Math.round(communication / count) : 0;
  await interview.save();
  const { upsertReport } = require("./reportService");
  await upsertReport(userId, interviewId);

  return {
    interview: interview.toJSON(),
    report: {
      interviewId: interview.id,
      totalScore: interview.totalScore,
      contentScore: interview.contentScore,
      communicationScore: interview.communicationScore,
      evaluationMethod: "rule-based-v1",
      answerCount: answers.length
    }
  };
}

async function retryAnswer(userId, answerId, payload) {
  const answer = await getAnswer(userId, answerId);
  const interview = await findOwnedInterview(userId, answer.interview);
  const snapshot = findSnapshot(interview, answer.questionId);
  if (!snapshot) throw new ApiError(400, "Question is not part of this interview");

  const skipped = payload.status === "skipped" || !payload.answerText?.trim();
  const previous = {
    answerText: answer.answerText,
    score: answer.evaluation?.score || 0,
    evaluation: answer.evaluation,
    at: new Date()
  };

  answer.attempts.push({
    answerText: previous.answerText,
    score: previous.score,
    evaluation: previous.evaluation,
    at: new Date()
  });
  answer.attempt += 1;
  answer.answerText = skipped ? "" : String(payload.answerText);
  answer.status = skipped ? "skipped" : "answered";
  answer.source = payload.source || answer.source;
  answer.timeTakenSeconds = payload.timeTakenSeconds || answer.timeTakenSeconds;
  answer.voiceMetrics = payload.voiceMetrics || answer.voiceMetrics;
  answer.evaluation = scoreAnswer(snapshot, answer.answerText, {
    interviewStyle: interview.style,
    language: interview.language,
    voiceMetrics: answer.voiceMetrics
  });
  await answer.save();
  await recomputeInterview(userId, interview.id);

  return { answer: answer.toJSON(), previous };
}

async function reEvaluateAnswers(userId, interviewId) {
  const interview = await findOwnedInterview(userId, interviewId);
  const answers = await Answer.find({ interview: interview._id, user: userId });

  for (const answer of answers) {
    const snapshot = findSnapshot(interview, answer.questionId);
    if (!snapshot) continue;
    answer.evaluation = scoreAnswer(snapshot, answer.status === "skipped" ? "" : answer.answerText, {
      interviewStyle: interview.style,
      language: interview.language,
      voiceMetrics: answer.voiceMetrics
    });
    await answer.save();
  }

  return recomputeInterview(userId, interviewId);
}

module.exports = {
  submitAnswer,
  submitAnswers,
  listAnswers,
  getAnswer,
  recomputeInterview,
  reEvaluateAnswers,
  retryAnswer
};
