const express = require('express');
const router = express.Router();
const ProductReportController = require('../../controllers/Report-Controller/ProductReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/reports/product-report
router.post('/product-report', protect, ProductReportController.searchProducts);

// Route: POST /api/reports/prodcut-report (Handling user typo request)
router.post('/prodcut-report', protect, ProductReportController.searchProducts);

module.exports = router;
