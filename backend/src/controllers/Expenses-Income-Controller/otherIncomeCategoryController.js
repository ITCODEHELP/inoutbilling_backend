const OtherIncomeCategory = require('../../models/Expense-Income-Model/OtherIncomeCategory');

// @desc    Get all other income categories
// @route   GET /api/other-income-categories
const getCategories = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, sort = 'name', order = 'asc' } = req.query;
        let query = { userId: req.user._id };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const categories = await OtherIncomeCategory.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit));

        const total = await OtherIncomeCategory.countDocuments(query);

        res.status(200).json({
            success: true,
            count: categories.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: categories
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Create new other income category
// @route   POST /api/other-income-categories
const createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        const existing = await OtherIncomeCategory.findOne({
            userId: req.user._id,
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const category = await OtherIncomeCategory.create({
            userId: req.user._id,
            name: name.trim()
        });

        res.status(201).json({ success: true, message: 'Category created successfully', data: category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update other income category
// @route   PUT /api/other-income-categories/:id
const updateCategory = async (req, res) => {
    try {
        const { name, status } = req.body;
        let category = await OtherIncomeCategory.findOne({ _id: req.params.id, userId: req.user._id });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        if (name) {
            const existing = await OtherIncomeCategory.findOne({
                userId: req.user._id,
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                _id: { $ne: req.params.id }
            });
            if (existing) {
                return res.status(400).json({ success: false, message: 'Category name already exists' });
            }
            category.name = name.trim();
        }

        if (status) {
            category.status = status;
        }

        await category.save();

        res.status(200).json({ success: true, message: 'Category updated successfully', data: category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Delete other income category
// @route   DELETE /api/other-income-categories/:id
const deleteCategory = async (req, res) => {
    try {
        const category = await OtherIncomeCategory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
