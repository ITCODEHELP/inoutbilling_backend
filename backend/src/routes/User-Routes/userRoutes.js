const express = require('express');
const router = express.Router();
const { updateProfile } = require('../../controllers/User-Controller/userController');
const { protect } = require('../../middlewares/authMiddleware');

// Check profile update
router.post('/update-profile', protect, updateProfile);

module.exports = router;
