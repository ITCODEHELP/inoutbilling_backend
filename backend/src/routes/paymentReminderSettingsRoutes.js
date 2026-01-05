const express = require('express');
const router = express.Router();
const { saveSettings, getSettings } = require('../controllers/paymentReminderSettingsController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, saveSettings);
router.get('/', protect, getSettings);

module.exports = router;
