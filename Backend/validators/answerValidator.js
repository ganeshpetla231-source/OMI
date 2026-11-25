const { body } = require("express-validator");

const answerPayloadValidation = [
  body("answerText").optional().isString().isLength({ max: 5000 }).withMessage("Answer must be at most 5000 characters"),
  body("status").optional().isIn(["answered", "skipped"]).withMessage("Invalid answer status"),
  body("source").optional().isIn(["text", "voice"]).withMessage("Invalid answer source"),
  body("timeTakenSeconds").optional().isInt({ min: 0 }).withMessage("timeTakenSeconds must be non-negative")
];

const submitValidation = [
  body("interviewId").isMongoId().withMessage("Valid interviewId is required"),
  body("questionId").optional().isString().notEmpty().withMessage("questionId is required"),
  body("answers").optional().isArray({ min: 1 }).withMessage("answers must be a non-empty array"),
  ...answerPayloadValidation
];

const retryValidation = answerPayloadValidation;

module.exports = { submitValidation, retryValidation };
