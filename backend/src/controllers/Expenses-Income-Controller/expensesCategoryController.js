const ExpenseCategory = require('../../models/Expense-Income-Model/ExpenseCategory');
const DailyExpense = require('../../models/Expense-Income-Model/DailyExpense');

// @desc    Get all expense categories (merged from expenses + master)
// @route   GET /api/expense-categories
// @access  Private
const getCategories = async (req, res) => {
    try {
        const { search } = req.query;

        // Step 1: Get all master categories (not deleted)
        let masterQuery = {
            userId: req.user._id,
            $or: [
                { isDeleted: { $exists: false } },
                { isDeleted: false }
            ]
        };

        if (search) {
            masterQuery.name = { $regex: search, $options: 'i' };
        }

        const masterCategories = await ExpenseCategory.find(masterQuery).sort({ name: 1 });

        // Step 2: Get unique category names from expenses
        let expenseMatchQuery = { userId: req.user._id };
        if (search) {
            expenseMatchQuery.category = { $regex: search, $options: 'i' };
        }

        const expenseCategories = await DailyExpense.aggregate([
            { $match: expenseMatchQuery },
            { $group: { _id: '$category' } },
            { $sort: { _id: 1 } }
        ]);

        // Step 3: Create a map of master categories by name (case-insensitive)
        const categoryMap = new Map();

        masterCategories.forEach(cat => {
            const key = cat.name.toLowerCase();
            categoryMap.set(key, {
                _id: cat._id,
                categoryId: cat._id,
                categoryName: cat.name,
                name: cat.name,
                status: cat.status || 'Active',
                isDeleted: cat.isDeleted || false,
                createdAt: cat.createdAt,
                updatedAt: cat.updatedAt
            });
        });

        // Step 4: Merge expense-derived categories
        for (const expCat of expenseCategories) {
            const categoryName = expCat._id;
            const key = categoryName.toLowerCase();

            // If not in master, create it
            if (!categoryMap.has(key)) {
                const newCategory = await ExpenseCategory.create({
                    userId: req.user._id,
                    name: categoryName,
                    status: 'Active',
                    isDeleted: false
                });

                categoryMap.set(key, {
                    _id: newCategory._id,
                    categoryId: newCategory._id,
                    categoryName: newCategory.name,
                    name: newCategory.name,
                    status: newCategory.status,
                    isDeleted: newCategory.isDeleted,
                    createdAt: newCategory.createdAt,
                    updatedAt: newCategory.updatedAt
                });
            }
        }

        // Step 5: Convert map to array
        const allCategories = Array.from(categoryMap.values());

        res.status(200).json({
            success: true,
            count: allCategories.length,
            data: allCategories
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

// @desc    Delete expense category (soft delete)
// @route   DELETE /api/expense-categories/:id
// @access  Private
const deleteCategory = async (req, res) => {
    try {
        const category = await ExpenseCategory.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: { $ne: true }
        });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Check if category is linked to any expenses
        const linkedExpenses = await DailyExpense.countDocuments({
            userId: req.user._id,
            category: category.name
        });

        if (linkedExpenses > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category. It is linked to ${linkedExpenses} expense(s). Please remove or reassign those expenses first.`
            });
        }

        // Perform soft delete
        category.isDeleted = true;
        await category.save();

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

// @desc    Toggle expense category status (Active/Inactive)
// @route   PATCH /api/expense-categories/:id/toggle-status
// @access  Private
const toggleCategoryStatus = async (req, res) => {
    try {
        const category = await ExpenseCategory.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Toggle status between Active and Inactive
        category.status = category.status === 'Active' ? 'Inactive' : 'Active';
        await category.save();

        res.status(200).json({
            success: true,
            message: `Category status updated to ${category.status}`,
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

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus
};
