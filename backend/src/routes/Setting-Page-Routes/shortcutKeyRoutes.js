const express = require('express');
const router = express.Router();
const {
    getShortcutDefinitions,
    getUserPreference,
    updateUserPreference
} = require('../../controllers/Setting-Page-Controller/ShortcutKeyController');
const { protect } = require('../../middlewares/authMiddleware');

// Fetch master shortcut definitions
router.get('/definitions', protect, getShortcutDefinitions);

// Fetch current user preference
router.get('/preference', protect, getUserPreference);

// Update user preference (enable/disable)
router.patch('/preference', protect, updateUserPreference);

module.exports = router;
