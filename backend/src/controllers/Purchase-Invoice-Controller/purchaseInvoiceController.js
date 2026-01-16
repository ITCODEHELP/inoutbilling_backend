const PurchaseInvoice = require('../../models/Purchase-Invoice-Model/PurchaseInvoice');
const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const User = require('../../models/User-Model/User');
const Staff = require('../../models/Setting-Model/Staff');
const BarcodeCart = require('../../models/Product-Service-Model/BarcodeCart');
const Quotation = require('../../models/Other-Document-Model/Quotation');
const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const CreditNote = require('../../models/Other-Document-Model/CreditNote');
const DebitNote = require('../../models/Other-Document-Model/DebitNote');
const PurchaseOrder = require('../../models/Other-Document-Model/PurchaseOrder');
const { generateInvoicePDF } = require('../../utils/pdfHelper');
const { generatePurchaseInvoicePDF } = require('../../utils/purchaseInvoicePdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');


// Helper for unique number check
const findDuplicateInvoice = async (userId, invoiceNumber) => {
    return await PurchaseInvoice.findOne({ userId, 'invoiceDetails.invoiceNumber': invoiceNumber });
};

// Helper for validation
const validatePurchaseInvoice = (data) => {
    const { vendorInformation, invoiceDetails, items, paymentType, totals } = data;

    if (!vendorInformation || typeof vendorInformation !== 'object') return "Vendor information is required";
    if (!vendorInformation.ms) return "M/S (Vendor Name) is required";
    if (!vendorInformation.placeOfSupply) return "Place of Supply is required";
    if (!invoiceDetails || typeof invoiceDetails !== 'object') return "Invoice details are required";
    if (!invoiceDetails.invoiceNumber) return "Invoice Number is required";
    if (!invoiceDetails.date) return "Date is required";
    if (!paymentType) return "Payment Type is required";

    if (!items || !Array.isArray(items) || items.length === 0) {
        return "Items array must not be empty";
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.productName) return `Product Name is required for item ${i + 1}`;
        if (!item.qty || item.qty <= 0) return `Quantity must be greater than 0 for item ${i + 1}`;
        if (!item.price || item.price <= 0) return `Price must be greater than 0 for item ${i + 1}`;
    }

    if (totals) {
        if (isNaN(totals.grandTotal)) return "Grand Total must be a number";
    }

    return null;
};

// Helper to handle the core creation logic
const handleCreatePurchaseInvoiceLogic = async (req) => {
    if (!req.body) req.body = {};

    // 1️⃣ Parse nested JSON fields safely
    const nestedFields = [
        'vendorInformation', 'invoiceDetails', 'items', 'additionalCharges',
        'totals', 'conversions', 'eWayBill', 'termsAndConditions', 'transportDetails'
    ];

    nestedFields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
            try { req.body[field] = JSON.parse(req.body[field]); } catch (e) { throw new Error(`Invalid JSON in ${field}`); }
        }
    });

    // 2️⃣ Handle attachments
    if (req.files && req.files.length > 0) {
        req.body.attachments = req.files.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype
        }));
    }

    // 3️⃣ Validate
    const validationError = validatePurchaseInvoice(req.body);
    if (validationError) throw new Error(validationError);

    // Check for duplicate number
    const existing = await findDuplicateInvoice(req.user._id, req.body.invoiceDetails.invoiceNumber);
    if (existing) throw new Error("Invoice number must be unique");

    // 4️⃣ Save invoice
    const invoice = await PurchaseInvoice.create({
        ...req.body,
        userId: req.user._id
    });

    // 5️⃣ Send email if requested
    if (req.body.shareOnEmail) {
        const vendor = await Vendor.findOne({ userId: req.user._id, companyName: req.body.vendorInformation.ms });
        if (vendor && vendor.email) {
            await sendInvoiceEmail(invoice, vendor.email, true);
        }
    }

    // 6️⃣ Generate PDF Buffer
    const userData = await User.findById(req.user._id);
    const pdfBuffer = await generatePurchaseInvoicePDF(invoice, userData || {});

    return { invoice, pdfBuffer };
};

// @desc    Create purchase invoice
// @route   POST /api/purchase-invoice/create
// @access  Private
const createPurchaseInvoice = async (req, res) => {
    try {
        const { invoice } = await handleCreatePurchaseInvoiceLogic(req);

        // Activity Logging
        await recordActivity(
            req,
            'Insert',
            'Purchase Invoice',
            `New Purchase Invoice created for: ${invoice.vendorInformation.ms}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(201).json({
            success: true,
            message: "Purchase Invoice saved successfully",
            invoiceId: invoice._id,
            data: invoice
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create purchase invoice and print
// @route   POST /api/purchase-invoice/create-print
// @access  Private
const createPurchaseInvoiceAndPrint = async (req, res) => {
    try {
        const { invoice, pdfBuffer } = await handleCreatePurchaseInvoiceLogic(req);

        // Activity Logging
        await recordActivity(
            req,
            'Insert',
            'Purchase Invoice',
            `New Purchase Invoice created and printed for: ${invoice.vendorInformation.ms}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="purchase-invoice-${invoice.invoiceDetails.invoiceNumber}.pdf"`);
        return res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(400).setHeader('Content-Type', 'application/json').json({ success: false, message: error.message });
    }
};

// @desc    Get all purchase invoices (with Search/Filter support)
// @route   GET /api/purchase-invoice
// @access  Private
const getPurchaseInvoices = async (req, res) => {
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

// @desc    Update purchase invoice
// @route   PUT /api/purchase-invoice/:id
// @access  Private
const updatePurchaseInvoice = async (req, res) => {
    try {
        if (!req.body) req.body = {};

        // Parse nested JSON fields safely
        const nestedFields = [
            'vendorInformation', 'invoiceDetails', 'items', 'additionalCharges',
            'totals', 'conversions', 'eWayBill', 'termsAndConditions', 'transportDetails'
        ];

        nestedFields.forEach(field => {
            if (req.body[field] && typeof req.body[field] === 'string') {
                try { req.body[field] = JSON.parse(req.body[field]); } catch (e) { throw new Error(`Invalid JSON in ${field}`); }
            }
        });

        // Handle attachments
        if (req.files && req.files.length > 0) {
            const newAttachments = req.files.map(file => ({
                fileName: file.filename,
                filePath: file.path,
                fileSize: file.size,
                mimeType: file.mimetype
            }));
            req.body.$push = { attachments: { $each: newAttachments } };
        }

        // Validate
        const validationError = validatePurchaseInvoice(req.body);
        if (validationError) return res.status(400).json({ success: false, message: validationError });

        // Check for duplicate invoice number if it's being changed
        if (req.body.invoiceDetails && req.body.invoiceDetails.invoiceNumber) {
            const existing = await PurchaseInvoice.findOne({
                userId: req.user._id,
                'invoiceDetails.invoiceNumber': req.body.invoiceDetails.invoiceNumber,
                _id: { $ne: req.params.id } // Exclude current invoice
            });
            if (existing) {
                return res.status(400).json({ success: false, message: "Invoice number must be unique" });
            }
        }

        const invoice = await PurchaseInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { ...req.body },
            { new: true, runValidators: true }
        );

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        // Activity Logging
        await recordActivity(
            req,
            'Update',
            'Purchase Invoice',
            `Purchase Invoice updated: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Invoice updated successfully", data: invoice });
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
const getPurchaseSummary = async (req, res) => {
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

// @desc    Get purchase summary by category
// @route   GET /api/purchase-invoice/summary-by-category
// @access  Private
const getSummaryByCategory = async (req, res) => {
    try {
        const query = { userId: req.user._id };

        const summary = await PurchaseInvoice.aggregate([
            { $match: query },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productGroup",
                    totalQuantity: { $sum: "$items.qty" },
                    totalValue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: "$_id",
                    totalQuantity: 1,
                    totalValue: 1
                }
            }
        ]);

        res.status(200).json({ success: true, summary: summary });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const downloadPurchaseInvoicePDF = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const userData = await User.findById(req.user._id);
        const pdfBuffer = await generatePurchaseInvoicePDF(invoice, userData || {});

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Purchase_Invoice_${invoice.invoiceDetails.invoiceNumber}.pdf"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const duplicatePurchaseInvoice = async (req, res) => {
    try {
        const original = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!original) return res.status(404).json({ success: false, message: "Invoice not found" });

        const duplicateData = original.toObject();
        delete duplicateData._id;
        delete duplicateData.createdAt;
        delete duplicateData.updatedAt;
        duplicateData.invoiceDetails.invoiceNumber = duplicateData.invoiceDetails.invoiceNumber + "-COPY";
        duplicateData.status = 'Active';

        const duplicate = await PurchaseInvoice.create(duplicateData);

        // Activity Logging
        await recordActivity(
            req,
            'Duplicate',
            'Purchase Invoice',
            `Purchase Invoice duplicated from: ${original.invoiceDetails.invoiceNumber} to ${duplicate.invoiceDetails.invoiceNumber}`,
            duplicate.invoiceDetails.invoiceNumber
        );

        res.status(201).json({ success: true, message: "Invoice duplicated successfully", data: duplicate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const cancelPurchaseInvoice = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status: 'Cancelled' },
            { new: true }
        );
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        // Activity Logging
        await recordActivity(
            req,
            'Cancel',
            'Purchase Invoice',
            `Purchase Invoice cancelled: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Invoice cancelled successfully", data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const attachFileToPurchaseInvoice = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files uploaded" });

        const newAttachments = req.files.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype
        }));

        const invoice = await PurchaseInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        // Activity Logging
        await recordActivity(
            req,
            'Attachment',
            'Purchase Invoice',
            `Files attached to Purchase Invoice: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Files attached successfully", data: invoice.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generateBarcodeForPurchaseInvoice = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const cartItems = [];
        for (const item of invoice.items) {
            // Find product by name or SKU if we have it
            const product = await mongoose.model('Product').findOne({ name: item.productName, userId: req.user._id });
            if (product) {
                cartItems.push({
                    userId: req.user._id,
                    productId: product._id,
                    productName: product.name,
                    noOfLabels: item.qty
                });
            }
        }

        if (cartItems.length > 0) {
            await BarcodeCart.insertMany(cartItems);
        }

        // Activity Logging
        await recordActivity(
            req,
            'Generate Barcode',
            'Purchase Invoice',
            `Barcode generation requested for Purchase Invoice: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: `${cartItems.length} items added to barcode cart` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareEmail = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const vendor = await Vendor.findOne({ userId: req.user._id, companyName: invoice.vendorInformation.ms });
        const email = req.body.email || (vendor ? vendor.email : null);

        if (!email) return res.status(400).json({ success: false, message: "Vendor email not found. Please provide an email address." });

        await sendInvoiceEmail(invoice, email, true);

        // Activity Logging
        await recordActivity(
            req,
            'Share Email',
            'Purchase Invoice',
            `Purchase Invoice ${invoice.invoiceDetails.invoiceNumber} shared via email to ${email}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: `Invoice sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareWhatsApp = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const vendor = await Vendor.findOne({ userId: req.user._id, companyName: invoice.vendorInformation.ms });
        const phone = req.body.phone || (vendor ? vendor.phone : null);

        if (!phone) return res.status(400).json({ success: false, message: "Vendor phone not found. Please provide a phone number." });

        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const message = `Dear ${invoice.vendorInformation.ms},\n\nWe have recorded your Purchase Invoice No: ${invoice.invoiceDetails.invoiceNumber} for Total Amount: ${invoice.totals.grandTotal.toFixed(2)}.\n\nThank you!`;
        const encodedMessage = encodeURIComponent(message);
        const deepLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

        // Activity Logging
        await recordActivity(
            req,
            'Share WhatsApp',
            'Purchase Invoice',
            `Purchase Invoice ${invoice.invoiceDetails.invoiceNumber} shared via WhatsApp to ${whatsappNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "WhatsApp share link generated", data: { whatsappNumber, deepLink } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generateEWayBill = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        // Dummy generation logic for now (updates status)
        invoice.eWayBill = {
            generated: true,
            eWayBillNumber: `EW-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
            eWayBillDate: new Date(),
            eWayBillJson: { ...req.body } // Store whatever parameters were sent
        };
        await invoice.save();

        // Activity Logging
        await recordActivity(
            req,
            'Generate E-Way Bill',
            'Purchase Invoice',
            `E-Way Bill ${invoice.eWayBill.eWayBillNumber} generated for Purchase Invoice: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "E-Way Bill generated successfully", data: invoice.eWayBill });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const downloadEWayBillJson = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice || !invoice.eWayBill.generated) return res.status(404).json({ success: false, message: "E-Way Bill not found or not generated" });

        // Activity Logging
        await recordActivity(
            req,
            'Download E-Way Bill JSON',
            'Purchase Invoice',
            `E-Way Bill JSON downloaded for Purchase Invoice: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="EWayBill_${invoice.eWayBill.eWayBillNumber}.json"`);
        res.status(200).send(JSON.stringify(invoice.eWayBill.eWayBillJson, null, 2));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Conversion Helpers
const convertToQuotation = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const quotationData = {
            userId: req.user._id,
            customerInformation: { ...invoice.vendorInformation, ms: invoice.vendorInformation.ms },
            quotationDetails: {
                quotationNumber: `QT-FROM-PUR-${invoice.invoiceDetails.invoiceNumber}`,
                date: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'PurchaseInvoice', docId: invoice._id } }
        };

        const quotation = await Quotation.create(quotationData);
        invoice.conversions.convertedTo.push({ docType: 'Quotation', docId: quotation._id });
        await invoice.save();

        // Activity Logging
        await recordActivity(
            req,
            'Convert to Quotation',
            'Purchase Invoice',
            `Purchase Invoice ${invoice.invoiceDetails.invoiceNumber} converted to Quotation ${quotation.quotationDetails.quotationNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(201).json({ success: true, message: "Converted to Quotation", data: quotation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToSaleInvoice = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const saleData = {
            userId: req.user._id,
            customerInformation: { ...invoice.vendorInformation, ms: invoice.vendorInformation.ms },
            invoiceDetails: {
                invoiceNumber: `SL-FROM-PUR-${invoice.invoiceDetails.invoiceNumber}`,
                date: new Date(),
                invoiceType: 'Tax Invoice'
            },
            items: invoice.items,
            totals: invoice.totals,
            paymentType: invoice.paymentType,
            conversions: { convertedFrom: { docType: 'PurchaseInvoice', docId: invoice._id } }
        };

        const saleInvoice = await SaleInvoice.create(saleData);
        invoice.conversions.convertedTo.push({ docType: 'SaleInvoice', docId: saleInvoice._id });
        await invoice.save();

        // Activity Logging
        await recordActivity(
            req,
            'Convert to Sale Invoice',
            'Purchase Invoice',
            `Purchase Invoice ${invoice.invoiceDetails.invoiceNumber} converted to Sale Invoice ${saleInvoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(201).json({ success: true, message: "Converted to Sale Invoice", data: saleInvoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToCreditNote = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const creditNoteData = {
            userId: req.user._id,
            customerInformation: { ...invoice.vendorInformation, ms: invoice.vendorInformation.ms },
            creditNoteDetails: {
                cnNumber: `CN-FROM-PUR-${invoice.invoiceDetails.invoiceNumber}`,
                cnDate: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'PurchaseInvoice', docId: invoice._id } }
        };

        const creditNote = await CreditNote.create(creditNoteData);
        invoice.conversions.convertedTo.push({ docType: 'CreditNote', docId: creditNote._id });
        await invoice.save();

        // Activity Logging
        await recordActivity(
            req,
            'Convert to Credit Note',
            'Purchase Invoice',
            `Purchase Invoice ${invoice.invoiceDetails.invoiceNumber} converted to Credit Note ${creditNote.creditNoteDetails.cnNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(201).json({ success: true, message: "Converted to Credit Note", data: creditNote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToDebitNote = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const debitNoteData = {
            userId: req.user._id,
            vendorInformation: invoice.vendorInformation,
            debitNoteDetails: {
                dnNumber: `DN-FROM-PUR-${invoice.invoiceDetails.invoiceNumber}`,
                dnDate: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'PurchaseInvoice', docId: invoice._id } }
        };

        const debitNote = await DebitNote.create(debitNoteData);
        invoice.conversions.convertedTo.push({ docType: 'DebitNote', docId: debitNote._id });
        await invoice.save();

        // Activity Logging
        await recordActivity(
            req,
            'Convert to Debit Note',
            'Purchase Invoice',
            `Purchase Invoice ${invoice.invoiceDetails.invoiceNumber} converted to Debit Note ${debitNote.debitNoteDetails.dnNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(201).json({ success: true, message: "Converted to Debit Note", data: debitNote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToPurchaseOrder = async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const poData = {
            userId: req.user._id,
            vendorInformation: invoice.vendorInformation,
            purchaseOrderDetails: {
                poNumber: `PO-FROM-PUR-${invoice.invoiceDetails.invoiceNumber}`,
                date: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'PurchaseInvoice', docId: invoice._id } }
        };

        const purchaseOrder = await PurchaseOrder.create(poData);
        invoice.conversions.convertedTo.push({ docType: 'PurchaseOrder', docId: purchaseOrder._id });
        await invoice.save();

        // Activity Logging
        await recordActivity(
            req,
            'Convert to Purchase Order',
            'Purchase Invoice',
            `Purchase Invoice ${invoice.invoiceDetails.invoiceNumber} converted to Purchase Order ${purchaseOrder.purchaseOrderDetails.poNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(201).json({ success: true, message: "Converted to Purchase Order", data: purchaseOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createPurchaseInvoice,
    createPurchaseInvoiceAndPrint,
    getPurchaseInvoices,
    getPurchaseInvoiceById,
    updatePurchaseInvoice,
    deletePurchaseInvoice,
    getPurchaseSummary,
    getSummaryByCategory,
    downloadPurchaseInvoicePDF,
    duplicatePurchaseInvoice,
    cancelPurchaseInvoice,
    attachFileToPurchaseInvoice,
    generateBarcodeForPurchaseInvoice,
    shareEmail,
    shareWhatsApp,
    generateEWayBill,
    downloadEWayBillJson,
    convertToQuotation,
    convertToSaleInvoice,
    convertToCreditNote,
    convertToDebitNote,
    convertToPurchaseOrder
};
