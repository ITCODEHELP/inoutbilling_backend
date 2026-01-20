const ProductGroup = require('../../models/Product-Service-Model/ProductGroup');
const Product = require('../../models/Product-Service-Model/Product');

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

// @desc    Update Product Group
// @route   PUT /api/product-group/:id
// @access  Private
const updateProductGroup = async (req, res) => {
    try {
        const { groupName, description } = req.body;
        const groupId = req.params.id;

        const group = await ProductGroup.findOne({ _id: groupId, userId: req.user._id });

        if (!group) {
            return res.status(404).json({ message: 'Product Group not found' });
        }

        const oldGroupName = group.groupName;

        if (groupName && groupName !== oldGroupName) {
            // Check for duplicates
            const existingGroup = await ProductGroup.findOne({
                userId: req.user._id,
                groupName: groupName
            });

            if (existingGroup) {
                return res.status(400).json({ message: 'Group Name already exists' });
            }

            // Update all products linked to this group name
            await Product.updateMany(
                { userId: req.user._id, productGroup: oldGroupName },
                { $set: { productGroup: groupName } }
            );
        }

        group.groupName = groupName || group.groupName;
        group.description = description !== undefined ? description : group.description;

        await group.save();

        res.status(200).json(group);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete Product Group
// @route   DELETE /api/product-group/:id
// @access  Private
const deleteProductGroup = async (req, res) => {
    try {
        const groupId = req.params.id;

        const group = await ProductGroup.findOne({ _id: groupId, userId: req.user._id });

        if (!group) {
            return res.status(404).json({ message: 'Product Group not found' });
        }

        // Check dependencies (Products linked to this group name)
        const linkedProducts = await Product.findOne({
            userId: req.user._id,
            productGroup: group.groupName
        });

        if (linkedProducts) {
            return res.status(400).json({
                message: 'Cannot delete group. There are products linked to this group.'
            });
        }

        await group.deleteOne();

        res.status(200).json({ message: 'Product Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createProductGroup,
    getProductGroups,
    searchProductGroups,
    updateProductGroup,
    deleteProductGroup
};
