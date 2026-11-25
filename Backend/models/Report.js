const mongoose = require("mongoose");

const questionResultSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  questionIndex: { type: Number, required: true },
  question: { type: String, required: true },
  answer: { type: String, default: "" },
  score: { type: Number, min: 0, max: 100, default: 0 },
  contentScore: { type: Number, min: 0, max: 100, default: 0 },
  communicationScore: { type: Number, min: 0, max: 100, default: 0 },
  skill: { type: String, default: "Problem Solving" },
  feedback: { type: String, default: "" },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  suggestions: [{ type: String }],
  matchedKeywords: [{ type: String }],
  missingKeywords: [{ type: String }],
  sampleAnswer: { type: String, default: "" }
}, { _id: false });

const reportSchema = new mongoose.Schema({
  interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true },
  scores: {
    total: { type: Number, min: 0, max: 100, default: 0 },
    content: { type: Number, min: 0, max: 100, default: 0 },
    communication: { type: Number, min: 0, max: 100, default: 0 }
  },
  questionResults: { type: [questionResultSchema], default: [] },
  strengths: [{ type: String, trim: true }],
  weaknesses: [{ type: String, trim: true }],
  suggestions: [{ type: String, trim: true }],
  communicationAnalysis: {
    score: { type: Number, min: 0, max: 100, default: 0 },
    fillerCount: { type: Number, min: 0, default: 0 },
    repeatedWordCount: { type: Number, min: 0, default: 0 },
    averageWpm: { type: Number, min: 0, default: 0 },
    summary: { type: String, default: "" }
  },
  method: { type: String, default: "rule-based-v1" }
}, { timestamps: true });

reportSchema.index({ user: 1, createdAt: -1 });
reportSchema.index({ interview: 1, user: 1 });

reportSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.__v;
    returned.id = returned._id.toString();
    delete returned._id;
    if (returned.user && returned.user.toString) returned.user = returned.user.toString();
    if (returned.interview && returned.interview.toString) returned.interview = returned.interview.toString();
    return returned;
  }
});

module.exports = mongoose.model("Report", reportSchema);
