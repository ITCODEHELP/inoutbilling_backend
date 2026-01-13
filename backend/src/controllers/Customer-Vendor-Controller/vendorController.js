const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const { recordActivity } = require('../../utils/activityLogHelper');

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


        // Auto-generate GSTIN if not provided but PAN and State are present
        // Note: Vendor model has 'pan'. Need to ensure it's in body or extracted.
        // The read file showed Vendor schema has 'pan'.
        // createVendor destructures companyName, gstin, billingAddress. It uses ...req.body for others.
        let finalGstin = gstin;
        const { pan } = req.body;

        if (!finalGstin && pan && billingAddress?.state) {
            const { generateNextGSTIN } = require('../utils/gstinUtils');
            // Ensure we check Vendor collection
            const generated = await generateNextGSTIN(req.user._id, pan, billingAddress.state, Vendor);
            if (generated) {
                finalGstin = generated;
            }
        }

        const vendor = await Vendor.create({
            ...req.body,
            gstin: finalGstin,
            userId: req.user._id,
            isCustomerVendor: false
        });

        // Activity Logging
        await recordActivity(
            req,
            'Insert',
            'Company',
            `New Vendor/Company created: ${companyName}`,
            gstin || ''
        );

        res.status(201).json({ success: true, data: vendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const { _buildUnifiedSearchQuery, _getSearchSummary } = require('./customerVendorController');

// @desc    Get all vendors with search & pagination & summary
// @route   GET /api/vendor
// @access  Private
const getVendors = async (req, res) => {
    try {
        const queryParams = { ...req.query, ...req.body };
        const query = await _buildUnifiedSearchQuery(req.user._id, queryParams);
        const filteredQuery = { ...query, isCustomerVendor: false };

        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = queryParams;
        const skip = (page - 1) * limit;

        const [vendors, totalRecordsInType, summary] = await Promise.all([
            Vendor.find(filteredQuery)
                .sort({ [sort]: order === 'desc' ? -1 : 1 })
                .skip(Number(skip))
                .limit(Number(limit)),
            Vendor.countDocuments(filteredQuery),
            _getSearchSummary(query)
        ]);

        res.status(200).json({
            success: true,
            count: vendors.length,
            totalRecords: totalRecordsInType,
            page: Number(page),
            pages: Math.ceil(totalRecordsInType / (Number(limit) || 10)),
            summary,
            data: vendors
        });
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
