const { body } = require("express-validator");

const passwordRules = body("password")
  .isLength({ min: 8 })
  .withMessage("Password must be at least 8 characters")
  .matches(/[A-Za-z]/)
  .withMessage("Password must contain a letter")
  .matches(/\d/)
  .withMessage("Password must contain a number");

const registerValidation = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),
  body("email").trim().isEmail().normalizeEmail().withMessage("Valid email is required"),
  passwordRules
];

const loginValidation = [
  body("email").trim().isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isString().notEmpty().withMessage("Password is required")
];

const changePasswordValidation = [
  body("currentPassword").isString().notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters")
    .matches(/[A-Za-z]/)
    .withMessage("New password must contain a letter")
    .matches(/\d/)
    .withMessage("New password must contain a number")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    })
];

module.exports = { registerValidation, loginValidation, changePasswordValidation };
