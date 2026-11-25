const profileService = require("../services/profileService");
const settingsService = require("../services/settingsService");
const dataDeletionService = require("../services/dataDeletionService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const getProfile = asyncHandler(async (req, res) => {
  const data = await profileService.getProfile(req.user.id);
  return sendSuccess(res, 200, "Profile retrieved", data);
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await profileService.updateProfile(req.user.id, req.body);
  return sendSuccess(res, 200, "Profile updated", data);
});

const getPreferences = asyncHandler(async (req, res) => {
  const data = await profileService.getPreferences(req.user.id);
  return sendSuccess(res, 200, "Preferences retrieved", data);
});

const updatePreferences = asyncHandler(async (req, res) => {
  const data = await profileService.updatePreferences(req.user.id, req.body);
  return sendSuccess(res, 200, "Preferences updated", data);
});

const deleteProfile = asyncHandler(async (req, res) => {
  await profileService.verifyPassword(req.user.id, req.body.password);
  const counts = await dataDeletionService.deleteAllUserData(req.user.id, { keepUser: false });
  return sendSuccess(res, 200, "Profile deleted", counts);
});

const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getOrCreate(req.user.id);
  return sendSuccess(res, 200, "Settings retrieved", data);
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updateSettings(req.user.id, req.body);
  return sendSuccess(res, 200, "Settings updated", data);
});

const deleteSettingsData = asyncHandler(async (req, res) => {
  const counts = await dataDeletionService.deleteAllUserData(req.user.id, {
    keepUser: true,
    keepSettings: true
  });
  return sendSuccess(res, 200, "Learning data deleted", counts);
});

module.exports = {
  getProfile,
  updateProfile,
  getPreferences,
  updatePreferences,
  deleteProfile,
  getSettings,
  updateSettings,
  deleteSettingsData
};
