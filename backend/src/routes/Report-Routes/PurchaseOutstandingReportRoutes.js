const express = require('express');
const router = express.Router();
const PurchaseOutstandingReportController = require('../../controllers/Report-Controller/PurchaseOutstandingReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/purchase-outstanding', protect, PurchaseOutstandingReportController.generateOutstandingReport);
router.get('/purchase-outstanding/metadata', protect, PurchaseOutstandingReportController.getFilterMetadata);

module.exports = router;
