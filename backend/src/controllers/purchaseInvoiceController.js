const PurchaseInvoice = require('../models/PurchaseInvoice');
const Vendor = require('../models/Vendor');
const { sendInvoiceEmail } = require('../utils/emailHelper');
const { recordActivity } = require('../utils/activityLogHelper');


// Helper for duplicate check
const findDuplicateInvoice = async (userId, ms, invoiceNumber, date) => {
    return await PurchaseInvoice.findOne({
        userId,
        'vendorInformation.ms': ms,
        'invoiceDetails.invoiceNumber': invoiceNumber,
        'invoiceDetails.date': new Date(date)
    });
};

// @desc    Create purchase invoice (Save only)
// @route   POST /api/purchase-invoice/create
// @access  Private
const createPurchaseInvoice = async (req, res) => {
    try {
        const { vendorInformation, invoiceDetails, paymentType, shareOnEmail } = req.body;

        // Validation
        if (!vendorInformation?.ms || !vendorInformation?.placeOfSupply ||
            !invoiceDetails?.invoiceNumber || !invoiceDetails?.date || !paymentType) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        const invoice = await PurchaseInvoice.create({
            ...req.body,
            userId: req.user._id
        });

        if (shareOnEmail) {
            // Find vendor email
            const vendor = await Vendor.findOne({
                userId: req.user._id,
                companyName: vendorInformation.ms
            });
            if (vendor && vendor.email) {
                sendInvoiceEmail(invoice, vendor.email, true);
            }
        }

        // Activity Logging
        await recordActivity(
            req,
            'Insert',
            'Purchase Invoice',
            `New Purchase Invoice created for: ${vendorInformation.ms}`,
            invoiceDetails.invoiceNumber
        );

        res.status(201).json({
            success: true,
            message: "Invoice saved successfully",
            invoiceId: invoice._id
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Duplicate invoice detected" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create purchase invoice and return for print (Save & Print)
// @route   POST /api/purchase-invoice/create-print
// @access  Private
const createPurchaseInvoiceAndPrint = async (req, res) => {
    try {
        const { vendorInformation, invoiceDetails, paymentType, shareOnEmail } = req.body;

        if (!vendorInformation?.ms || !vendorInformation?.placeOfSupply ||
            !invoiceDetails?.invoiceNumber || !invoiceDetails?.date || !paymentType) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        // Duplicate check for Save & Print
        const existing = await findDuplicateInvoice(
            req.user._id,
            vendorInformation.ms,
            invoiceDetails.invoiceNumber,
            invoiceDetails.date
        );

        if (existing) {
            return res.status(200).json({
                success: true,
                message: "Duplicate invoice found, returning existing record",
                data: existing
            });
        }

        const invoice = await PurchaseInvoice.create({
            ...req.body,
            userId: req.user._id
        });

        if (shareOnEmail) {
            const vendor = await Vendor.findOne({
                userId: req.user._id,
                companyName: vendorInformation.ms
            });
            if (vendor && vendor.email) {
                sendInvoiceEmail(invoice, vendor.email, true);
            }
        }

        // Activity Logging
        await recordActivity(
            req,
            'Insert',
            'Purchase Invoice',
            `New Purchase Invoice created and printed for: ${vendorInformation.ms}`,
            invoiceDetails.invoiceNumber
        );

        res.status(201).json({
            success: true,
            message: "Invoice saved successfully",
            data: invoice
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all purchase invoices (with Search/Filter support)
// @route   GET /api/purchase-invoice
// @access  Private
const getAllPurchaseInvoices = async (req, res) => {
    try {
        const {
            companyName, productName, productGroup, fromDate, toDate,
            staffName, invoiceNumber, sequenceNumber, total,
            paymentType, lrNumber, itemNote, remarks, dueDays,
            gstin, gstr2bStatus, ewayBillStatus, invoiceType,
            advancedFilters
        } = req.query;

        let query = { userId: req.user._id };

        // Basic Filters
        if (companyName) query['vendorInformation.ms'] = new RegExp(companyName, 'i');
        if (invoiceNumber) query['invoiceDetails.invoiceNumber'] = new RegExp(invoiceNumber, 'i');
        if (paymentType) query.paymentType = paymentType;
        if (invoiceType) query['invoiceDetails.invoiceType'] = invoiceType;
        if (gstin) query['vendorInformation.gstinPan'] = new RegExp(gstin, 'i');
        if (remarks) query.notes = new RegExp(remarks, 'i');

        // Date Range
        if (fromDate || toDate) {
            query['invoiceDetails.date'] = {};
            if (fromDate) query['invoiceDetails.date'].$gte = new Date(fromDate);
            if (toDate) query['invoiceDetails.date'].$lte = new Date(toDate);
        }

        // Product search (item-level)
        if (productName || itemNote) {
            query.items = { $elemMatch: {} };
            if (productName) query.items.$elemMatch.productName = new RegExp(productName, 'i');
            if (itemNote) query.items.$elemMatch.itemNote = new RegExp(itemNote, 'i');
        }

        // Advanced Filters
        if (advancedFilters) {
            const filters = typeof advancedFilters === 'string' ? JSON.parse(advancedFilters) : advancedFilters;
            if (Array.isArray(filters)) {
                filters.forEach(f => {
                    const { field, operator, value } = f;
                    let mongoOp;
                    switch (operator) {
                        case 'equals': mongoOp = '$eq'; break;
                        case 'contains': mongoOp = '$regex'; break;
                        case 'greater than': mongoOp = '$gt'; break;
                        case 'less than': mongoOp = '$lt'; break;
                    }

                    if (field === 'Taxable Total') {
                        query['totals.totalTaxable'] = operator === 'between'
                            ? { $gte: Number(value.start), $lte: Number(value.end) }
                            : { [mongoOp]: mongoOp === '$regex' ? new RegExp(value, 'i') : Number(value) };
                    }
                    if (field === 'Document Note') {
                        query.notes = new RegExp(value, 'i');
                    }
                    // Implement other fields based on schema mapping...
                });
            }
        }

        const invoices = await PurchaseInvoice.find(query).sort({ createdAt: -1 });

        const formattedData = invoices.map(inv => ({
            purchaseNo: inv.invoiceDetails.invoiceNumber,
            companyName: inv.vendorInformation.ms,
            purchaseDate: inv.invoiceDetails.date,
            total: inv.totals.grandTotal,
            paymentType: inv.paymentType,
            outstanding: inv.totals.grandTotal,
            action: inv._id
        }));

        res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Search purchase invoices (Search action)
// @route   GET /api/purchase-invoice/search
const searchPurchaseInvoices = getAllPurchaseInvoices;

// @desc    Get purchase invoice by ID
// @route   GET /api/purchase-invoice/:id
// @access  Private
const getPurchaseInvoiceById = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete purchase invoice
// @route   DELETE /api/purchase-invoice/:id
// @access  Private
const deletePurchaseInvoice = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        // Activity Logging
        await recordActivity(
            req,
            'Delete',
            'Purchase Invoice',
            `Purchase Invoice deleted: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Invoice deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get purchase invoice summary
// @route   GET /api/purchase-invoice/summary
// @access  Private
const getPurchaseInvoiceSummary = async (req, res) => {
    try {
        const query = { userId: req.user._id };

        const summary = await PurchaseInvoice.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalCGST: { $sum: "$totals.totalCGST" },
                    totalSGST: { $sum: "$totals.totalSGST" },
                    totalIGST: { $sum: "$totals.totalIGST" },
                    totalTaxable: { $sum: "$totals.totalTaxable" },
                    totalValue: { $sum: "$totals.grandTotal" }
                }
            }
        ]);

        const invoices = await PurchaseInvoice.find(query).sort({ createdAt: -1 });

        const result = summary.length > 0 ? summary[0] : {
            totalTransactions: 0,
            totalCGST: 0,
            totalSGST: 0,
            totalIGST: 0,
            totalTaxable: 0,
            totalValue: 0
        };

        delete result._id;

        res.status(200).json({
            success: true,
            summary: result,
            data: invoices
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createPurchaseInvoice,
    createPurchaseInvoiceAndPrint,
    getAllPurchaseInvoices,
    getPurchaseInvoiceById,
    deletePurchaseInvoice,
    getPurchaseInvoiceSummary,
    searchPurchaseInvoices
};
