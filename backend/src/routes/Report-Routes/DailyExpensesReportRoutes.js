const express = require('express');
const router = express.Router();
const DailyExpensesReportController = require('../../controllers/Report-Controller/DailyExpensesReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/reports/daily-expenses-report/search
router.post('/daily-expenses-report/search', protect, DailyExpensesReportController.searchDailyExpenses);

module.exports = router;
