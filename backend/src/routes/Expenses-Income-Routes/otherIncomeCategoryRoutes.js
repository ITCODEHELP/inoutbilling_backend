const express = require('express');
const router = express.Router();
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../../controllers/Expenses-Income-Controller/otherIncomeCategoryController');
const { protect } = require('../../middlewares/authMiddleware');

router.route('/')
    .get(protect, getCategories)
    .post(protect, createCategory);

router.route('/:id')
    .put(protect, updateCategory)
    .delete(protect, deleteCategory);

module.exports = router;
