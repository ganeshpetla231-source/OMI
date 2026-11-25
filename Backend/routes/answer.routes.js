const express = require("express");
const protect = require("../middleware/auth");
const validate = require("../middleware/validate");
const controller = require("../controllers/answerController");
const { submitValidation, retryValidation } = require("../validators/answerValidator");

const router = express.Router();

router.post("/answers", protect, submitValidation, validate, controller.submitAnswers);
router.get("/answers/:id", protect, controller.getAnswer);
router.post("/answers/:id/retry", protect, retryValidation, validate, controller.retryAnswer);
router.get("/interviews/:interviewId/answers", protect, controller.listAnswers);
router.post("/interviews/:id/evaluate", protect, controller.reEvaluate);

module.exports = router;
