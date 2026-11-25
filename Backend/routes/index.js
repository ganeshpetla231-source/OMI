const express = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const profileRoutes = require("./profile.routes");
const questionRoutes = require("./question.routes");
const adminRoutes = require("./admin.routes");
const interviewRoutes = require("./interview.routes");
const answerRoutes = require("./answer.routes");
const resourceRoutes = require("./resource.routes");
const analyticsRoutes = require("./analytics.routes");

const router = express.Router();
router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use(profileRoutes);
router.use(questionRoutes);
router.use("/admin", adminRoutes);
router.use(interviewRoutes);
router.use(answerRoutes);
router.use(resourceRoutes);
router.use(analyticsRoutes);

module.exports = router;
