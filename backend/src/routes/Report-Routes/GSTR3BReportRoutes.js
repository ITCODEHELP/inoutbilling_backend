const express = require('express');
const router = express.Router();
const GSTR3BReportController = require('../../controllers/Report-Controller/GSTR3BReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/reports/gstr3b/search
router.post('/gstr3b/search', protect, GSTR3BReportController.searchReport);

module.exports = router;
