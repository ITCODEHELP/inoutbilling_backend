const express = require('express');
const router = express.Router();
const { saveSettings, getSettings } = require('../../controllers/Setting-Page-Controller/paymentReminderSettingController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/', protect, saveSettings);
router.get('/', protect, getSettings);

module.exports = router;
