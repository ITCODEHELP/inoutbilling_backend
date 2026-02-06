const express = require('express');
const router = express.Router();
const {
    getHSNCodes,
    getHSNSuggestions,
    getHSNStats
} = require('../../controllers/Product-Service-Controller/hsnCodeController');
const { protect } = require('../../middlewares/authMiddleware');

// HSN Code Routes
router.get('/stats', protect, getHSNStats);
router.get('/suggestions', protect, getHSNSuggestions);
router.get('/', protect, getHSNCodes);

module.exports = router;
