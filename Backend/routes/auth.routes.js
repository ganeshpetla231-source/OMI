const express = require("express");
const controller = require("../controllers/authController");
const validate = require("../middleware/validate");
const protect = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  registerValidation,
  loginValidation,
  changePasswordValidation
} = require("../validators/authValidator");

const router = express.Router();

router.post("/register", authLimiter, registerValidation, validate, controller.register);
router.post("/login", authLimiter, loginValidation, validate, controller.login);
router.post("/logout", protect, controller.logout);
router.get("/me", protect, controller.me);
router.put("/change-password", protect, changePasswordValidation, validate, controller.changePassword);

module.exports = router;
