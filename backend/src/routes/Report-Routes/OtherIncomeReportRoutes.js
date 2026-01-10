const express = require('express');
const router = express.Router();
const OtherIncomeReportController = require('../../controllers/Report-Controller/OtherIncomeReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/reports/other-income-report/search
router.post('/other-income-report/search', protect, OtherIncomeReportController.searchOtherIncomes);

module.exports = router;
