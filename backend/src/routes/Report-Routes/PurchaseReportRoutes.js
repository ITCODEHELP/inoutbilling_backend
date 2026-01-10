const express = require('express');
const router = express.Router();
const PurchaseReportController = require('../../controllers/Report-Controller/PurchaseReportController');
const { protect } = require('../../middlewares/authMiddleware');

/**
 * @route   POST /api/reports/purchase
 * @desc    Generate purchase report
 * @access  Private
 */
router.post('/purchase', protect, PurchaseReportController.generatePurchaseReport);

/**
 * @route   GET /api/reports/purchase/metadata
 * @desc    Get metadata
 * @access  Private
 */
router.get('/purchase/metadata', protect, PurchaseReportController.getFilterMetadata);

module.exports = router;
