const express = require('express');
const router = express.Router();
const {
    uploadCertificate,
    toggleDigitalSignature,
    getDigitalSignatureStatus
} = require('../controllers/digitalSignatureController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/upload', protect, uploadCertificate);
router.post('/toggle', protect, toggleDigitalSignature);
router.get('/status', protect, getDigitalSignatureStatus);

module.exports = router;
