const ProductGroup = require('../models/ProductGroup');

// @desc    Create new Product Group
// @route   POST /api/product-group
// @access  Private
const createProductGroup = async (req, res) => {
    try {
        const { groupName, description } = req.body;

        if (!groupName) {
            return res.status(400).json({ message: 'Group Name is required' });
        }

        // Check for duplicates for this user
        const existingGroup = await ProductGroup.findOne({
            userId: req.user._id,
            groupName: groupName
        });

        if (existingGroup) {
            return res.status(400).json({ message: 'Group Name already exists' });
        }

        const productGroup = await ProductGroup.create({
            userId: req.user._id,
            groupName,
            description
        });

        res.status(201).json(productGroup);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all Product Groups
// @route   GET /api/product-group
// @access  Private
const getProductGroups = async (req, res) => {
    try {
        const groups = await ProductGroup.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        res.status(200).json(groups);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Search Product Groups
// @route   GET /api/product-group/search
// @access  Private
const searchProductGroups = async (req, res) => {
    try {
        const { name } = req.query;

        let query = { userId: req.user._id };

        if (name) {
            // Case-insensitive regex search
            query.groupName = { $regex: name, $options: 'i' };
        }

        const groups = await ProductGroup.find(query);
        res.status(200).json(groups);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createProductGroup,
    getProductGroups,
    searchProductGroups
};
