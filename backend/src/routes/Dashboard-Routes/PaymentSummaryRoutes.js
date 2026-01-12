const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const PaymentSummaryController = require('../../controllers/Dashboard-Controller/PaymentSummaryController');

// Route is protected by main dashboard router, but including middleware for clarity/safety if used independently
router.get('/', protect, PaymentSummaryController.getPaymentSummary);

module.exports = router;
