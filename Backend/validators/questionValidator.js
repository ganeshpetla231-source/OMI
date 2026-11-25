const { body, query } = require("express-validator");
const CONSTANTS = require("../config/constants");

const questionFiltersValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1–100"),
  query("category").optional().isIn(CONSTANTS.CATEGORIES).withMessage("Invalid category"),
  query("difficulty").optional().isIn(CONSTANTS.DIFFICULTIES).withMessage("Invalid difficulty"),
  query("language").optional().isIn(CONSTANTS.LANGUAGES).withMessage("Invalid language")
];

const generateValidation = [
  body("count").isInt({ min: 1, max: 50 }).withMessage("Count must be 1–50"),
  body("category").optional().isIn(CONSTANTS.CATEGORIES).withMessage("Invalid category"),
  body("difficulty").optional().isIn(CONSTANTS.DIFFICULTIES).withMessage("Invalid difficulty"),
  body("language").optional().isIn(CONSTANTS.LANGUAGES).withMessage("Invalid language"),
  body("noteId").optional().isMongoId().withMessage("Invalid noteId"),
  body("resumeId").optional().isMongoId().withMessage("Invalid resumeId")
];

const questionBodyValidation = [
  body("text").trim().isLength({ min: 10, max: 500 }).withMessage("Text must be 10–500 characters"),
  body("category").isString().notEmpty().withMessage("Category is required"),
  body("jobRole").isString().notEmpty().withMessage("Job role is required"),
  body("difficulty").isIn(CONSTANTS.DIFFICULTIES).withMessage("Invalid difficulty"),
  body("language").isIn(CONSTANTS.LANGUAGES).withMessage("Invalid language"),
  body("expectedAnswer").isString().notEmpty().withMessage("Expected answer is required"),
  body("keywords").isArray({ min: 4, max: 8 }).withMessage("Keywords must contain 4–8 items"),
  body("timeLimitSeconds").isInt({ min: 30, max: 3600 }).withMessage("Invalid time limit"),
  body("evaluationCriteria").optional().isArray().withMessage("Evaluation criteria must be an array")
];

const questionUpdateValidation = questionBodyValidation.map((rule) => rule.optional ? rule.optional() : rule);

module.exports = {
  questionFiltersValidation,
  generateValidation,
  questionBodyValidation,
  questionUpdateValidation
};
