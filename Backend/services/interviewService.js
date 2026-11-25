const mongoose = require("mongoose");
const Interview = require("../models/Interview");
const { generateQuestions } = require("./questionGenerator");
const ApiError = require("../utils/ApiError");

function freezeQuestions(items, style) {
  return items.map((item) => ({
    questionId: String(item.id || item._id || item.questionId || ""),
    text: item.text,
    expectedAnswer: item.expectedAnswer || "",
    keywords: item.keywords || [],
    timeLimitSeconds: style === "rapid-fire"
      ? Math.max(15, Math.floor((item.timeLimitSeconds || 150) * 0.5))
      : item.timeLimitSeconds || 150,
    skill: item.skill || "Problem Solving",
    difficulty: item.difficulty || "medium",
    source: item.source || "bank"
  })).filter((item) => item.text);
}

async function createInterview(userId, setup) {
  if (setup.clientId) {
    const existing = await Interview.findOne({ user: userId, clientId: setup.clientId });
    if (existing) return { interview: existing, idempotent: true };
  }

  const generated = await generateQuestions({
    count: setup.questionCount,
    category: setup.category,
    difficulty: setup.difficulty,
    language: setup.language,
    jobRole: setup.jobRole,
    skill: setup.skill,
    skills: setup.skills,
    noteId: setup.noteId,
    resumeId: setup.resumeId,
    userId
  });

  const questions = freezeQuestions(generated.questions, setup.style);
  if (!questions.length) {
    throw new ApiError(400, "No interview questions are available");
  }

  const interview = await Interview.create({
    user: userId,
    clientId: setup.clientId,
    duration: setup.duration,
    questionCount: setup.questionCount,
    category: setup.category,
    difficulty: setup.difficulty,
    language: setup.language,
    jobRole: setup.jobRole,
    skill: setup.skill,
    skills: setup.skills || [],
    mode: setup.mode,
    style: setup.style,
    noteId: setup.noteId,
    resumeId: setup.resumeId,
    questions,
    status: "draft"
  });

  return {
    interview,
    idempotent: false,
    fewerQuestions: questions.length < setup.questionCount
  };
}

async function findOwnedInterview(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Interview not found");
  const interview = await Interview.findOne({ _id: id, user: userId });
  if (!interview) throw new ApiError(404, "Interview not found");
  return interview;
}

async function listInterviews(userId, query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const filter = { user: userId };
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.language) filter.language = query.language;
  const [items, total] = await Promise.all([
    Interview.find(filter)
      .select("-questions")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Interview.countDocuments(filter)
  ]);
  return {
    items: items.map((item) => item.toJSON()),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
}

async function autosaveInterview(userId, id, updates) {
  const interview = await findOwnedInterview(userId, id);
  if (interview.status === "completed") {
    throw new ApiError(400, "Cannot autosave a completed interview");
  }

  const allowed = ["currentIndex", "elapsedSeconds"];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      interview[key] = updates[key];
    }
  }
  await interview.save();
  return interview;
}

async function deleteInterview(userId, id) {
  const interview = await findOwnedInterview(userId, id);

  for (const name of ["Answer", "Report", "Evaluation"]) {
    if (!mongoose.models[name]) continue;
    await mongoose.models[name].deleteMany({
      $or: [{ interview: interview._id }, { interviewId: interview._id }]
    });
  }

  await interview.deleteOne();
  return null;
}

async function startInterview(userId, id) {
  const interview = await findOwnedInterview(userId, id);
  if (interview.status === "completed") {
    throw new ApiError(400, "Cannot start a completed interview");
  }
  if (interview.status === "in_progress") {
    throw new ApiError(400, "Interview is already in progress");
  }
  if (interview.status === "draft" || interview.status === "paused") {
    interview.status = "in_progress";
    interview.pausedAt = null;
    if (!interview.startedAt) interview.startedAt = new Date();
  }
  await interview.save();
  return interview;
}

async function pauseInterview(userId, id, elapsedSeconds) {
  const interview = await findOwnedInterview(userId, id);
  if (interview.status === "completed") {
    throw new ApiError(400, "Cannot pause a completed interview");
  }
  if (interview.status !== "in_progress") {
    throw new ApiError(400, "Only an in-progress interview can be paused");
  }
  interview.status = "paused";
  interview.pausedAt = new Date();
  if (typeof elapsedSeconds === "number") interview.elapsedSeconds = elapsedSeconds;
  await interview.save();
  return interview;
}

async function resumeInterview(userId, id) {
  return startInterview(userId, id);
}

async function completeInterview(userId, id, clientEvaluation) {
  let interview = await findOwnedInterview(userId, id);
  if (interview.status === "completed") {
    if (clientEvaluation !== undefined) {
      interview.clientEvaluation = clientEvaluation;
      await interview.save();
    }
    return interview;
  }
  if (interview.status === "draft") {
    throw new ApiError(400, "Cannot complete an interview before it starts");
  }

  interview.status = "completed";
  interview.completedAt = new Date();
  interview.pausedAt = null;
  interview.totalScore = 0;
  if (clientEvaluation !== undefined) interview.clientEvaluation = clientEvaluation;

  if (mongoose.models.Answer) {
    const Answer = mongoose.models.Answer;
    for (let index = 0; index < interview.questions.length; index += 1) {
      const snapshot = interview.questions[index];
      await Answer.updateOne(
        { interview: interview._id, questionId: snapshot.questionId },
        {
          $setOnInsert: {
            interview: interview._id,
            user: userId,
            questionId: snapshot.questionId,
            questionIndex: index,
            answerText: "",
            status: "skipped",
            source: "text",
            attempt: 1
          }
        },
        { upsert: true }
      );
    }
  }

  await interview.save();
  if (mongoose.models.Answer) {
    const answerService = require("./answerService");
    await answerService.reEvaluateAnswers(userId, interview.id);
  }
  interview = await findOwnedInterview(userId, id);
  return interview;
}

module.exports = {
  createInterview,
  findOwnedInterview,
  listInterviews,
  autosaveInterview,
  deleteInterview,
  startInterview,
  pauseInterview,
  resumeInterview,
  completeInterview
};
