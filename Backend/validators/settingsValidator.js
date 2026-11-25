const { body } = require("express-validator");
const CONSTANTS = require("../config/constants");

const settingsValidation = [
  body("language").optional().isIn(CONSTANTS.LANGUAGES).withMessage("Invalid language"),
  body("theme").optional().isIn(CONSTANTS.THEMES).withMessage("Invalid theme"),
  body("interviewPreferences.mode").optional().isIn(CONSTANTS.INTERVIEW_MODES).withMessage("Invalid interview mode"),
  body("interviewPreferences.style").optional().isIn(CONSTANTS.INTERVIEW_STYLES).withMessage("Invalid interview style"),
  body("offline.autoSync").optional().isBoolean().withMessage("autoSync must be boolean"),
  body("offline.keepRecordings").optional().isBoolean().withMessage("keepRecordings must be boolean"),
  body("notifications.interviewReminders").optional().isBoolean().withMessage("interviewReminders must be boolean"),
  body("notifications.progressUpdates").optional().isBoolean().withMessage("progressUpdates must be boolean"),
  body("notifications.newResources").optional().isBoolean().withMessage("newResources must be boolean")
];

const deleteDataValidation = [
  body("confirm").equals("DELETE").withMessage("Confirmation must be DELETE")
];

module.exports = { settingsValidation, deleteDataValidation };
