const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
    saveOrUpdateSettings,
    getSettings
} = require('../controllers/productStockSettingsController');

// @route   POST /api/product-stock-settings
// @desc    Save or Update Product & Stock Settings
// @access  Private
router.post('/', protect, saveOrUpdateSettings);

// @route   GET /api/product-stock-settings
// @desc    Get Product & Stock Settings
// @access  Private
router.get('/', protect, getSettings);

module.exports = router;
