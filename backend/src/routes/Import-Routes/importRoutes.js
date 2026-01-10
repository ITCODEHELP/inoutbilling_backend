const express = require('express');
const router = express.Router();
const { importCustomers } = require('../../controllers/Import-Controller/importController');
const { protect } = require('../../middlewares/authMiddleware');
const upload = require('../../middlewares/uploadMiddleware');

router.post('/customers', protect, upload.single('file'), importCustomers);

module.exports = router;
