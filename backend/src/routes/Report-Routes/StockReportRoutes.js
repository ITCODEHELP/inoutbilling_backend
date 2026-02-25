const express = require('express');
const router = express.Router();
const StockReportController = require('../../controllers/Report-Controller/StockReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/stock', protect, StockReportController.generateReport);
router.post('/stock/details', protect, StockReportController.getStockDetails);
router.post('/stock/print', protect, StockReportController.printReport);
router.post('/stock/email', protect, StockReportController.emailReport);
router.post('/stock/export', protect, StockReportController.exportReport);
router.post('/stock/download', protect, StockReportController.downloadReport);

module.exports = router;
