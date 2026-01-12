const express = require('express');
const router = express.Router();
const {
    getReferralStats,
    redirectReferral,
    trackReferral
} = require('../../controllers/Setting-Page-Controller/ReferralController');
const { protect } = require('../../middlewares/authMiddleware');

// Get stats for current authenticated user
router.get('/stats', protect, getReferralStats);

// Public redirect link (using secure referralCode)
router.get('/go/:referralCode', redirectReferral);

// Tracking endpoint (using referralCode)
router.post('/track', trackReferral);

module.exports = router;
