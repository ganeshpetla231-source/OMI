const express = require("express");
const protect = require("../middleware/auth");
const validate = require("../middleware/validate");
const controller = require("../controllers/profileController");
const {
  profileValidation,
  preferencesValidation,
  deleteProfileValidation
} = require("../validators/profileValidator");
const {
  settingsValidation,
  deleteDataValidation
} = require("../validators/settingsValidator");

const router = express.Router();

router.get("/profile", protect, controller.getProfile);
router.put("/profile", protect, profileValidation, validate, controller.updateProfile);
router.delete("/profile", protect, deleteProfileValidation, validate, controller.deleteProfile);

router.get("/profile/preferences", protect, controller.getPreferences);
router.put("/profile/preferences", protect, preferencesValidation, validate, controller.updatePreferences);

router.get("/settings", protect, controller.getSettings);
router.put("/settings", protect, settingsValidation, validate, controller.updateSettings);
router.delete("/settings/data", protect, deleteDataValidation, validate, controller.deleteSettingsData);

module.exports = router;
