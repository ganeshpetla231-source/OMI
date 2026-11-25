const answerService = require("../services/answerService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendCreated } = require("../utils/response");

const submitAnswers = asyncHandler(async (req, res) => {
  const result = await answerService.submitAnswers(req.user.id, req.body);
  const data = Array.isArray(result) ? result.map((answer) => answer.toJSON()) : result.toJSON();
  return sendCreated(res, "Answer submitted", data);
});

const listAnswers = asyncHandler(async (req, res) => {
  const data = await answerService.listAnswers(req.user.id, req.params.interviewId);
  return sendSuccess(res, 200, "Answers retrieved", data);
});

const getAnswer = asyncHandler(async (req, res) => {
  const answer = await answerService.getAnswer(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Answer retrieved", answer.toJSON());
});

const reEvaluate = asyncHandler(async (req, res) => {
  const data = await answerService.reEvaluateAnswers(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Interview evaluated", data);
});

const retryAnswer = asyncHandler(async (req, res) => {
  const data = await answerService.retryAnswer(req.user.id, req.params.id, req.body);
  return sendSuccess(res, 200, "Answer retried", data);
});

module.exports = { submitAnswers, listAnswers, getAnswer, reEvaluate, retryAnswer };
