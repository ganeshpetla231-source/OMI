const express = require("express");
const protect = require("../middleware/auth");
const controller = require("../controllers/analyticsController");

const router = express.Router();

router.get("/dashboard/stats", protect, controller.stats);
router.get("/dashboard", protect, controller.stats);
router.get("/dashboard/activity", protect, controller.activity);
router.get("/dashboard/skills", protect, controller.skills);
router.get("/dashboard/recommendations", protect, controller.recommendations);
router.get("/dashboard/overview", protect, async (req, res, next) => {
  try {
    const [stats, activity, skills, recommendations] = await Promise.all([
      require("../services/dashboardService").stats(req.user.id),
      require("../services/dashboardService").activity(req.user.id, 5),
      require("../services/dashboardService").skills(req.user.id),
      require("../services/dashboardService").recommendations(req.user.id)
    ]);
    res.status(200).json({ success: true, message: "Dashboard retrieved", data: { stats, activity, skills, recommendations } });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/progress", protect, controller.progress);
router.get("/reports", protect, controller.listReports);
router.get("/reports/:id/download", protect, controller.downloadReport);
router.get("/reports/:id", protect, controller.getReport);

module.exports = router;
