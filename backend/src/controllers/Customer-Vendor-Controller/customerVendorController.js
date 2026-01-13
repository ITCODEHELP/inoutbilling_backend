const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');

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
            // Auto-generate GSTIN on update if missing
            let newGstin = req.body.gstin;
            const effectivePan = req.body.pan || record.pan;
            const effectiveState = req.body.billingAddress?.state || record.billingAddress?.state;

            if (!newGstin && !record.gstin && effectivePan && effectiveState) {
                const { generateNextGSTIN } = require('../utils/gstinUtils');
                const generated = await generateNextGSTIN(req.user._id, effectivePan, effectiveState, Vendor);
                if (generated) {
                    req.body.gstin = generated;
                }
            }

            // Update existing record
            const updated = await Vendor.findByIdAndUpdate(
                record._id,
                { ...req.body, isCustomerVendor: true },
                { new: true }
            );
            return res.status(200).json({ success: true, message: "Record updated successfully", data: updated });
        }

        // Auto-generate GSTIN for new record
        let finalGstin = gstin;
        const { pan } = req.body;
        if (!finalGstin && pan && billingAddress?.state) {
            const { generateNextGSTIN } = require('../utils/gstinUtils');
            const generated = await generateNextGSTIN(req.user._id, pan, billingAddress.state, Vendor);
            if (generated) {
                finalGstin = generated;
            }
        }

        // Create new Customer-Vendor
        const newRecord = await Vendor.create({
            ...req.body,
            gstin: finalGstin,
            userId: req.user._id,
            isCustomerVendor: true
        });

        res.status(201).json({ success: true, data: newRecord });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Shared helper to build search query for Customers and Vendors
 * Supports: Name, GSTIN, Company Type, Contact Person, License No., customField1, customField2, Staff Name
 */
const _buildUnifiedSearchQuery = async (userId, queryParams) => {
    const {
        search, showAll,
        companyName, name,
        gstin,
        companyType, registrationType,
        contactPerson,
        licenseNo,
        customField1, customField2,
        staffName
    } = queryParams;

    // Show All returns everything for this user
    if (showAll === 'true' || showAll === true) {
        return { userId };
    }

    let query = { userId };

    // Generic search (matches Name, GSTIN, Contact Person, Phone, Email, PAN, Address)
    if (search) {
        query.$or = [
            { companyName: { $regex: search, $options: 'i' } },
            { gstin: { $regex: search, $options: 'i' } },
            { contactPerson: { $regex: search, $options: 'i' } },
            { contactNo: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { pan: { $regex: search, $options: 'i' } },
            { "billingAddress.city": { $regex: search, $options: 'i' } },
            { "billingAddress.state": { $regex: search, $options: 'i' } },
            { "billingAddress.pincode": { $regex: search, $options: 'i' } },
            { "billingAddress.street": { $regex: search, $options: 'i' } },
            { "shippingAddress.city": { $regex: search, $options: 'i' } },
            { "shippingAddress.state": { $regex: search, $options: 'i' } },
            { "shippingAddress.pincode": { $regex: search, $options: 'i' } },
            { "shippingAddress.street": { $regex: search, $options: 'i' } }
        ];
    }

    // Specific field filters
    if (companyName || name) {
        query.companyName = { $regex: companyName || name, $options: 'i' };
    }

    if (gstin) {
        query.gstin = { $regex: gstin, $options: 'i' };
    }

    if (companyType || registrationType) {
        query.$or = [
            { companyType: { $regex: companyType || registrationType, $options: 'i' } },
            { registrationType: { $regex: companyType || registrationType, $options: 'i' } }
        ];
    }

    if (contactPerson) {
        query.contactPerson = { $regex: contactPerson, $options: 'i' };
    }

    // Handle License No. and Custom Fields (look in root and additionalDetails)
    if (licenseNo) {
        query.$or = [
            ...(query.$or || []),
            { licenseNo: { $regex: licenseNo, $options: 'i' } },
            { "additionalDetails.licenseNo": { $regex: licenseNo, $options: 'i' } }
        ];
    }

    if (customField1) {
        query.$or = [
            ...(query.$or || []),
            { customField1: { $regex: customField1, $options: 'i' } },
            { "additionalDetails.customField1": { $regex: customField1, $options: 'i' } }
        ];
    }

    if (customField2) {
        query.$or = [
            ...(query.$or || []),
            { customField2: { $regex: customField2, $options: 'i' } },
            { "additionalDetails.customField2": { $regex: customField2, $options: 'i' } }
        ];
    }

    // Staff Name resolution
    if (staffName) {
        const staffDocs = await Staff.find({
            ownerRef: userId,
            fullName: { $regex: staffName, $options: 'i' }
        }).select('_id');

        if (staffDocs.length > 0) {
            query.staff = { $in: staffDocs.map(s => s._id) };
        } else {
            // Force empty results if staff name doesn't match existing staff
            query.staff = new mongoose.Types.ObjectId();
        }
    }

    return query;
};

/**
 * Shared helper to compute search summary (Total, Customer, Vendor, Customer Vendor)
 */
const _getSearchSummary = async (query) => {
    // Note: We strip collection-specific fields like isCustomerVendor from the base query
    const baseQuery = { ...query };
    delete baseQuery.isCustomerVendor;

    const [customerCount, vendorOnlyCount, customerVendorCount] = await Promise.all([
        Customer.countDocuments(baseQuery),
        Vendor.countDocuments({ ...baseQuery, isCustomerVendor: false }),
        Vendor.countDocuments({ ...baseQuery, isCustomerVendor: true })
    ]);

    return {
        total: customerCount + vendorOnlyCount + customerVendorCount,
        customer: customerCount,
        vendor: vendorOnlyCount,
        customerVendor: customerVendorCount
    };
};

// @desc    Get all customer-vendors
// @route   GET /api/customer-vendor
// @access  Private
const getCustomerVendors = async (req, res) => {
    try {
        const queryParams = { ...req.query, ...req.body };
        const query = await _buildUnifiedSearchQuery(req.user._id, queryParams);
        const filteredQuery = { ...query, isCustomerVendor: true };

        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = queryParams;
        const skip = (page - 1) * limit;

        const [records, totalRecordsInType, summary] = await Promise.all([
            Vendor.find(filteredQuery)
                .sort({ [sort]: order === 'desc' ? -1 : 1 })
                .skip(Number(skip))
                .limit(Number(limit)),
            Vendor.countDocuments(filteredQuery),
            _getSearchSummary(query)
        ]);

        res.status(200).json({
            success: true,
            count: records.length,
            totalRecords: totalRecordsInType,
            page: Number(page),
            pages: Math.ceil(totalRecordsInType / limit),
            summary,
            data: records
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const axios = require('axios');

// In-memory throttling (No MongoDB dependency)
const lastRequestTime = new Map();
const THROTTLE_LIMIT = 5000;

/**
 * Shared service method to fetch GSTIN details from GSTINCheck API
 * Reused across /customers, /vendor, and /customer-vendor auto-fill flows
 */
const _fetchGstinDetails = async (gstin) => {
    try {
        const apiKey = process.env.GSTIN_API;
        if (!apiKey) {
            console.error('[GSTINCheck] API Key missing in .env');
            return { success: false, message: 'GSTIN data not found or provider unavailable' };
        }

        // URL format: http://sheet.gstincheck.co.in/check/{api-key}/{gstin}
        const url = `http://sheet.gstincheck.co.in/check/${apiKey}/${gstin.trim()}`;

        const response = await axios.get(url, {
            timeout: 10000 // Standard 10s timeout
        });

        const resData = response.data;

        // Normalize response from sheet.gstincheck.co.in
        if (!resData || resData.flag !== true || !resData.data) {
            return { success: false, message: 'GSTIN data not found or provider unavailable' };
        }

        const gd = resData.data;

        // Map to internal schema
        const mappedData = {
            companyName: gd.tradeName || gd.lgnm || '',
            legalName: gd.lgnm || '',
            tradeName: gd.tradeName || '',
            gstin: gd.gstin || gstin,
            pan: (gd.gstin || gstin).substring(2, 12),
            registrationType: gd.ctb || 'Regular',
            registrationStatus: gd.sts || 'Active',
            billingAddress: {
                street: gd.pradr?.addr?.st || gd.pradr?.addr?.loc || '',
                city: gd.pradr?.addr?.dst || '',
                state: gd.pradr?.addr?.stcd || '',
                pincode: gd.pradr?.addr?.pncd || '',
                country: 'India'
            },
            contactPerson: '',
            contactNo: '',
            email: ''
        };

        return { success: true, data: mappedData };

    } catch (error) {
        console.error('[GSTINCheck] API Error:', error.message);
        return { success: false, message: 'GSTIN data not found or provider unavailable' };
    }
};

// @desc    Auto-fill details from GSTIN (Live GSTINCheck API)
// @route   POST /api/customer-vendor/gst-autofill
// @access  Private
const gstAutofill = async (req, res) => {
    try {
        const gstin = (req.body.gstin || req.params.gstin || '').trim();
        const userId = req.user ? req.user._id.toString() : 'guest';

        if (!gstin) {
            return res.status(200).json({ success: false, message: 'GSTIN is required' });
        }

        // 1. Throttling
        const now = Date.now();
        if (lastRequestTime.has(userId) && (now - lastRequestTime.get(userId) < THROTTLE_LIMIT)) {
            return res.status(200).json({ success: false, message: 'Please wait before next request' });
        }
        lastRequestTime.set(userId, now);

        // 2. Fetch using shared method
        const result = await _fetchGstinDetails(gstin);

        // 3. Return HTTP 200 in all cases as requested
        return res.status(200).json(result);

    } catch (error) {
        console.error('[GST AUTOFILL] Failure:', error.message);
        return res.status(200).json({
            success: false,
            message: 'GSTIN data not found or provider unavailable'
        });
    }
};

// @desc    Auto-fill details from E-Way Bill (Live Integration)
// @route   POST /api/customer-vendor/ewaybill-autofill
// @access  Private
const ewayBillAutofill = async (req, res) => {
    try {
        const ewayBillNo = (req.body.ewayBillNo || req.params.ewayBillNo || '').trim();
        const userId = req.user ? req.user._id.toString() : 'guest';

        if (!ewayBillNo) {
            return res.status(200).json({ success: false, message: 'E-Way Bill Number is required' });
        }

        // Throttling
        const now = Date.now();
        if (lastRequestTime.has(userId) && (now - lastRequestTime.get(userId) < THROTTLE_LIMIT)) {
            return res.status(200).json({ success: false, message: 'Please wait before next request' });
        }
        lastRequestTime.set(userId, now);

        // Standardized response for e-way bill as well
        return res.status(200).json({
            success: false,
            message: 'E-Way Bill data not found or provider unavailable'
        });

    } catch (error) {
        console.error('[EWAY AUTOFILL] Failure:', error.message);
        return res.status(200).json({
            success: false,
            message: 'E-Way Bill data not found or provider unavailable'
        });
    }
};

const searchParties = async (req, res) => {
    try {
        const queryParams = { ...req.query, ...req.body };
        const query = await _buildUnifiedSearchQuery(req.user._id, queryParams);
        
        // Remove specific flags if any, to search broadly
        const baseQuery = { ...query };
        delete baseQuery.isCustomerVendor; 

        // Pagination
        const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = queryParams;
        const skip = (page - 1) * limit;

        // Execute parallel queries
        const [customers, vendors, totalCustomers, totalVendors] = await Promise.all([
            Customer.find(baseQuery).lean(),
            Vendor.find(baseQuery).lean(),
            Customer.countDocuments(baseQuery),
            Vendor.countDocuments(baseQuery)
        ]);

        // Post-process: add partyType and Merge
        const taggedCustomers = customers.map(c => ({ ...c, partyType: 'Customer' }));
        const taggedVendors = vendors.map(v => ({ 
            ...v, 
            partyType: v.isCustomerVendor ? 'CustomerVendor' : 'Vendor' 
        }));

        let allParties = [...taggedCustomers, ...taggedVendors];

        // Sort in memory (since we merged two collections)
        allParties.sort((a, b) => {
            const dateA = new Date(a[sort] || 0);
            const dateB = new Date(b[sort] || 0);
            return order === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // Apply pagination on merged result
        const totalRecords = totalCustomers + totalVendors;
        const paginatedData = allParties.slice(skip, skip + Number(limit));

        res.status(200).json({
            success: true,
            count: paginatedData.length,
            totalRecords,
            page: Number(page),
            pages: Math.ceil(totalRecords / limit),
            data: paginatedData
        });

    } catch (error) {
        console.error("Search Parties Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createCustomerVendor,
    getCustomerVendors,
    gstAutofill,
    ewayBillAutofill,
    _buildUnifiedSearchQuery,
    _getSearchSummary,
    searchParties
};
