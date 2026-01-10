const express = require('express');
const router = express.Router();
const OtherDocumentReportController = require('../../controllers/Report-Controller/OtherDocumentReportController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/other-documents', protect, OtherDocumentReportController.generateReport);
router.get('/other-documents/metadata', protect, OtherDocumentReportController.getFilterMetadata);

module.exports = router;
