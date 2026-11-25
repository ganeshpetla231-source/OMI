const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

function createToken(user) {
  return jwt.sign(
    { sub: user.id || user._id.toString(), tv: user.tokenVersion },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function register({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ApiError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 11);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: "student"
  });

  return { user: user.toJSON(), token: createToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, "Invalid email or password");
  }

  return { user: user.toJSON(), token: createToken(user) };
}

async function logout(user) {
  user.tokenVersion += 1;
  await user.save();
  return null;
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "Session expired, please log in again");
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 11);
  user.tokenVersion += 1;
  await user.save();

  return { token: createToken(user) };
}

module.exports = { register, login, logout, changePassword, createToken };
