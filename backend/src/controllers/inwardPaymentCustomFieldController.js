const InwardPaymentCustomField = require('../models/InwardPaymentCustomField');

/**
 * @desc    Create/Update Custom Field
 * @route   POST /api/inward-payments/custom-fields
 * @access  Private
 */
const saveCustomField = async (req, res) => {
    try {
        const userId = req.user._id;
        const { _id, name, type, status, required, print, options, orderNo } = req.body;

        if (_id) {
            // Update
            const updatedField = await InwardPaymentCustomField.findOneAndUpdate(
                { _id, userId },
                { name, type, status, required, print, options, orderNo },
                { new: true }
            );
            if (!updatedField) {
                return res.status(404).json({ success: false, message: "Custom field not found" });
            }
            return res.status(200).json({ success: true, message: "Custom field updated", data: updatedField });
        } else {
            // Create
            const newField = await InwardPaymentCustomField.create({
                userId, name, type, status, required, print, options, orderNo
            });
            return res.status(201).json({ success: true, message: "Custom field created", data: newField });
        }
    } catch (error) {
        console.error("Error saving inward payment custom field:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Get All Custom Fields
 * @route   GET /api/inward-payments/custom-fields
 * @access  Private
 */
const getCustomFields = async (req, res) => {
    try {
        const userId = req.user._id;
        // Return all, let frontend filter by status if needed, or query param?
        // Usually definitions list shows all. Logic needing active ones will filter.
        const fields = await InwardPaymentCustomField.find({ userId }).sort({ orderNo: 1, createdAt: 1 });
        res.status(200).json({ success: true, count: fields.length, data: fields });
    } catch (error) {
        console.error("Error fetching inward payment custom fields:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Delete/Disable Custom Field (Soft delete by status usually preferred, but DELETE route asked?)
 *          User asked to "disable", so update status or use this. Providing delete as well is safe if unused?
 *          User said "disable custom fields", implied update status.
 *          But often a delete is handy. For now, I'll rely on saveCustomField for "disable" (update status: Inactive).
 *          I will add a specific toggle status endpoint if helpful, or just stick to save.
 *          Let's sticking to save (POST) for enabling/disabling via 'status' field.
 */

module.exports = {
    saveCustomField,
    getCustomFields
};
