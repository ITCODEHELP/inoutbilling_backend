const express = require('express');
const router = express.Router();

const {
    sendOtp,
    verifyOtpSignup,
    login,
    loginUserId,
    resendOtp
} = require('../../controllers/Login-Controller/authController');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtpSignup);
router.post('/login', login);
router.post('/login-userid', loginUserId);
router.post('/resend-otp', resendOtp);

module.exports = router;
