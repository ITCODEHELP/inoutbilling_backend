const express = require('express');
const router = express.Router();
const {
    generatePin,
    verifyPin
} = require('../../controllers/Setting-Page-Controller/SupportPinController');
const { protect } = require('../../middlewares/authMiddleware');

// Generate a new 8-minute support PIN
router.post('/generate', protect, generatePin);

// Verify a support PIN
router.post('/verify', protect, verifyPin);

module.exports = router;
