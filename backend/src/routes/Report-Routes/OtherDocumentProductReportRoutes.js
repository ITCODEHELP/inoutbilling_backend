const express = require('express');
const router = express.Router();
const OtherDocumentProductReportController = require('../../controllers/Report-Controller/OtherDocumentProductReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/other-product-reports', protect, OtherDocumentProductReportController.generateReport);
router.get('/other-product-reports/metadata', protect, OtherDocumentProductReportController.getFilterMetadata);

module.exports = router;
