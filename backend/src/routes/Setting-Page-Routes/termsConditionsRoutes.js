const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const {
    saveTermsConditions,
    getTermsConditions
} = require('../../controllers/Setting-Page-Controller/termsConditionController');

// @route   POST /api/terms-conditions
// @desc    Save or Update terms and conditions
// @access  Private
router.post('/', protect, saveTermsConditions);

// @route   GET /api/terms-conditions
// @desc    Get terms and conditions
// @access  Private
router.get('/', protect, getTermsConditions);

module.exports = router;
