const mongoose = require("mongoose");
const CONSTANTS = require("../config/constants");

const questionSchema = new mongoose.Schema(
  {
    seedKey: { type: String, index: true },
    text: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
    category: { type: String, required: true, enum: CONSTANTS.CATEGORIES },
    jobRole: { type: String, required: true, trim: true },
    skill: { type: String, trim: true, default: "Problem Solving" },
    difficulty: { type: String, required: true, enum: CONSTANTS.DIFFICULTIES },
    language: { type: String, required: true, enum: CONSTANTS.LANGUAGES, default: "en" },
    expectedAnswer: { type: String, required: true, trim: true },
    keywords: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    evaluationCriteria: [{ type: String, trim: true }],
    timeLimitSeconds: { type: Number, required: true, min: 30, max: 3600 },
    source: { type: String, enum: ["seed", "template", "notes", "resume", "bank"], default: "bank" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

questionSchema.index({ category: 1, jobRole: 1, skill: 1, difficulty: 1, language: 1, isActive: 1 });
questionSchema.index(
  { text: "text", tags: "text", keywords: "text" },
  { name: "QuestionTextSearch", language_override: "textIndexLanguage" }
);

questionSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.__v;
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  }
});

module.exports = mongoose.model("Question", questionSchema);
