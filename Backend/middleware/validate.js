const { validationResult } = require("express-validator");
const { sendError } = require("../utils/response");

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((error) => ({
    field: error.path || "request",
    message: error.msg
  }));

  return sendError(res, 400, "Validation failed", errors);
};
