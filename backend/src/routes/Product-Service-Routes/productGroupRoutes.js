const express = require('express');
const router = express.Router();
const {
    createProductGroup,
    getProductGroups,
    searchProductGroups
} = require('../../controllers/Product-Service-Controller/productGroupController');
const { protect } = require('../../middlewares/authMiddleware');

// Search route (must be before generic / route to avoid considering 'search' as an ID if parameterized routes existed, though here they don't yet)
router.get('/search', protect, searchProductGroups);

// Create and List
router.post('/', protect, createProductGroup);
router.get('/', protect, getProductGroups);

module.exports = router;
