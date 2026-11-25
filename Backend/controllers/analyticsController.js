const dashboardService = require("../services/dashboardService");
const reportService = require("../services/reportService");
const { streamReport } = require("../services/pdfReport");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendPaginated } = require("../utils/response");

const stats = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "Dashboard stats retrieved", await dashboardService.stats(req.user.id));
});
const activity = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "Recent activity retrieved", await dashboardService.activity(req.user.id, parseInt(req.query.limit, 10) || 5));
});
const skills = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "Skill performance retrieved", await dashboardService.skills(req.user.id));
});
const recommendations = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "Recommendations retrieved", await dashboardService.recommendations(req.user.id));
});

const listReports = asyncHandler(async (req, res) => {
  const data = await reportService.listReports(req.user.id, req.query);
  return sendPaginated(res, "Reports retrieved", data.items, data.pagination);
});
const getReport = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "Report retrieved", (await reportService.getReport(req.user.id, req.params.id)).toJSON());
});
const downloadReport = asyncHandler(async (req, res) => {
  const report = await reportService.getReport(req.user.id, req.params.id);
  streamReport(report, res);
});
const progress = asyncHandler(async (req, res) => {
  const period = req.query.period === "month" ? "month" : "week";
  return sendSuccess(res, 200, "Progress retrieved", await dashboardService.progress(req.user.id, period));
});

module.exports = { stats, activity, skills, recommendations, listReports, getReport, downloadReport, progress };
