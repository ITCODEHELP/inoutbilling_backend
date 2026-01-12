const express = require('express');
const router = express.Router();
const { updateProfile } = require('../../controllers/User-Controller/userController');
const { uploadLogo, sendVerificationEmail, verifyEmail } = require('../../controllers/User-Controller/userFeatureController');
const { protect } = require('../../middlewares/authMiddleware');

// Check profile update
router.post('/update-profile', protect, updateProfile);

// Business Logo & Email Verification
router.post('/upload-logo', protect, uploadLogo);
router.post('/send-verification-email', protect, sendVerificationEmail);
router.get('/verify-email/:token', verifyEmail);

module.exports = router;
