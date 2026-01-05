const ProductCustomColumn = require('../models/ProductCustomColumn');

// @desc    Save or Update Product Custom Column
// @route   POST /api/product/custom-columns
// @access  Private
const saveProductCustomColumn = async (req, res) => {
    try {
        const {
            customFieldName,
            status,
            print,
            numericFormat,
            defaultValue,
            position,
            decimalValue,
            enableCalculation
        } = req.body;

        if (!customFieldName) {
            return res.status(400).json({
                success: false,
                message: 'customFieldName is required'
            });
        }

        // Upsert logic: Update if customFieldName + userId exists, else create
        const customColumn = await ProductCustomColumn.findOneAndUpdate(
            { userId: req.user._id, customFieldName },
            {
                status,
                print,
                numericFormat,
                defaultValue,
                position,
                decimalValue,
                enableCalculation
            },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Custom column saved successfully',
            data: customColumn
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all Product Custom Columns
// @route   GET /api/product/custom-columns
// @access  Private
const getProductCustomColumns = async (req, res) => {
    try {
        const customColumns = await ProductCustomColumn.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: customColumns.length,
            data: customColumns
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    saveProductCustomColumn,
    getProductCustomColumns
};
