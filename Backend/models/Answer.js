const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, default: 0 },
    contentScore: { type: Number, min: 0, max: 100, default: 0 },
    communicationScore: { type: Number, min: 0, max: 100, default: 0 },
    method: { type: String, default: "rule-based-v1" },
    breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchedKeywords: [{ type: String }],
    missingKeywords: [{ type: String }],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    suggestions: [{ type: String }],
    explanation: { type: String, default: "" },
    sampleAnswer: { type: String, default: "" }
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    answerText: { type: String, default: "" },
    score: { type: Number, min: 0, max: 100, default: 0 },
    evaluation: { type: evaluationSchema, default: () => ({}) },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const answerSchema = new mongoose.Schema(
  {
    interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    questionId: { type: String, required: true },
    questionIndex: { type: Number, required: true, min: 0 },
    answerText: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: ["answered", "skipped"], default: "answered" },
    source: { type: String, enum: ["text", "voice"], default: "text" },
    timeTakenSeconds: { type: Number, min: 0, default: 0 },
    voiceMetrics: {
      wpm: { type: Number, min: 0 },
      durationSeconds: { type: Number, min: 0 },
      fillerCount: { type: Number, min: 0 }
    },
    attempt: { type: Number, min: 1, default: 1 },
    attempts: { type: [attemptSchema], default: [] },
    evaluation: { type: evaluationSchema, default: () => ({}) },
    clientEvaluation: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

answerSchema.index({ interview: 1, questionId: 1 }, { unique: true });

answerSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.__v;
    returned.id = returned._id.toString();
    delete returned._id;
    if (returned.interview && returned.interview.toString) returned.interview = returned.interview.toString();
    if (returned.user && returned.user.toString) returned.user = returned.user.toString();
    return returned;
  }
});

module.exports = mongoose.model("Answer", answerSchema);
