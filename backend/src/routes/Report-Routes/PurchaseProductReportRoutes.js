const express = require('express');
const router = express.Router();
const PurchaseProductReportController = require('../../controllers/Report-Controller/PurchaseProductReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/purchase-product', protect, PurchaseProductReportController.generateProductReport);
router.get('/purchase-product/metadata', protect, PurchaseProductReportController.getFilterMetadata);

module.exports = router;
