const express = require("express");
const protect = require("../middleware/auth");
const validate = require("../middleware/validate");
const controller = require("../controllers/questionController");
const { questionFiltersValidation, generateValidation } = require("../validators/questionValidator");

const router = express.Router();

router.get("/questions/categories", controller.listCategories);
router.get("/questions/roles", controller.listRoles);
router.get("/questions/skills", controller.listSkills);
router.get("/questions/random", questionFiltersValidation, validate, controller.randomQuestions);
router.post("/questions/generate", protect, generateValidation, validate, controller.generate);
router.get("/questions", questionFiltersValidation, validate, controller.listQuestions);
router.get("/questions/:id", controller.getQuestion);

module.exports = router;
