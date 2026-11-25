const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/role");
const validate = require("../middleware/validate");
const controller = require("../controllers/questionController");
const { questionBodyValidation } = require("../validators/questionValidator");

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/dashboard", controller.dashboard);
router.post("/questions", questionBodyValidation, validate, controller.createQuestion);
router.put("/questions/:id", questionBodyValidation, validate, controller.updateQuestion);
router.delete("/questions/:id", controller.deleteQuestion);

module.exports = router;
