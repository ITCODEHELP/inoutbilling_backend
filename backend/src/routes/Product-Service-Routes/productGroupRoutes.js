const express = require('express');
const router = express.Router();
const {
    createProductGroup,
    getProductGroups,
    searchProductGroups,
    updateProductGroup,
    deleteProductGroup
} = require('../../controllers/Product-Service-Controller/productGroupController');
const { protect } = require('../../middlewares/authMiddleware');

// Search route
router.get('/search', protect, searchProductGroups);

// CRUD operations
router.post('/', protect, createProductGroup);
router.get('/', protect, getProductGroups);
router.put('/:id', protect, updateProductGroup);
router.delete('/:id', protect, deleteProductGroup);

module.exports = router;
