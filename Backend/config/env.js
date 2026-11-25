require("dotenv").config();

const isTest = process.env.NODE_ENV === "test";
const required = ["JWT_SECRET", "MONGODB_URI"];

for (const name of required) {
  if (isTest && !process.env[name]) continue;
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const env = Object.freeze({
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/talkready-test",
  jwtSecret: process.env.JWT_SECRET || "phase-zero-test-secret-not-for-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV || "development",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || ""
});

module.exports = env;
