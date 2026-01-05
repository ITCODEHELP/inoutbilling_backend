const express = require('express');
const router = express.Router();
const {
    getGeneralSettings,
    updateGeneralSettings,
    uploadSettingsImages
} = require('../controllers/generalSettingsController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getGeneralSettings);
router.post('/update', protect, updateGeneralSettings);
router.post('/upload-images', protect, uploadSettingsImages);

module.exports = router;
