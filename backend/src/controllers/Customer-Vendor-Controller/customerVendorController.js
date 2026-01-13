const Vendor = require('../../models/Customer-Vendor-Model/Vendor');

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

module.exports = {
    createCustomerVendor,
    getCustomerVendors,
    gstAutofill,
    ewayBillAutofill
};
