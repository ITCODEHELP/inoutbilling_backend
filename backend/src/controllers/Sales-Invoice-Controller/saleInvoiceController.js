const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const DeliveryChallan = require('../../models/Other-Document-Model/DeliveryChallan');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const User = require('../../models/User-Model/User');
const Staff = require('../../models/Setting-Model/Staff');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const fs = require('fs');
const path = require('path');

// Helper for validation
const validateSaleInvoice = (data) => {
    const { customerInformation, invoiceDetails, items, paymentType, totals } = data;

    if (!customerInformation || typeof customerInformation !== 'object') return "Customer information is required";
    if (!customerInformation.ms) return "M/S (Customer Name) is required";
    if (!customerInformation.placeOfSupply) return "Place of Supply is required";
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

    // Totals validation
    if (totals) {
        if (isNaN(totals.grandTotal)) return "Grand Total must be a number";
        if (isNaN(totals.totalTaxable)) return "Total Taxable must be a number";
        if (isNaN(totals.totalTax)) return "Total Tax must be a number";
    }

    return null;
};

// Helper for dynamic search query
const buildSaleInvoiceQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, customerName,
        product, productName,
        productGroup,
        fromDate, toDate,
        staffName,
        invoiceNo, invoiceNumber,
        minAmount, maxAmount,
        lrNo, transportNo,
        challanNo, deliveryChallanNo,
        itemNote,
        remarks, documentRemarks,
        gstin, gstinPan,
        invoiceType,
        paymentType,
        shipTo, shippingAddress,
        invoiceSeries, invoicePrefix,
        advanceFilter, // { field, operator, value }
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return { userId };

    if (search) {
        query.$or = [
            { 'customerInformation.ms': { $regex: search, $options: 'i' } },
            { 'invoiceDetails.invoiceNumber': { $regex: search, $options: 'i' } },
            { documentRemarks: { $regex: search, $options: 'i' } },
            { 'items.productName': { $regex: search, $options: 'i' } }
        ];
    }

    // Basic Filters
    if (company || customerName) {
        query['customerInformation.ms'] = { $regex: company || customerName, $options: 'i' };
    }

    if (product || productName) {
        query['items.productName'] = { $regex: product || productName, $options: 'i' };
    }

    if (productGroup) {
        query['items.productGroup'] = { $regex: productGroup, $options: 'i' };
    }

    if (invoiceNo || invoiceNumber) {
        query['invoiceDetails.invoiceNumber'] = { $regex: invoiceNo || invoiceNumber, $options: 'i' };
    }

    if (invoiceType) {
        query['invoiceDetails.invoiceType'] = invoiceType;
    }

    if (invoiceSeries || invoicePrefix) {
        query['invoiceDetails.invoicePrefix'] = { $regex: invoiceSeries || invoicePrefix, $options: 'i' };
    }

    if (paymentType) {
        query.paymentType = paymentType;
    }

    if (fromDate || toDate) {
        query['invoiceDetails.date'] = {};
        if (fromDate) query['invoiceDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['invoiceDetails.date'].$lte = end;
        }
    }

    if (minAmount || maxAmount) {
        query['totals.grandTotal'] = {};
        if (minAmount) query['totals.grandTotal'].$gte = Number(minAmount);
        if (maxAmount) query['totals.grandTotal'].$lte = Number(maxAmount);
    }

    if (lrNo || transportNo) {
        query['transportDetails.lrNo'] = { $regex: lrNo || transportNo, $options: 'i' };
    }

    if (challanNo || deliveryChallanNo) {
        // Search by both Id (if provided) or inline number if we added it
        query['deliveryChallanDetails.challanNumber'] = { $regex: challanNo || deliveryChallanNo, $options: 'i' };
    }

    if (itemNote) {
        query['items.itemNote'] = { $regex: itemNote, $options: 'i' };
    }

    if (remarks || documentRemarks) {
        query.documentRemarks = { $regex: remarks || documentRemarks, $options: 'i' };
    }

    if (gstin || gstinPan) {
        query['customerInformation.gstinPan'] = { $regex: gstin || gstinPan, $options: 'i' };
    }

    if (shipTo || shippingAddress) {
        query['customerInformation.shipTo'] = { $regex: shipTo || shippingAddress, $options: 'i' };
    }

    if (staffName) {
        const staffDocs = await Staff.find({
            ownerRef: userId,
            fullName: { $regex: staffName, $options: 'i' }
        }).select('_id');
        query.staff = { $in: staffDocs.map(s => s._id) };
    }

    // Advance Filters
    if (advanceFilter) {
        let af = advanceFilter;
        if (typeof advanceFilter === 'string') {
            try { af = JSON.parse(advanceFilter); } catch (e) { af = null; }
        }

        if (af && af.field && af.operator) {
            const fieldMap = {
                'Contact No': 'customerInformation.phone',
                'City': 'customerInformation.address',
                'State': 'customerInformation.placeOfSupply',
                'Taxable Total': 'totals.totalTaxable',
                'Invoice Note': 'items.itemNote',
                'Shipping Name': 'customerInformation.shipTo',
                'GSTIN': 'customerInformation.gstinPan'
            };

            const dbField = fieldMap[af.field] || af.field;
            let val = af.value;

            switch (af.operator) {
                case 'equals':
                    query[dbField] = val;
                    break;
                case 'contains':
                    query[dbField] = { $regex: val, $options: 'i' };
                    break;
                case 'startsWith':
                    query[dbField] = { $regex: '^' + val, $options: 'i' };
                    break;
                case 'endsWith':
                    query[dbField] = { $regex: val + '$', $options: 'i' };
                    break;
                case 'greaterThan':
                    query[dbField] = { $gt: Number(val) };
                    break;
                case 'lessThan':
                    query[dbField] = { $lt: Number(val) };
                    break;
                case 'between':
                    if (val && typeof val === 'string' && val.includes(',')) {
                        const [v1, v2] = val.split(',').map(v => Number(v.trim()));
                        query[dbField] = { $gte: v1, $lte: v2 };
                    }
                    break;
            }
        }
    }

    // Custom Fields (logic similar to Quotation)
    for (const key in otherFilters) {
        if (key.startsWith('cf_')) {
            const fieldId = key.replace('cf_', '');
            query[`customFields.${fieldId}`] = otherFilters[key];
        }
    }

    return query;
};

// @desc    Create sale invoice
// @route   POST /api/sale-invoice/create
// @access  Private
// Helper to handle the core creation logic
const handleCreateInvoiceLogic = async (req) => {
    // Ensure req.body is initialized (safety for missing body)
    if (!req.body) req.body = {};

    // 1️⃣ Parse nested JSON fields safely (handles both multipart/form-data strings and raw JSON objects)
    const nestedFields = [
        'customerInformation',
        'invoiceDetails',
        'items',
        'additionalCharges',
        'totals',
        'conversions',
        'eWayBill',
        'termsAndConditions'
    ];

    nestedFields.forEach(field => {
        // If field exists and is a string, try to parse it
        if (req.body[field] && typeof req.body[field] === 'string') {
            try {
                req.body[field] = JSON.parse(req.body[field]);
            } catch (error) {
                throw new Error(`Invalid JSON format in field: ${field}`);
            }
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
    const validationError = validateSaleInvoice(req.body);
    if (validationError) throw new Error(validationError);

    // 4️⃣ Save invoice
    const invoice = await SaleInvoice.create({
        ...req.body,
        userId: req.user._id
    });

    // 5️⃣ Auto-create Delivery Challan if requested
    if (req.body.createDeliveryChallan) {
        const challan = await DeliveryChallan.create({
            userId: req.user._id,
            saleInvoiceId: invoice._id,
            customerInformation: req.body.customerInformation,
            deliveryChallanDetails: {
                challanNumber: `DC-${req.body.invoiceDetails.invoiceNumber}`,
                date: req.body.invoiceDetails.date,
                deliveryMode: req.body.invoiceDetails.deliveryMode ? req.body.invoiceDetails.deliveryMode.toUpperCase() : 'HAND DELIVERY'
            },
            items: req.body.items,
            totals: req.body.totals,
            additionalNotes: req.body.additionalNotes,
            documentRemarks: req.body.documentRemarks
        });
        invoice.deliveryChallanId = challan._id;
        await invoice.save();
    }

    // 6️⃣ Send email if requested
    if (req.body.shareOnEmail) {
        const customer = await Customer.findOne({
            userId: req.user._id,
            companyName: req.body.customerInformation.ms
        });
        if (customer && customer.email) {
            sendInvoiceEmail(invoice, customer.email);
        }
    }

    // 7️⃣ Generate PDF Buffer
    const userData = await User.findById(req.user._id);
    const pdfBuffer = await generateSaleInvoicePDF(invoice, userData);

    // Save PDF to disk (optional but recommended for persistence)
    const pdfDir = 'src/uploads/invoices/pdf';
    if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
    }
    const pdfFileName = `invoice-${invoice._id}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFileName);
    fs.writeFileSync(pdfPath, pdfBuffer);

    return {
        invoice,
        pdfBuffer,
        pdfUrl: `/uploads/invoices/pdf/${pdfFileName}`
    };
};

// @desc    Create sale invoice
// @route   POST /api/sale-invoice/create
// @access  Private
const createInvoice = async (req, res) => {
    try {
        const { invoice, pdfUrl } = await handleCreateInvoiceLogic(req);

        res.status(201).json({
            success: true,
            message: "Invoice saved successfully",
            invoiceId: invoice._id,
            pdfUrl: pdfUrl,
            data: invoice
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Invoice number must be unique" });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create sale invoice and return PDF for print
// @route   POST /api/sale-invoice/create-print
// @access  Private
const createInvoiceAndPrint = async (req, res) => {
    try {
        const { invoice, pdfBuffer } = await handleCreateInvoiceLogic(req);

        // Set headers for PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceDetails.invoiceNumber}.pdf"`);

        // Send buffer directly
        return res.status(200).send(pdfBuffer);

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).setHeader('Content-Type', 'application/json').json({ success: false, message: "Invoice number must be unique" });
        }
        res.status(400).setHeader('Content-Type', 'application/json').json({ success: false, message: error.message });
    }
};

// Other controllers remain unchanged
const getInvoices = async (req, res) => {
    try {
        console.log('[API] GET /api/sale-invoice - Fetching invoices for user:', req.user?._id);
        const invoices = await SaleInvoice.find({ userId: req.user._id });
        console.log(`[API] Found ${invoices.length} invoices`);
        res.status(200).json(invoices);
    } catch (error) {
        console.error('[API] Error in getInvoices:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getInvoiceById = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
        res.status(200).json(invoice);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteInvoice = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
        res.status(200).json({ success: true, message: "Invoice deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getInvoiceSummary = async (req, res) => {
    try {
        const { company, productGroup, invoiceType, paymentType, fromDate, toDate } = req.query;
        const query = { userId: req.user._id };

        if (company) query["customerInformation.ms"] = new RegExp(company, 'i');
        if (invoiceType) query["invoiceDetails.invoiceType"] = invoiceType;
        if (paymentType) query.paymentType = paymentType;

        if (fromDate || toDate) {
            query["invoiceDetails.date"] = {};
            if (fromDate) query["invoiceDetails.date"].$gte = new Date(fromDate);
            if (toDate) query["invoiceDetails.date"].$lte = new Date(toDate);
        }

        const summary = await SaleInvoice.aggregate([
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

        const result = summary.length > 0 ? summary[0] : {
            totalTransactions: 0,
            totalCGST: 0,
            totalSGST: 0,
            totalIGST: 0,
            totalTaxable: 0,
            totalValue: 0
        };
        delete result._id;

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareEmail = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const customer = await Customer.findOne({ userId: req.user._id, companyName: invoice.customerInformation.ms });
        const email = req.body.email || (customer ? customer.email : null);

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const userData = await User.findById(req.user._id);
        const { sendInvoiceEmail } = require('../../utils/emailHelper');
        await sendInvoiceEmail(invoice, email);
        res.status(200).json({ success: true, message: `Invoice sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareWhatsApp = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const customer = await Customer.findOne({ userId: req.user._id, companyName: invoice.customerInformation.ms });
        const phone = req.body.phone || (customer ? customer.phone : null);

        if (!phone) return res.status(400).json({ success: false, message: "Customer phone not found. Please provide a phone number." });

        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        // Construct message
        const message = `Dear ${invoice.customerInformation.ms},\n\nPlease find your Invoice No: ${invoice.invoiceDetails.invoiceNumber} for Total Amount: ${invoice.totals.grandTotal.toFixed(2)}.\n\nThank you for your business!`;
        const encodedMessage = encodeURIComponent(message);
        const deepLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

        res.status(200).json({
            success: true,
            message: "WhatsApp share link generated",
            data: { whatsappNumber, deepLink }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareSMS = async (req, res) => {
    try {
        const axios = require('axios');
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const customer = await Customer.findOne({ userId: req.user._id, companyName: invoice.customerInformation.ms });
        const phone = req.body.phone || (customer ? customer.phone : null);

        if (!phone) return res.status(400).json({ success: false, message: "Customer phone not found. Please provide a phone number." });

        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_INVOICE_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID;

        const cleanPhone = phone.replace(/\D/g, '');
        const fullMobile = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const payload = {
            template_id: templateId,
            recipients: [{
                mobiles: fullMobile,
                invoice_no: invoice.invoiceDetails.invoiceNumber,
                amount: invoice.totals.grandTotal.toFixed(2)
            }]
        };

        await axios.post('https://control.msg91.com/api/v5/flow', payload, {
            headers: { authkey: authKey, 'Content-Type': 'application/json' }
        });

        res.status(200).json({ success: true, message: `Invoice details sent to ${fullMobile} via SMS` });
    } catch (error) {
        res.status(500).json({ success: false, message: "SMS sending failed", error: error.message });
    }
};

const downloadInvoicePDF = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const userData = await User.findById(req.user._id);
        const pdfBuffer = await generateSaleInvoicePDF(invoice, userData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceDetails.invoiceNumber}.pdf"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const searchInvoices = async (req, res) => {
    try {
        const query = await buildSaleInvoiceQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const invoices = await SaleInvoice.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await SaleInvoice.countDocuments(query);

        res.status(200).json({
            success: true,
            count: invoices.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: invoices
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    handleCreateInvoiceLogic,
    createInvoice,
    createInvoiceAndPrint,
    getInvoices,
    getInvoiceById,
    deleteInvoice,
    getInvoiceSummary,
    shareEmail,
    shareWhatsApp,
    shareSMS,
    downloadInvoicePDF,
    searchInvoices
};
