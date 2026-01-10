const express = require('express');
const router = express.Router();
const GSTR1ReportController = require('../../controllers/Report-Controller/GSTR1ReportController');
const { protect } = require('../../middlewares/authMiddleware');

// Route: POST /api/reports/gstr1/search
router.post('/gstr1/search', protect, GSTR1ReportController.searchGSTR1);

module.exports = router;
