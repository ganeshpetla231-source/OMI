const express = require("express");
const protect = require("../middleware/auth");
const validate = require("../middleware/validate");
const controller = require("../controllers/resourceController");
const { upload, validateResumeSignature } = require("../middleware/upload");
const {
  noteCreateValidation,
  noteUpdateValidation,
  noteIdValidation,
  noteListValidation
} = require("../validators/noteValidator");

const router = express.Router();

router.post("/notes", protect, noteCreateValidation, validate, controller.createNote);
router.get("/notes", protect, noteListValidation, validate, controller.listNotes);
router.get("/notes/:id", protect, noteIdValidation, validate, controller.getNote);
router.put("/notes/:id", protect, noteIdValidation, noteUpdateValidation, validate, controller.updateNote);
router.delete("/notes/:id", protect, noteIdValidation, validate, controller.deleteNote);

router.post("/resumes", protect, upload.single("resume"), validateResumeSignature, controller.uploadResume);
router.get("/resumes", protect, controller.listResumes);
router.get("/resumes/:id", protect, controller.getResume);
router.delete("/resumes/:id", protect, controller.deleteResume);

module.exports = router;
