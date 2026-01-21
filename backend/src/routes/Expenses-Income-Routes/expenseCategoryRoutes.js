const express = require('express');
const router = express.Router();
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus
} = require('../../controllers/Expenses-Income-Controller/expensesCategoryController');
const { protect } = require('../../middlewares/authMiddleware');

router.get('/', protect, getCategories);
router.post('/', protect, createCategory);
router.put('/:id', protect, updateCategory);
router.delete('/:id', protect, deleteCategory);
router.patch('/:id/toggle-status', protect, toggleCategoryStatus);

module.exports = router;
