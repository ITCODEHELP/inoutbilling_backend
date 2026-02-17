const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const { savePrintOptions, getPrintOptions } = require('../../controllers/Setting-Page-Controller/printOptionController');

// @route   GET /api/print-options
// @desc    Get print options
// @access  Private
router.get('/', protect, getPrintOptions);

// @route   POST /api/print-options
// @desc    Save or Update print options
// @access  Private
router.post('/', protect, savePrintOptions);

module.exports = router;

