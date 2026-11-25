const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response");

const router = express.Router();

router.get(
  "/health",
  asyncHandler(async (req, res) => {
    return sendSuccess(res, 200, "API is healthy", {
      status: "ok",
      timestamp: new Date().toISOString()
    });
  })
);

router.get(
  "/health/database",
  asyncHandler(async (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    const data = {
      status: connected ? "ok" : "unavailable",
      database: connected ? "connected" : "disconnected"
    };

    if (!connected) {
      return sendError(res, 503, "Database unavailable", []);
    }

    return sendSuccess(res, 200, "Database is healthy", data);
  })
);

module.exports = router;
