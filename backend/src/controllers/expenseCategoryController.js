const ExpenseCategory = require('../models/ExpenseCategory');

// @desc    Get all expense categories
// @route   GET /api/expense-categories
// @access  Private
const getCategories = async (req, res) => {
    try {
        const { search } = req.query;
        let query = { userId: req.user._id };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const categories = await ExpenseCategory.find(query).sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Create new expense category
// @route   POST /api/expense-categories
// @access  Private
const createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        const existing = await ExpenseCategory.findOne({ userId: req.user._id, name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const category = await ExpenseCategory.create({
            userId: req.user._id,
            name: name.trim()
        });

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Update expense category
// @route   PUT /api/expense-categories/:id
// @access  Private
const updateCategory = async (req, res) => {
    try {
        const { name } = req.body;

        let category = await ExpenseCategory.findOne({ _id: req.params.id, userId: req.user._id });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        if (name) {
            const existing = await ExpenseCategory.findOne({
                userId: req.user._id,
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                _id: { $ne: req.params.id }
            });
            if (existing) {
                return res.status(400).json({ success: false, message: 'Category name already exists' });
            }
            category.name = name.trim();
        }

        await category.save();

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Delete expense category
// @route   DELETE /api/expense-categories/:id
// @access  Private
const deleteCategory = async (req, res) => {
    try {
        const category = await ExpenseCategory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
