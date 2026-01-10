const express = require('express');
const router = express.Router();
const CompanyOutstandingReportController = require('../../controllers/Report-Controller/CompanyOutstandingReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/company-outstanding', protect, CompanyOutstandingReportController.generateReport);
router.get('/company-outstanding/metadata', protect, CompanyOutstandingReportController.getFilterMetadata);

module.exports = router;
