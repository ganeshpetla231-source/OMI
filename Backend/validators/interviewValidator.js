const { body, query } = require("express-validator");
const CONSTANTS = require("../config/constants");

const createInterviewValidation = [
  body("duration").isIn([5, 10, 15, 30]).withMessage("Duration must be 5, 10, 15, or 30"),
  body("questionCount").isIn([5, 10, 15]).withMessage("Question count must be 5, 10, or 15"),
  body("category").isIn(CONSTANTS.CATEGORIES).withMessage("Invalid category"),
  body("difficulty").isIn(CONSTANTS.DIFFICULTIES).withMessage("Invalid difficulty"),
  body("language").optional().isIn(CONSTANTS.LANGUAGES).withMessage("Invalid language"),
  body("mode").optional().isIn(CONSTANTS.INTERVIEW_MODES).withMessage("Invalid interview mode"),
  body("style").optional().isIn(CONSTANTS.INTERVIEW_STYLES).withMessage("Invalid interview style"),
  body("skills").optional().isArray({ max: 30 }).withMessage("Skills must be an array"),
  body("clientId").optional().trim().isLength({ min: 1, max: 200 }).withMessage("Invalid clientId")
];

const autosaveValidation = [
  body("currentIndex").optional().isInt({ min: 0 }).withMessage("currentIndex must be a non-negative integer"),
  body("elapsedSeconds").optional().isInt({ min: 0 }).withMessage("elapsedSeconds must be a non-negative integer")
];

const pauseValidation = [
  body("elapsedSeconds").optional().isInt({ min: 0 }).withMessage("elapsedSeconds must be a non-negative integer")
];

const listInterviewValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1–100"),
  query("status").optional().isIn(CONSTANTS.INTERVIEW_STATUSES).withMessage("Invalid status"),
  query("category").optional().isIn(CONSTANTS.CATEGORIES).withMessage("Invalid category"),
  query("language").optional().isIn(CONSTANTS.LANGUAGES).withMessage("Invalid language")
];

module.exports = {
  createInterviewValidation,
  autosaveValidation,
  pauseValidation,
  listInterviewValidation
};
