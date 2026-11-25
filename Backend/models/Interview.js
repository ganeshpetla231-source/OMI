const mongoose = require("mongoose");
const CONSTANTS = require("../config/constants");

const snapshotQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    text: { type: String, required: true },
    expectedAnswer: { type: String, default: "" },
    keywords: [{ type: String }],
    timeLimitSeconds: { type: Number, required: true },
    skill: { type: String, default: "Problem Solving" },
    difficulty: { type: String, enum: CONSTANTS.DIFFICULTIES, required: true },
    source: { type: String, required: true }
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: String, trim: true },
    duration: { type: Number, enum: [5, 10, 15, 30], required: true },
    questionCount: { type: Number, enum: [5, 10, 15], required: true },
    category: { type: String, enum: CONSTANTS.CATEGORIES, required: true },
    difficulty: { type: String, enum: CONSTANTS.DIFFICULTIES, required: true },
    language: { type: String, enum: CONSTANTS.LANGUAGES, default: "en" },
    jobRole: { type: String, trim: true, default: "General/Fresher" },
    skill: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    mode: { type: String, enum: CONSTANTS.INTERVIEW_MODES, default: "practice" },
    style: { type: String, enum: CONSTANTS.INTERVIEW_STYLES, default: "standard" },
    noteId: { type: String, trim: true },
    resumeId: { type: String, trim: true },
    questions: { type: [snapshotQuestionSchema], default: [] },
    status: { type: String, enum: CONSTANTS.INTERVIEW_STATUSES, default: "draft" },
    currentIndex: { type: Number, min: 0, default: 0 },
    elapsedSeconds: { type: Number, min: 0, default: 0 },
    startedAt: Date,
    pausedAt: Date,
    completedAt: Date,
    totalScore: { type: Number, min: 0, max: 100, default: 0 },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
    contentScore: { type: Number, min: 0, max: 100, default: 0 },
    communicationScore: { type: Number, min: 0, max: 100, default: 0 },
    clientEvaluation: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

interviewSchema.index({ user: 1, createdAt: -1 });
interviewSchema.index({ user: 1, clientId: 1 }, { unique: true, sparse: true });

interviewSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.__v;
    returned.id = returned._id.toString();
    delete returned._id;
    if (returned.user && returned.user.toString) returned.user = returned.user.toString();
    return returned;
  }
});

module.exports = mongoose.model("Interview", interviewSchema);
