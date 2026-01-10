const express = require('express');
const router = express.Router();
const InwardPaymentReportController = require('../../controllers/Report-Controller/InwardPaymentReportController');
const { protect } = require('../../middlewares/authMiddleware');

/**
 * @route   POST /api/reports/sales/inward-payment
 * @desc    Generate sales inward payment report with filters
 * @access  Private
 */
router.post('/sales/inward-payment', protect, InwardPaymentReportController.generateInwardPaymentReport);

/**
 * @route   GET /api/reports/sales/inward-payment/metadata
 * @desc    Get metadata (columns, filter options)
 * @access  Private
 */
router.get('/sales/inward-payment/metadata', protect, InwardPaymentReportController.getFilterMetadata);

module.exports = router;
