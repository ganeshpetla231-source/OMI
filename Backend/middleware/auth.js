const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  let payload;
  try {
    payload = jwt.verify(authorization.slice(7), env.jwtSecret);
  } catch (error) {
    throw new ApiError(401, "Session expired, please log in again");
  }

  if (!payload.sub) {
    throw new ApiError(401, "Session expired, please log in again");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, "Session expired, please log in again");
  }

  req.user = user;
  next();
});

module.exports = protect;
