const express = require('express');
const router = express.Router();
const InvoiceSummaryController = require('../../controllers/Dashboard-Controller/InvoiceSummaryController');

router.get('/counts', InvoiceSummaryController.getCounts);
router.get('/amounts', InvoiceSummaryController.getAmounts);

module.exports = router;
