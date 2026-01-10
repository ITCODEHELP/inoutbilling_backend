const express = require('express');
const router = express.Router();
const OutwardPaymentReportController = require('../../controllers/Report-Controller/OutwardPaymentReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/outward-payment', protect, OutwardPaymentReportController.generateReport);
router.get('/outward-payment/metadata', protect, OutwardPaymentReportController.getFilterMetadata);

module.exports = router;
