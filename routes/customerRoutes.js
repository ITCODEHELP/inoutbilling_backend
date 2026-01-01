const express = require('express');
const router = express.Router();
const { downloadCustomers } = require('../controllers/customerController');

// Helper route to download customers excel
router.get('/download-customers', downloadCustomers);

module.exports = router;
