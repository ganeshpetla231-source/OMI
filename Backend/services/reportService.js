const mongoose = require("mongoose");
const Report = require("../models/Report");
const Interview = require("../models/Interview");
const Answer = require("../models/Answer");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildPagination } = require("../utils/pagination");

function frequencyRank(items) {
  const counts = new Map();
  for (const item of items || []) {
    const value = String(item).trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value]) => value);
}

async function upsertReport(userId, interviewId) {
  if (!mongoose.isValidObjectId(interviewId)) throw new ApiError(404, "Interview not found");
  const interview = await Interview.findOne({ _id: interviewId, user: userId });
  if (!interview) throw new ApiError(404, "Interview not found");
  const answers = await Answer.find({ interview: interview._id, user: userId }).sort({ questionIndex: 1 });
  const byQuestion = new Map(answers.map((answer) => [String(answer.questionId), answer]));

  const questionResults = interview.questions.map((snapshot, index) => {
    const answer = byQuestion.get(String(snapshot.questionId));
    const evaluation = answer?.evaluation || {};
    return {
      questionId: snapshot.questionId,
      questionIndex: index,
      question: snapshot.text,
      answer: answer?.answerText || "",
      score: evaluation.score || 0,
      contentScore: evaluation.contentScore || 0,
      communicationScore: evaluation.communicationScore || 0,
      skill: snapshot.skill || "Problem Solving",
      feedback: evaluation.explanation || "",
      strengths: evaluation.strengths || [],
      weaknesses: evaluation.weaknesses || [],
      suggestions: evaluation.suggestions || [],
      matchedKeywords: evaluation.matchedKeywords || [],
      missingKeywords: evaluation.missingKeywords || [],
      sampleAnswer: evaluation.sampleAnswer || snapshot.expectedAnswer || ""
    };
  });

  const skillScores = new Map();
  for (const result of questionResults) {
    const values = skillScores.get(result.skill) || [];
    values.push(result.score);
    skillScores.set(result.skill, values);
  }
  const rankedSkills = [...skillScores.entries()].map(([skill, values]) => ({
    skill,
    score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  })).sort((a, b) => b.score - a.score);

  const strengths = rankedSkills.slice(0, 3).map((item) => `${item.skill}: ${item.score}/100`);
  const weaknesses = [...rankedSkills].sort((a, b) => a.score - b.score).slice(0, 3).map((item) => `${item.skill}: ${item.score}/100`);
  const missing = frequencyRank(questionResults.flatMap((item) => item.missingKeywords)).slice(0, 5);
  const suggestions = frequencyRank([
    ...questionResults.flatMap((item) => item.suggestions),
    "Practice with timed examples.",
    "Structure answers using situation, action, and result."
  ]).slice(0, 8);

  const fillerCount = answers.reduce((sum, answer) => sum + Number(answer.evaluation?.breakdown?.fillerCount || 0), 0);
  const repeatedCount = answers.reduce((sum, answer) => sum + Number(answer.evaluation?.breakdown?.repeatedCount || 0), 0);
  const wpmValues = answers.map((answer) => Number(answer.voiceMetrics?.wpm || 0)).filter((value) => value > 0);
  const averageWpm = wpmValues.length ? Math.round(wpmValues.reduce((sum, value) => sum + value, 0) / wpmValues.length) : 0;

  const report = await Report.findOneAndUpdate(
    { interview: interview._id, user: userId },
    {
      $set: {
        title: `${interview.category} Interview - ${interview.jobRole}`,
        scores: {
          total: interview.totalScore || 0,
          content: interview.contentScore || 0,
          communication: interview.communicationScore || 0
        },
        questionResults,
        strengths: missing.length ? [...strengths, `Recurring missing keywords: ${missing.join(", ")}`] : strengths,
        weaknesses,
        suggestions,
        communicationAnalysis: {
          score: interview.communicationScore || 0,
          fillerCount,
          repeatedWordCount: repeatedCount,
          averageWpm,
          summary: interview.communicationScore >= 70
            ? "Communication was clear and well structured."
            : "Communication needs more structure and clearer examples."
        },
        method: "rule-based-v1"
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  if (!interview.reportId || String(interview.reportId) !== String(report._id)) {
    interview.reportId = report._id;
    await interview.save();
  }
  return report;
}

async function listReports(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    Report.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments({ user: userId })
  ]);
  const summaries = items.map((report) => ({
    id: report.id,
    interview: report.interview.toString(),
    title: report.title,
    scores: report.scores,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  }));
  return { items: summaries, pagination: buildPagination(page, limit, total) };
}

async function getReport(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Report not found");
  const report = await Report.findOne({ _id: id, user: userId });
  if (!report) throw new ApiError(404, "Report not found");
  return report;
}

module.exports = { upsertReport, listReports, getReport, frequencyRank };
