const Settings = require("../models/Settings");
const ApiError = require("../utils/ApiError");

async function getOrCreate(userId) {
  let settings = await Settings.findOne({ user: userId });
  if (!settings) settings = await Settings.create({ user: userId });
  return settings.toJSON();
}

function mergeNested(current, updates, paths) {
  const patch = {};
  for (const [key, fields] of Object.entries(paths)) {
    if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;

    const incoming = updates[key];
    if (incoming === null || typeof incoming !== "object" || Array.isArray(incoming)) {
      throw new ApiError(400, `${key} must be an object`);
    }

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(incoming, field)) {
        patch[`${key}.${field}`] = incoming[field];
      }
    }
  }
  return patch;
}

async function updateSettings(userId, updates) {
  let settings = await Settings.findOne({ user: userId });
  if (!settings) settings = await Settings.create({ user: userId });

  const topLevel = {};
  for (const key of ["language", "theme"]) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) topLevel[key] = updates[key];
  }

  Object.assign(topLevel, mergeNested(settings.toObject(), updates, {
    interviewPreferences: ["mode", "style"],
    offline: ["autoSync", "keepRecordings"],
    notifications: ["interviewReminders", "progressUpdates", "newResources"]
  }));

  settings = await Settings.findOneAndUpdate(
    { user: userId },
    { $set: topLevel },
    { new: true, runValidators: true }
  );
  if (!settings) throw new ApiError(404, "Settings not found");
  return settings.toJSON();
}

module.exports = { getOrCreate, updateSettings };
