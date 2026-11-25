const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { sendError } = require("../utils/response");

module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  logger.error(`${req.method} ${req.originalUrl}`, error);

  if (error instanceof ApiError) {
    return sendError(res, error.statusCode, error.message, error.errors);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const errors = Object.entries(error.errors).map(([field, detail]) => ({
      field,
      message: detail.message
    }));
    return sendError(res, 400, "Validation failed", errors);
  }

  if (error instanceof mongoose.Error.CastError) {
    return sendError(res, 404, "Resource not found", []);
  }

  if (error && error.code === 11000) {
    return sendError(res, 409, "Duplicate value", []);
  }

  if (error && ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
    return sendError(res, 401, "Invalid or expired token", []);
  }

  if (error && error.name === "MulterError") {
    if (error.code === "LIMIT_FILE_SIZE") {
      return sendError(res, 413, "File is too large", []);
    }
    return sendError(res, 415, "Unsupported file", []);
  }

  const message = "Internal server error";
  return sendError(res, 500, message, []);
};
