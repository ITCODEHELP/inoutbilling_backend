const express = require('express');
const router = express.Router();
const {
    getSupportEmailConfig
} = require('../../controllers/Setting-Page-Controller/SupportEmailController');
const { protect } = require('../../middlewares/authMiddleware');

// Get configuration and personalized mailto link
router.get('/config', protect, getSupportEmailConfig);

module.exports = router;
