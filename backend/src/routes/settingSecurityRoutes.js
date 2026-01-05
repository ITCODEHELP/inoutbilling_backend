const express = require('express');
const router = express.Router();
const {
    requestPhoneChangeOtp,
    verifyPhoneChangeOtp,
    requestEmailChangeOtp,
    verifyEmailChangeOtp,
    requestCredentialsOtp,
    verifyCredentialsOtp,
    updateSecuritySettings,
    getLoginHistory,
    logoutAllDevices,
    updateEwayCredentials,
    toggleEInvoice,
    getEInvoiceSetting,
    getBusinessProfile,
    requestBusinessProfileOtp,
    verifyAndUpdateBusinessProfile,
    addDispatchAddress,
    getDispatchAddresses,
    getGstAutofillDispatch
} = require('../controllers/settingSecurityController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/request-phone-change-otp', protect, requestPhoneChangeOtp);
router.post('/verify-phone-change-otp', protect, verifyPhoneChangeOtp);
router.post('/request-email-change-otp', protect, requestEmailChangeOtp);
router.post('/verify-email-change-otp', protect, verifyEmailChangeOtp);
router.post('/request-credentials-otp', protect, requestCredentialsOtp);
router.post('/verify-credentials-otp', protect, verifyCredentialsOtp);
router.post('/update-settings', protect, updateSecuritySettings);
router.get('/history', protect, getLoginHistory);
router.post('/logout-all', protect, logoutAllDevices);
router.post('/update-eway-credentials', protect, updateEwayCredentials);
router.post('/toggle-einvoice', protect, toggleEInvoice);
router.get('/einvoice-setting', protect, getEInvoiceSetting);
router.get('/business-profile', protect, getBusinessProfile);
router.post('/request-business-profile-otp', protect, requestBusinessProfileOtp);
router.post('/verify-business-profile-otp', protect, verifyAndUpdateBusinessProfile);
router.post('/dispatch-address', protect, addDispatchAddress);
router.get('/dispatch-addresses', protect, getDispatchAddresses);
router.get('/gst-autofill-dispatch', protect, getGstAutofillDispatch);

module.exports = router;
