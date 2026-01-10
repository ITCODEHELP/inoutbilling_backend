const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const { savePrintOptions } = require('../../controllers/Setting-Page-Controller/printOptionController');

// @route   POST /api/print-options
// @desc    Save or Update print options
// @access  Private
router.post('/', protect, savePrintOptions);

module.exports = router;
