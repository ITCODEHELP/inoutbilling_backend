const express = require('express');
const router = express.Router();
const ProfitLossReportController = require('../../controllers/Report-Controller/Profit-LossReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/profit-loss', protect, ProfitLossReportController.generateReport);
router.post('/profit-loss/details', protect, ProfitLossReportController.getProfitLossDetails);

module.exports = router;
