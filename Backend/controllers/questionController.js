const mongoose = require("mongoose");
const Question = require("../models/Question");
const Category = require("../models/Category");
const JobRole = require("../models/JobRole");
const Skill = require("../models/Skill");
const { generateQuestions } = require("../services/questionGenerator");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess, sendCreated, sendPaginated } = require("../utils/response");
const { parsePagination, buildPagination } = require("../utils/pagination");

function buildFilter(query) {
  const filter = { isActive: true };
  for (const key of ["category", "jobRole", "skill", "difficulty", "language"]) {
    if (query[key]) filter[key] = query[key];
  }
  if (query.search) {
    filter.$or = [
      { text: { $regex: query.search, $options: "i" } },
      { tags: { $regex: query.search, $options: "i" } },
      { keywords: { $regex: query.search, $options: "i" } }
    ];
  }
  return filter;
}

const listQuestions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildFilter(req.query);
  const [items, total] = await Promise.all([
    Question.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Question.countDocuments(filter)
  ]);
  return sendPaginated(
    res,
    "Questions retrieved",
    items.map((item) => item.toJSON()),
    buildPagination(page, limit, total)
  );
});

const getQuestion = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Question not found");
  const question = await Question.findOne({ _id: req.params.id, isActive: true });
  if (!question) throw new ApiError(404, "Question not found");
  return sendSuccess(res, 200, "Question retrieved", question.toJSON());
});

const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ key: 1 });
  const counts = await Question.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
  ]);
  const countMap = Object.fromEntries(counts.map((item) => [item._id, item.count]));
  const data = categories.map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    questionCount: countMap[item.key] || 0
  }));
  return sendSuccess(res, 200, "Categories retrieved", data);
});

const listRoles = asyncHandler(async (req, res) => {
  const roles = await JobRole.find().sort({ label: 1 });
  return sendSuccess(res, 200, "Roles retrieved", roles);
});

const listSkills = asyncHandler(async (req, res) => {
  const skills = await Skill.find().sort({ label: 1 });
  return sendSuccess(res, 200, "Skills retrieved", skills);
});

const randomQuestions = asyncHandler(async (req, res) => {
  const count = Math.min(20, Math.max(1, parseInt(req.query.count, 10) || 5));
  const filter = buildFilter(req.query);
  const items = await Question.aggregate([{ $match: filter }, { $sample: { size: count } }]);
  return sendSuccess(res, 200, "Random questions retrieved", items.map((item) => {
    item.id = item._id.toString();
    delete item._id;
    delete item.__v;
    return item;
  }));
});

const generate = asyncHandler(async (req, res) => {
  const data = await generateQuestions({
    ...req.body,
    userId: req.user.id
  });
  const message = data.questions.length < req.body.count
    ? `Only ${data.questions.length} questions are available`
    : "Questions generated";
  return sendSuccess(res, 200, message, data);
});

const dashboard = asyncHandler(async (req, res) => {
  const [total, active, categoryCounts, difficultyCounts] = await Promise.all([
    Question.countDocuments(),
    Question.countDocuments({ isActive: true }),
    Question.aggregate([{ $match: { isActive: true } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    Question.aggregate([{ $match: { isActive: true } }, { $group: { _id: "$difficulty", count: { $sum: 1 } } }])
  ]);
  return sendSuccess(res, 200, "Dashboard counts retrieved", {
    total,
    active,
    inactive: total - active,
    byCategory: categoryCounts,
    byDifficulty: difficultyCounts
  });
});

async function ensureReference(model, key, label, extra = {}) {
  if (!key) return;
  const normalized = key.trim();
  await model.updateOne(
    { key: normalized },
    { $setOnInsert: { key: normalized, label: label || normalized, ...extra } },
    { upsert: true }
  );
}

const createQuestion = asyncHandler(async (req, res) => {
  await ensureReference(Category, req.body.category, req.body.category);
  await ensureReference(JobRole, req.body.jobRole, req.body.jobRole);
  if (req.body.skill) await ensureReference(Skill, req.body.skill.toLowerCase(), req.body.skill);

  const question = await Question.create(req.body);
  return sendCreated(res, "Question created", question.toJSON());
});

const updateQuestion = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Question not found");
  await ensureReference(Category, req.body.category, req.body.category);
  await ensureReference(JobRole, req.body.jobRole, req.body.jobRole);
  if (req.body.skill) await ensureReference(Skill, req.body.skill.toLowerCase(), req.body.skill);

  const question = await Question.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!question) throw new ApiError(404, "Question not found");
  return sendSuccess(res, 200, "Question updated", question.toJSON());
});

const deleteQuestion = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Question not found");
  const question = await Question.findById(req.params.id);
  if (!question) throw new ApiError(404, "Question not found");

  let used = false;
  if (mongoose.models.Interview) {
    used = Boolean(await mongoose.models.Interview.exists({
      "questions.questionId": question.id
    }));
  }

  if (used) {
    question.isActive = false;
    await question.save();
  } else {
    await question.deleteOne();
  }
  return sendSuccess(res, 200, used ? "Question archived" : "Question deleted", null);
});

module.exports = {
  listQuestions,
  getQuestion,
  listCategories,
  listRoles,
  listSkills,
  randomQuestions,
  generate,
  dashboard,
  createQuestion,
  updateQuestion,
  deleteQuestion
};
