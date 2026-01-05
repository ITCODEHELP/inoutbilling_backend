const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { saveBankDetails } = require('../controllers/bankDetailsController');

// @route   POST /api/bank-details
// @desc    Save or Update bank details
// @access  Private
router.post('/', protect, saveBankDetails);

module.exports = router;
