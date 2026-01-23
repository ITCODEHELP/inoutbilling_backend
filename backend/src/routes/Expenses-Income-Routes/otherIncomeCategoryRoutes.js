const express = require('express');
const router = express.Router();
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus
} = require('../../controllers/Expenses-Income-Controller/otherIncomeCategoryController');
const { protect } = require('../../middlewares/authMiddleware');

router.route('/')
    .get(protect, getCategories)
    .post(protect, createCategory);

router.route('/:id')
    .put(protect, updateCategory)
    .delete(protect, deleteCategory);

router.patch('/:id/toggle-status', protect, toggleCategoryStatus);

module.exports = router;
