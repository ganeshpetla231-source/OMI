const mongoose = require("mongoose");
const CONSTANTS = require("../config/constants");

const preferencesSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      enum: CONSTANTS.LANGUAGES,
      default: "en"
    },
    theme: {
      type: String,
      enum: CONSTANTS.THEMES,
      default: "system"
    },
    interviewMode: {
      type: String,
      enum: CONSTANTS.INTERVIEW_MODES,
      default: "practice"
    },
    interviewStyle: {
      type: String,
      enum: CONSTANTS.INTERVIEW_STYLES,
      default: "standard"
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: CONSTANTS.ROLES,
      default: "student",
      required: true
    },
    tokenVersion: { type: Number, default: 0 },
    education: { type: String, default: "", trim: true, maxlength: 500 },
    experience: { type: String, default: "", trim: true, maxlength: 1000 },
    jobRole: { type: String, default: "", trim: true, maxlength: 100 },
    careerGoal: { type: String, default: "", trim: true, maxlength: 500 },
    skills: [{ type: String, trim: true, maxlength: 100 }],
    preferences: {
      type: preferencesSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.passwordHash;
    delete returned.tokenVersion;
    delete returned.__v;
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  }
});

module.exports = mongoose.model("User", userSchema);
