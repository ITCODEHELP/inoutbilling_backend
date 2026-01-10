const OutwardPaymentCustomField = require('../../models/Payment-Model/OutwardPaymentCustomField');

/**
 * @desc    Create/Update Custom Field
 * @route   POST /api/outward-payments/custom-fields
 * @access  Private
 */
const saveCustomField = async (req, res) => {
    try {
        const userId = req.user._id;
        const { _id, name, type, status, required, print, options, orderNo } = req.body;

        if (_id) {
            const updatedField = await OutwardPaymentCustomField.findOneAndUpdate(
                { _id, userId },
                { name, type, status, required, print, options, orderNo },
                { new: true }
            );
            if (!updatedField) {
                return res.status(404).json({ success: false, message: "Custom field not found" });
            }
            return res.status(200).json({ success: true, message: "Custom field updated", data: updatedField });
        } else {
            const newField = await OutwardPaymentCustomField.create({
                userId, name, type, status, required, print, options, orderNo
            });
            return res.status(201).json({ success: true, message: "Custom field created", data: newField });
        }
    } catch (error) {
        console.error("Error saving outward payment custom field:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Get All Custom Fields
 * @route   GET /api/outward-payments/custom-fields
 * @access  Private
 */
const getCustomFields = async (req, res) => {
    try {
        const userId = req.user._id;
        const fields = await OutwardPaymentCustomField.find({ userId }).sort({ orderNo: 1, createdAt: 1 });
        res.status(200).json({ success: true, count: fields.length, data: fields });
    } catch (error) {
        console.error("Error fetching outward payment custom fields:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

module.exports = {
    saveCustomField,
    getCustomFields
};
