const express = require('express');
const router = express.Router();
const ProductReportController = require('../../controllers/Report-Controller/ProductReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/report/product-report/search
router.post('/product-report/search', protect, ProductReportController.searchProducts);

module.exports = router;
