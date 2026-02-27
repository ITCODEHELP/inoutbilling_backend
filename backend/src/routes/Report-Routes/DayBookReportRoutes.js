const express = require('express');
const router = express.Router();
const DayBookReportController = require('../../controllers/Report-Controller/DayBookReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/reports/day-book/
router.post('/day-book/', protect, DayBookReportController.searchDayBook);

module.exports = router;
