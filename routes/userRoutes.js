const express = require('express');
const router = express.Router();
const { updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Check profile update
router.post('/update-profile', protect, updateProfile);

module.exports = router;
