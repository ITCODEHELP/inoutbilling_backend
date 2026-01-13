const express = require('express');
const router = express.Router();

const {
    sendOtp,
    verifyOtp,
    loginUserId,
    resendOtp,
    forgotPassword
} = require('../../controllers/Login-Controller/authController');

const {
    gstAutoFill,
    addBusiness
} = require('../../controllers/Login-Controller/businessController');

const { protect } = require('../../middlewares/authMiddleware');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login-userid', loginUserId);
router.post('/forgot-password', forgotPassword);

// Business Onboarding Routes
router.get('/public/gst-autofill/:gstin', gstAutoFill);
router.post('/business/add', protect, addBusiness); // Protected: Needs Token

module.exports = router;
