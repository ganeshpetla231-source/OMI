const { body } = require("express-validator");
const CONSTANTS = require("../config/constants");

const profileValidation = [
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),
  body("education").optional().trim().isLength({ max: 500 }).withMessage("Education is too long"),
  body().custom((value) => {
    if (value.experience !== undefined && typeof value.experience !== "string") throw new Error("Experience must be a string");
    if (value.jobRole !== undefined && typeof value.jobRole !== "string") throw new Error("Job role must be a string");
    if (value.careerGoal !== undefined && typeof value.careerGoal !== "string") throw new Error("Career goal must be a string");
    if (value.skills !== undefined && !Array.isArray(value.skills)) throw new Error("Skills must be an array");
    if (Array.isArray(value.skills) && value.skills.some((skill) => typeof skill !== "string")) throw new Error("Each skill must be a string");
    return true;
  })
];

const preferencesValidation = [
  body("language").optional().isIn(CONSTANTS.LANGUAGES).withMessage("Invalid language"),
  body("theme").optional().isIn(CONSTANTS.THEMES).withMessage("Invalid theme"),
  body("interviewMode").optional().isIn(CONSTANTS.INTERVIEW_MODES).withMessage("Invalid interview mode"),
  body("interviewStyle").optional().isIn(CONSTANTS.INTERVIEW_STYLES).withMessage("Invalid interview style")
];

const deleteProfileValidation = [
  body("password").isString().notEmpty().withMessage("Password is required")
];

module.exports = {
  profileValidation,
  preferencesValidation,
  deleteProfileValidation
};
