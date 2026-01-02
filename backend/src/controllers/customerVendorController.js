const Vendor = require('../models/Vendor');

// @desc    Create or update customer-vendor
// @route   POST /api/customer-vendor/create
// @access  Private
const createCustomerVendor = async (req, res) => {
    try {
        const { companyName, gstin, billingAddress } = req.body;

        if (!companyName) return res.status(400).json({ success: false, message: "Company Name is required" });
        if (!billingAddress?.city || !billingAddress?.state || !billingAddress?.country) {
            return res.status(400).json({ success: false, message: "City, State, and Country are required" });
        }

        // Check for existing Customer-Vendor
        let record = await Vendor.findOne({
            userId: req.user._id,
            $or: [
                { companyName },
                ...(gstin ? [{ gstin }] : [])
            ]
        });

        if (record) {
            // Update existing record
            const updated = await Vendor.findByIdAndUpdate(
                record._id,
                { ...req.body, isCustomerVendor: true },
                { new: true }
            );
            return res.status(200).json({ success: true, message: "Record updated successfully", data: updated });
        }

        // Create new Customer-Vendor
        const newRecord = await Vendor.create({
            ...req.body,
            userId: req.user._id,
            isCustomerVendor: true
        });

        res.status(201).json({ success: true, data: newRecord });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all customer-vendors
// @route   GET /api/customer-vendor
// @access  Private
const getCustomerVendors = async (req, res) => {
    try {
        const records = await Vendor.find({ userId: req.user._id, isCustomerVendor: true });
        res.status(200).json({ success: true, data: records });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createCustomerVendor,
    getCustomerVendors
};
