const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return undefined;

  const seen = new Set();
  const normalized = [];
  for (const skill of skills) {
    if (typeof skill !== "string") continue;
    const trimmed = skill.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key) && normalized.length < 30) {
      seen.add(key);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "Profile not found");
  return user.toJSON();
}

async function updateProfile(userId, updates) {
  const allowed = ["name", "education", "experience", "jobRole", "careerGoal", "skills"];
  const patch = {};

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      patch[key] = key === "skills" ? normalizeSkills(updates[key]) : updates[key];
    }
  }

  const user = await User.findByIdAndUpdate(userId, { $set: patch }, {
    new: true,
    runValidators: true
  });
  if (!user) throw new ApiError(404, "Profile not found");
  return user.toJSON();
}

async function getPreferences(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "Profile not found");
  return user.preferences;
}

async function updatePreferences(userId, updates) {
  const allowed = ["language", "theme", "interviewMode", "interviewStyle"];
  const patch = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      patch[`preferences.${key}`] = updates[key];
    }
  }

  const user = await User.findByIdAndUpdate(userId, { $set: patch }, {
    new: true,
    runValidators: true
  });
  if (!user) throw new ApiError(404, "Profile not found");
  return user.preferences;
}

async function verifyPassword(userId, password) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, "Password is incorrect");
  }
  return user;
}

module.exports = {
  getProfile,
  updateProfile,
  getPreferences,
  updatePreferences,
  normalizeSkills,
  verifyPassword
};
