const { body, param, query } = require("express-validator");

const noteCreateValidation = [
  body("title").trim().isLength({ min: 1, max: 200 }).withMessage("Title must be 1–200 characters"),
  body("content").trim().isLength({ min: 1, max: 10000 }).withMessage("Content must be 1–10000 characters"),
  body("topic").optional().trim().isLength({ max: 100 }).withMessage("Topic must be at most 100 characters"),
  body("tags").optional().isArray({ max: 20 }).withMessage("Tags must be an array")
];

const noteUpdateValidation = [
  body("title").optional().trim().isLength({ min: 1, max: 200 }).withMessage("Title must be 1–200 characters"),
  body("content").optional().trim().isLength({ min: 1, max: 10000 }).withMessage("Content must be 1–10000 characters"),
  body("topic").optional().trim().isLength({ max: 100 }).withMessage("Topic must be at most 100 characters"),
  body("tags").optional().isArray({ max: 20 }).withMessage("Tags must be an array")
];

const noteIdValidation = [param("id").isMongoId().withMessage("Invalid note id")];
const noteListValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1–100"),
  query("search").optional().isString(),
  query("topic").optional().isString()
];

module.exports = { noteCreateValidation, noteUpdateValidation, noteIdValidation, noteListValidation };
