const express = require('express');
const router = express.Router();
const CompanyLedgerReportController = require('../../controllers/Report-Controller/CompanyLedgerReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/company-ledger', protect, CompanyLedgerReportController.generateReport);
router.get('/company-ledger/metadata', protect, CompanyLedgerReportController.getFilterMetadata);

module.exports = router;
