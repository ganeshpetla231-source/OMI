const mongoose = require("mongoose");
const CONSTANTS = require("../config/constants");

const settingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
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
    interviewPreferences: {
      mode: {
        type: String,
        enum: CONSTANTS.INTERVIEW_MODES,
        default: "practice"
      },
      style: {
        type: String,
        enum: CONSTANTS.INTERVIEW_STYLES,
        default: "standard"
      }
    },
    offline: {
      autoSync: { type: Boolean, default: true },
      keepRecordings: { type: Boolean, default: true }
    },
    notifications: {
      interviewReminders: { type: Boolean, default: true },
      progressUpdates: { type: Boolean, default: true },
      newResources: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

settingsSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.__v;
    delete returned.user;
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  }
});

module.exports = mongoose.model("Settings", settingsSchema);
