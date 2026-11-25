const mongoose = require("mongoose");
const logger = require("../utils/logger");

async function connectDatabase(uri) {
  try {
    await mongoose.connect(uri);
    logger.info("MongoDB connected");
  } catch (error) {
    logger.error("MongoDB connection failed", error);
    throw error;
  }
}

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
  logger.error("MongoDB connection error", error);
});

module.exports = { connectDatabase };
