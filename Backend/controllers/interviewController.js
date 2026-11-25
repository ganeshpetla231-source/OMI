const interviewService = require("../services/interviewService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendCreated, sendPaginated } = require("../utils/response");

const createInterview = asyncHandler(async (req, res) => {
  const setup = {
    duration: req.body.duration,
    questionCount: req.body.questionCount,
    category: req.body.category,
    difficulty: req.body.difficulty,
    language: req.body.language || "en",
    jobRole: req.body.jobRole || "General/Fresher",
    skill: req.body.skill,
    skills: req.body.skills || [],
    mode: req.body.mode || "practice",
    style: req.body.style || "standard",
    noteId: req.body.noteId,
    resumeId: req.body.resumeId,
    clientId: req.body.clientId
  };

  const result = await interviewService.createInterview(req.user.id, setup);
  if (result.idempotent) {
    return sendSuccess(res, 200, "Existing interview returned", result.interview.toJSON());
  }

  const message = result.fewerQuestions
    ? `Interview created with ${result.interview.questions.length} of ${setup.questionCount} questions`
    : "Interview created";
  return sendCreated(res, message, result.interview.toJSON());
});

const listInterviews = asyncHandler(async (req, res) => {
  const result = await interviewService.listInterviews(req.user.id, req.query);
  return sendPaginated(res, "Interviews retrieved", result.items, result.pagination);
});

const getInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.findOwnedInterview(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Interview retrieved", interview.toJSON());
});

const autosaveInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.autosaveInterview(req.user.id, req.params.id, req.body);
  return sendSuccess(res, 200, "Interview progress saved", interview.toJSON());
});

const deleteInterview = asyncHandler(async (req, res) => {
  await interviewService.deleteInterview(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Interview deleted", null);
});

const startInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.startInterview(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Interview started", interview.toJSON());
});

const pauseInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.pauseInterview(req.user.id, req.params.id, (req.body || {}).elapsedSeconds);
  return sendSuccess(res, 200, "Interview paused", interview.toJSON());
});

const resumeInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.resumeInterview(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Interview resumed", interview.toJSON());
});

const completeInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.completeInterview(req.user.id, req.params.id, req.body?.clientEvaluation);
  return sendSuccess(res, 200, "Interview completed", interview.toJSON());
});

module.exports = {
  createInterview,
  listInterviews,
  getInterview,
  autosaveInterview,
  deleteInterview,
  startInterview,
  pauseInterview,
  resumeInterview,
  completeInterview
};
