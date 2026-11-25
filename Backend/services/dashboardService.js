const mongoose = require("mongoose");
const Interview = require("../models/Interview");
const Answer = require("../models/Answer");
const Report = require("../models/Report");

function startOfPeriod(period, date) {
  const value = new Date(date);
  if (period === "month") {
    value.setUTCDate(1);
    value.setUTCHours(0, 0, 0, 0);
  } else {
    const day = value.getUTCDay();
    value.setUTCDate(value.getUTCDate() - ((day + 6) % 7));
    value.setUTCHours(0, 0, 0, 0);
  }
  return value;
}

async function stats(userId) {
  const [interviewStats, answerCount, reportCount] = await Promise.all([
    Interview.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), status: "completed" } },
      { $group: { _id: null, completedCount: { $sum: 1 }, averageScore: { $avg: "$totalScore" } } }
    ]),
    Answer.countDocuments({ user: userId }),
    Report.countDocuments({ user: userId })
  ]);
  const completed = interviewStats[0]?.completedCount || 0;
  return {
    completedInterviews: completed,
    averageScore: completed ? Math.round(interviewStats[0].averageScore || 0) : 0,
    answeredQuestions: answerCount,
    reportsGenerated: reportCount
  };
}

async function activity(userId, limit = 5) {
  const items = await Interview.find({ user: userId, status: "completed" })
    .sort({ completedAt: -1, updatedAt: -1 })
    .limit(Math.min(20, Math.max(1, limit)))
    .select("title category jobRole totalScore completedAt createdAt");
  return items.map((item) => ({
    id: item.id,
    title: `${item.category} interview`,
    jobRole: item.jobRole,
    score: item.totalScore || 0,
    completedAt: item.completedAt || item.updatedAt
  }));
}

async function skills(userId) {
  const reports = await Report.find({ user: userId }).select("questionResults").lean();
  const totals = new Map();
  for (const report of reports) {
    for (const result of report.questionResults || []) {
      const skill = result.skill || "Problem Solving";
      const entry = totals.get(skill) || { sum: 0, count: 0 };
      entry.sum += result.score || 0;
      entry.count += 1;
      totals.set(skill, entry);
    }
  }
  const items = [...totals.entries()].map(([skill, value]) => ({
    skill,
    averageScore: Math.round(value.sum / value.count)
  })).sort((a, b) => b.averageScore - a.averageScore);
  return { strong: items.filter((item) => item.averageScore >= 70).slice(0, 5), weak: [...items].sort((a, b) => a.averageScore - b.averageScore).slice(0, 5) };
}

async function recommendations(userId) {
  const { weak } = await skills(userId);
  if (!weak.length) {
    return [
      { skill: "Communication", recommendation: "Practice structured answers and use the STAR format." },
      { skill: "Problem Solving", recommendation: "Explain one problem, your actions, and the result." },
      { skill: "Technical Fundamentals", recommendation: "Review core concepts and give practical examples." }
    ];
  }
  return weak.slice(0, 3).map((item) => ({
    skill: item.skill,
    averageScore: item.averageScore,
    recommendation: `Practice ${item.skill} with timed, example-based answers.`
  }));
}

async function progress(userId, period = "week") {
  const isMonth = period === "month";
  const periodsCount = isMonth ? 6 : 8;
  const now = new Date();
  const points = [];

  for (let offset = periodsCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    if (isMonth) date.setUTCMonth(date.getUTCMonth() - offset, 1);
    else date.setUTCDate(date.getUTCDate() - offset * 7);
    points.push(startOfPeriod(isMonth ? "month" : "week", date));
  }

  const start = points[0];
  const interviews = await Interview.find({
    user: userId,
    status: "completed",
    completedAt: { $gte: start }
  }).select("completedAt totalScore");

  const buckets = new Map(points.map((date) => [date.toISOString().slice(0, 10), []]));
  for (const interview of interviews) {
    const date = startOfPeriod(isMonth ? "month" : "week", interview.completedAt || interview.updatedAt);
    const key = date.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.get(key).push(interview.totalScore || 0);
  }

  const data = points.map((date) => {
    const values = buckets.get(date.toISOString().slice(0, 10)) || [];
    return {
      period: date.toISOString().slice(0, 10),
      averageScore: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
      interviewCount: values.length
    };
  });
  const last = data[data.length - 1]?.averageScore || 0;
  const previous = data[data.length - 2]?.averageScore || 0;
  return { period: isMonth ? "month" : "week", data, improvement: last - previous };
}

module.exports = { stats, activity, skills, recommendations, progress };
