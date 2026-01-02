const Vendor = require('../models/Vendor');

// @desc    Create new vendor
// @route   POST /api/vendor/create
// @access  Private
const createVendor = async (req, res) => {
    try {
        const { companyName, gstin, billingAddress } = req.body;

        // Validation for required fields
        if (!companyName) return res.status(400).json({ success: false, message: "Company Name is required" });
        if (!billingAddress?.city || !billingAddress?.state || !billingAddress?.country) {
            return res.status(400).json({ success: false, message: "City, State, and Country are required" });
        }

        // Duplicate check
        const existingVendor = await Vendor.findOne({
            userId: req.user._id,
            $or: [
                { companyName },
                ...(gstin ? [{ gstin }] : [])
            ]
        });

        if (existingVendor) {
            return res.status(400).json({ success: false, message: "Vendor with this Company Name or GSTIN already exists" });
        }

        const vendor = await Vendor.create({
            ...req.body,
            userId: req.user._id,
            isCustomerVendor: false
        });

        res.status(201).json({ success: true, data: vendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all vendors
// @route   GET /api/vendor
// @access  Private
const getVendors = async (req, res) => {
    try {
        const vendors = await Vendor.find({ userId: req.user._id, isCustomerVendor: false });
        res.status(200).json({ success: true, data: vendors });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single vendor
// @route   GET /api/vendor/:id
// @access  Private
const getVendorById = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!vendor) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        res.status(200).json({ success: true, data: vendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createVendor,
    getVendors,
    getVendorById
};
