const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { generalLimiter } = require("./middleware/rateLimiter");
const asyncHandler = require("./utils/asyncHandler");
const ApiError = require("./utils/ApiError");
const sanitizeMongoInput = require("./middleware/sanitize");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: function originCallback(origin, callback) {
      if (!origin || env.clientUrls.includes(origin) || env.clientUrls.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(sanitizeMongoInput);
app.use(morgan(env.nodeEnv === "test" ? "tiny" : "dev"));
app.use(generalLimiter);
app.use("/api", routes);

if (env.nodeEnv === "test") {
  app.get(
    "/api/test/error",
    asyncHandler(async () => {
      throw new ApiError(418, "Test error");
    })
  );
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
