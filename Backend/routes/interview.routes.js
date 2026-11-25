const express = require("express");
const protect = require("../middleware/auth");
const validate = require("../middleware/validate");
const controller = require("../controllers/interviewController");
const {
  createInterviewValidation,
  autosaveValidation,
  pauseValidation,
  listInterviewValidation
} = require("../validators/interviewValidator");

const router = express.Router();

router.post("/interviews", protect, createInterviewValidation, validate, controller.createInterview);
router.get("/interviews", protect, listInterviewValidation, validate, controller.listInterviews);

router.get("/interviews/:id", protect, controller.getInterview);
router.put("/interviews/:id", protect, autosaveValidation, validate, controller.autosaveInterview);
router.delete("/interviews/:id", protect, controller.deleteInterview);

router.post("/interviews/:id/start", protect, controller.startInterview);
router.post("/interviews/:id/pause", protect, pauseValidation, validate, controller.pauseInterview);
router.post("/interviews/:id/resume", protect, controller.resumeInterview);
router.post("/interviews/:id/complete", protect, controller.completeInterview);

module.exports = router;
