const express = require('express');
const router = express.Router();
const GSTR2BReportController = require('../../controllers/Report-Controller/GSTR2BReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/reports/gstr2b/upload
router.post('/gstr2b/upload', protect, GSTR2BReportController.uploadAndReconcile);

// Route: POST /api/reports/gstr2b/filter
router.post('/gstr2b/filter', protect, GSTR2BReportController.filterByStatus);

module.exports = router;
