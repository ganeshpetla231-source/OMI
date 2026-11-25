const env = require("./config/env");
const app = require("./app");
const { connectDatabase } = require("./config/db");
const logger = require("./utils/logger");

let server;

async function start() {
  await connectDatabase(env.mongodbUri);
  server = app.listen(env.port, () => {
    logger.info(`TalkReady API listening on port ${env.port}`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  const mongoose = require("mongoose");
  await mongoose.disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((error) => {
  logger.error("Server failed to start", error);
  process.exit(1);
});
