const express = require('express');
const router = express.Router();
const {
    getWhatsAppConfig,
    trackInteraction
} = require('../../controllers/Setting-Page-Controller/WhatsAppController');
const { protect } = require('../../middlewares/authMiddleware');

// Get configuration and deep link
router.get('/config', protect, getWhatsAppConfig);

// Track click interaction
router.post('/track', protect, trackInteraction);

module.exports = router;
