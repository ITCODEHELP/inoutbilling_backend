const PurchaseInvoiceCustomField = require('../models/PurchaseInvoiceCustomField');

// @desc    Save or Update all Custom Fields for Purchase Invoice
// @route   POST /api/purchase-invoice/custom-fields
// @access  Private
const saveCustomFields = async (req, res) => {
    try {
        const fields = req.body.fields; // Expecting an array of fields

        if (!Array.isArray(fields)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. "fields" must be an array.'
            });
        }

        // Delete existing fields for this user to replace with the new list
        await PurchaseInvoiceCustomField.deleteMany({ userId: req.user._id });

        // Add userId to each field before saving
        const fieldsWithUserId = fields.map(field => ({
            ...field,
            userId: req.user._id
        }));

        const savedFields = await PurchaseInvoiceCustomField.insertMany(fieldsWithUserId);

        res.status(200).json({
            success: true,
            message: 'Custom fields updated successfully',
            data: savedFields
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all Custom Fields for Purchase Invoice
// @route   GET /api/purchase-invoice/custom-fields
// @access  Private
const getCustomFields = async (req, res) => {
    try {
        const fields = await PurchaseInvoiceCustomField.find({ userId: req.user._id })
            .sort({ orderNo: 1 });

        res.status(200).json({
            success: true,
            count: fields.length,
            data: fields
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    saveCustomFields,
    getCustomFields
};
