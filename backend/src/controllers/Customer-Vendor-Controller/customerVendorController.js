const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const Staff = require('../../models/Setting-Model/Staff');
const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../../models/Purchase-Invoice-Model/PurchaseInvoice');
const InwardPayment = require('../../models/Payment-Model/InwardPayment');
const OutwardPayment = require('../../models/Payment-Model/OutwardPayment');
const User = require('../../models/User-Model/User');
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

    // Generic search (matches Name or GSTIN)
    if (search) {
        query.$or = [
            { companyName: { $regex: search, $options: 'i' } },
            { gstin: { $regex: search, $options: 'i' } }
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

/**
 * Internal helper to calculate ledger data
 * Resolves target entity by NAME instead of ID
 */
const _calculateLedgerData = async (userId, name, fromDate, toDate) => {
    // 1. Fetch User (Company) details
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    if (!name) throw new Error("Entity Name (Customer/Vendor) is required");

    // 2. Resolve Target (Customer/Vendor) details by Name
    let target = await Customer.findOne({
        userId,
        companyName: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    }).lean();

    if (!target) {
        target = await Vendor.findOne({
            userId,
            companyName: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        }).lean();
    }

    if (!target) throw new Error(`Customer or Vendor named '${name}' not found`);

    const from = fromDate ? new Date(fromDate) : new Date(0);
    const to = toDate ? new Date(toDate) : new Date();

    // 3. Collect all related transactions
    // Sale Invoices (Debit for Customers)
    const saleInvoices = await SaleInvoice.find({
        userId,
        'customerInformation.ms': target.companyName
    }).lean();

    // Purchase Invoices (Credit for Vendors)
    const purchaseInvoices = await PurchaseInvoice.find({
        userId,
        'vendorInformation.ms': target.companyName
    }).lean();

    // Inward Payments (Credit for Customers)
    const inwardPayments = await InwardPayment.find({
        userId,
        companyName: target.companyName
    }).lean();

    // Outward Payments (Debit for Vendors)
    const outwardPayments = await OutwardPayment.find({
        userId,
        companyName: target.companyName
    }).lean();

    // Normalize rows
    let allRows = [
        ...saleInvoices.map(si => ({
            date: si.invoiceDetails.date,
            particulars: si.invoiceDetails.invoiceNumber,
            voucherType: 'Sale Invoice',
            invoiceNo: si.invoiceDetails.invoiceNumber,
            debit: si.totals.grandTotal,
            credit: 0
        })),
        ...purchaseInvoices.map(pi => ({
            date: pi.invoiceDetails.date,
            particulars: pi.invoiceDetails.invoiceNumber,
            voucherType: 'Purchase Invoice',
            invoiceNo: pi.invoiceDetails.invoiceNumber,
            debit: 0,
            credit: pi.totals.grandTotal
        })),
        ...inwardPayments.map(ip => ({
            date: ip.paymentDate,
            particulars: ip.receiptNo,
            voucherType: 'Inward Payment',
            invoiceNo: ip.receiptNo,
            debit: 0,
            credit: ip.amount
        })),
        ...outwardPayments.map(op => ({
            date: op.paymentDate,
            particulars: op.paymentNo,
            voucherType: 'Outward Payment',
            invoiceNo: op.paymentNo,
            debit: op.amount,
            credit: 0
        }))
    ];

    // Add Profile Opening Balance
    // Customer model has openingBalance.amount and type ( Credit/Debit)
    // Vendor has openningBalance as a number? 
    let initialOpening = 0;
    if (target.openingBalance) {
        if (typeof target.openingBalance === 'number') {
            initialOpening = target.openingBalance; // Assuming Vendor debit by default or check schema
        } else if (target.openingBalance.amount) {
            initialOpening = target.openingBalance.type === 'Credit' ? -target.openingBalance.amount : target.openingBalance.amount;
        }
    }

    // Sort by date to calculate opening and period balance
    allRows.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate Opening Balance for the period
    let runningBalance = initialOpening;
    let periodOpeningBalance = initialOpening;
    const periodRows = [];

    allRows.forEach(row => {
        const rowDate = new Date(row.date);
        if (rowDate < from) {
            runningBalance += (row.debit - row.credit);
            periodOpeningBalance = runningBalance;
        } else if (rowDate <= to) {
            runningBalance += (row.debit - row.credit);
            row.balance = runningBalance;
            periodRows.push(row);
        }
    });

    // Totals for the period
    const totalDebit = periodRows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = periodRows.reduce((sum, r) => sum + r.credit, 0);

    return {
        user,
        target,
        rows: periodRows,
        totals: {
            openingBalance: periodOpeningBalance,
            totalDebit,
            totalCredit,
            closingBalance: runningBalance
        },
        fromDate: from,
        toDate: to
    };
};

/**
 * @desc    Get Ledger Report (JSON)
 * @route   GET /api/customer-vendor/ledger
 */
const getLedgerReport = async (req, res) => {
    try {
        const { name, fromDate, toDate } = req.query;
        if (!name) return res.status(400).json({ success: false, message: "Name is required" });

        const data = await _calculateLedgerData(req.user._id, name, fromDate, toDate);
        res.status(200).json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Print/Download Ledger PDF
 * @route   GET /api/customer-vendor/ledger/print
 */
const printLedgerPDF = async (req, res) => {
    try {
        const { name, fromDate, toDate, shareOnly } = req.query;
        if (!name) return res.status(400).json({ success: false, message: "Name is required" });

        const data = await _calculateLedgerData(req.user._id, name, fromDate, toDate);

        const { generateLedgerPDF } = require('../../utils/pdfHelper');
        const pdfBuffer = await generateLedgerPDF(data);

        if (shareOnly === 'true') {
            return res.status(200).json({ success: true, message: "PDF Generated Successfully" });
        }

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Ledger_${data.target.companyName.replace(/\s+/g, '_')}.pdf`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Email Ledger PDF
 * @route   POST /api/customer-vendor/ledger/email
 */
const emailLedgerPDF = async (req, res) => {
    try {
        const { name, fromDate, toDate } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Name is required" });

        const data = await _calculateLedgerData(req.user._id, name, fromDate, toDate);

        const { sendLedgerEmail } = require('../../utils/emailHelper');
        await sendLedgerEmail(data, req.user.email);

        res.status(200).json({ success: true, message: "Ledger sent to your email successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
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
    ewayBillAutofill,
    _buildUnifiedSearchQuery,
    _getSearchSummary,
    getLedgerReport,
    printLedgerPDF,
    emailLedgerPDF
};
