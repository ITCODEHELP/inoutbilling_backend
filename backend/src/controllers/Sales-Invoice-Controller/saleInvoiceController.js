const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const DeliveryChallan = require('../../models/Other-Document-Model/DeliveryChallan');
const Proforma = require('../../models/Other-Document-Model/Proforma');
const PackingList = require('../../models/Other-Document-Model/PackingList');
const Quotation = require('../../models/Other-Document-Model/Quotation');
const CreditNote = require('../../models/Other-Document-Model/CreditNote');
const DebitNote = require('../../models/Other-Document-Model/DebitNote');
const PurchaseInvoice = require('../../models/Purchase-Invoice-Model/PurchaseInvoice');
const PurchaseOrder = require('../../models/Other-Document-Model/PurchaseOrder');
const BarcodeCart = require('../../models/Product-Service-Model/BarcodeCart');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const User = require('../../models/User-Model/User');
const Staff = require('../../models/Setting-Model/Staff');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { getSelectedPrintTemplate } = require('../../utils/documentHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Helper to generate secure public token
const generatePublicToken = (id) => {
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    return crypto
        .createHmac('sha256', secret)
        .update(id.toString())
        .digest('hex')
        .substring(0, 16);
};
const Product = require('../../models/Product-Service-Model/Product');
const numberToWords = require('../../utils/numberToWords');

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

        // Accept both 'productName' and 'name' for flexibility
        if (!item.productName && !item.name) return `Product Name is required for item ${i + 1}`;

        // Accept both 'qty' and 'quantity', convert to number
        const qty = Number(item.qty || item.quantity || 0);
        if (!qty || qty <= 0) return `Quantity must be greater than 0 for item ${i + 1}`;

        // Accept both 'price' and 'rate', convert to number
        const price = Number(item.price || item.rate || 0);
        if (!price || price <= 0) return `Price must be greater than 0 for item ${i + 1}`;
    }

    // Totals validation - convert to numbers and validate
    if (totals) {
        const grandTotal = Number(totals.grandTotal || 0);
        const totalTaxable = Number(totals.totalTaxable || totals.taxableAmount || 0);
        const totalTax = Number(totals.totalTax || 0);

        if (isNaN(grandTotal)) return "Grand Total must be a number";
        if (isNaN(totalTaxable)) return "Total Taxable must be a number";
        if (isNaN(totalTax)) return "Total Tax must be a number";
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

    let bodyData = {};

    // 1️⃣ Extract data from req.body.data if it exists, otherwise use req.body
    if (req.body.data) {
        try {
            bodyData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
        } catch (error) {
            throw new Error("Invalid JSON format in 'data' field");
        }
    } else {
        bodyData = { ...req.body };
        // Parse individual nested fields if they are strings (for backward compatibility or direct form-data fields)
        const nestedFields = [
            'customerInformation', 'invoiceDetails', 'items', 'additionalCharges',
            'totals', 'conversions', 'eWayBill', 'termsAndConditions', 'customFields'
        ];
        nestedFields.forEach(field => {
            if (bodyData[field] && typeof bodyData[field] === 'string') {
                try {
                    bodyData[field] = JSON.parse(bodyData[field]);
                } catch (error) {
                    throw new Error(`Invalid JSON format in field: ${field}`);
                }
            }
        });
    }

    // 1.5️⃣ Normalize item field names (convert 'name' to 'productName' if needed)
    if (bodyData.items && Array.isArray(bodyData.items)) {
        bodyData.items = bodyData.items.map(item => {
            const normalizedItem = { ...item };

            // Normalize product name
            if (item.name && !item.productName) {
                normalizedItem.productName = item.name;
            }

            // Normalize quantity (accept 'quantity' or 'qty', convert to 'qty')
            if (item.quantity && !item.qty) {
                normalizedItem.qty = Number(item.quantity);
            } else if (item.qty) {
                normalizedItem.qty = Number(item.qty);
            }

            // Normalize price (accept 'rate' or 'price', convert to 'price')
            if (item.rate && !item.price) {
                normalizedItem.price = Number(item.rate);
            } else if (item.price) {
                normalizedItem.price = Number(item.price);
            }

            // Normalize HSN/SAC
            if (item.hsnCode && !item.hsnSac) {
                normalizedItem.hsnSac = item.hsnCode;
            }

            return normalizedItem;
        });
    }

    // 1.6️⃣ Normalize totals fields (convert to numbers and handle field variations)
    if (bodyData.totals && typeof bodyData.totals === 'object') {
        const totals = bodyData.totals;
        bodyData.totals = {
            ...totals,
            grandTotal: Number(totals.grandTotal || 0),
            totalTaxable: Number(totals.totalTaxable || totals.taxableAmount || 0),
            totalTax: Number(totals.totalTax || 0),
            totalCGST: Number(totals.totalCGST || totals.cgst || 0),
            totalSGST: Number(totals.totalSGST || totals.sgst || 0),
            totalIGST: Number(totals.totalIGST || totals.igst || 0),
            roundOff: Number(totals.roundOff || 0)
        };
    }

    // 1.7️⃣ Normalize paymentType to uppercase (schema requires uppercase enum)
    if (bodyData.paymentType && typeof bodyData.paymentType === 'string') {
        bodyData.paymentType = bodyData.paymentType.toUpperCase();
    }

    // 2️⃣ Handle attachments
    if (req.files && req.files.length > 0) {
        bodyData.attachments = req.files.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype
        }));
    }

    // 3️⃣ Validate
    const validationError = validateSaleInvoice(bodyData);
    if (validationError) throw new Error(validationError);

    // 4️⃣ Save invoice
    const invoice = await SaleInvoice.create({
        ...bodyData,
        userId: req.user._id
    });

    // 4.5️⃣ Record Activity
    await recordActivity(
        req,
        'Insert',
        'Sale Invoice',
        `New Sale Invoice created for: ${bodyData.customerInformation.ms}`,
        bodyData.invoiceDetails.invoiceNumber
    );

    // 4.6️⃣ Update source document if converted from another document (e.g., Quotation)
    if (bodyData.conversions && bodyData.conversions.convertedFrom) {
        const { docType, docId } = bodyData.conversions.convertedFrom;
        if (docType === 'Quotation' && docId) {
            await Quotation.findByIdAndUpdate(docId, {
                $push: {
                    'conversions.convertedTo': {
                        docType: 'Sale Invoice',
                        docId: invoice._id,
                        docNo: invoice.invoiceDetails.invoiceNumber,
                        convertedAt: new Date()
                    }
                }
            });
        }
    }

    // 5️⃣ Auto-create Delivery Challan if requested
    if (bodyData.createDeliveryChallan) {
        const challan = await DeliveryChallan.create({
            userId: req.user._id,
            saleInvoiceId: invoice._id,
            customerInformation: bodyData.customerInformation,
            deliveryChallanDetails: {
                challanNumber: `DC-${bodyData.invoiceDetails.invoiceNumber}`,
                date: bodyData.invoiceDetails.date,
                deliveryMode: bodyData.invoiceDetails.deliveryMode ? bodyData.invoiceDetails.deliveryMode.toUpperCase() : 'HAND DELIVERY'
            },
            items: bodyData.items,
            totals: bodyData.totals,
            additionalNotes: bodyData.additionalNotes,
            documentRemarks: bodyData.documentRemarks
        });
        invoice.deliveryChallanId = challan._id;
        await invoice.save();
    }

    // 6️⃣ Send email if requested
    if (bodyData.shareOnEmail) {
        const customer = await Customer.findOne({
            userId: req.user._id,
            companyName: bodyData.customerInformation.ms
        });
        if (customer && customer.email) {
            sendInvoiceEmail(invoice, customer.email);
        }
    }

    // 7️⃣ Generate PDF Buffer
    const userData = await User.findById(req.user._id);
    const options = getCopyOptions(req);
    const printConfig = await getSelectedPrintTemplate(req.user._id, 'Sale Invoice', bodyData.branch);
    const pdfBuffer = await generateSaleInvoicePDF(invoice, userData, options, 'Sale Invoice', printConfig);

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

// Internal helper for item resolution
const resolveItemLogic = async (userId, itemInput) => {
    let product = null;

    // Lookup priority: productId > productName > hsnSac
    if (itemInput.productId) {
        product = await Product.findOne({ _id: itemInput.productId, userId });
    } else if (itemInput.productName) {
        product = await Product.findOne({ name: itemInput.productName, userId });
    } else if (itemInput.hsnSac || itemInput.hsnCode) {
        product = await Product.findOne({ hsnSac: itemInput.hsnSac || itemInput.hsnCode, userId });
    }

    if (!product) {
        // If no product found, return the item as is (manual entry)
        return {
            ...itemInput,
            hsnSac: itemInput.hsnSac || itemInput.hsnCode || '',
            qty: Number(itemInput.qty || 1),
            price: Number(itemInput.price || 0),
            discountValue: Number(itemInput.discountValue || 0),
            igst: Number(itemInput.igst || 0),
            cgst: Number(itemInput.cgst || 0),
            sgst: Number(itemInput.sgst || 0),
            taxableValue: 0,
            total: 0
        };
    }

    // Resolve Defaults
    const resolvedItem = {
        ...itemInput,
        productId: product._id,
        productName: itemInput.productName || product.name,
        hsnSac: itemInput.hsnSac || itemInput.hsnCode || product.hsnSac,
        uom: itemInput.uom || product.unitOfMeasurement,
        productGroup: itemInput.productGroup || product.productGroup,
        qty: Number(itemInput.qty || 1),
        discountType: itemInput.discountType || (product.inventoryType === 'Serial' ? (product.serialData?.saleDiscount?.type || (product.saleDiscount?.type || 'Flat')) : (product.saleDiscount?.type || 'Flat'))
    };

    // Price and Discount Priority
    if (product.inventoryType === 'Serial') {
        resolvedItem.price = itemInput.price !== undefined && itemInput.price !== 0 ? Number(itemInput.price) : (product.serialData?.sellPrice || product.sellPrice);
        if (itemInput.discountValue === undefined) {
            const serialDiscount = product.serialData?.saleDiscount;
            resolvedItem.discountValue = serialDiscount ? serialDiscount.value : (product.saleDiscount?.value || 0);
        } else {
            resolvedItem.discountValue = Number(itemInput.discountValue);
        }
    } else {
        resolvedItem.price = itemInput.price !== undefined && itemInput.price !== 0 ? Number(itemInput.price) : product.sellPrice;
        resolvedItem.discountValue = itemInput.discountValue !== undefined ? Number(itemInput.discountValue) : (product.saleDiscount?.value || 0);
    }

    // Tax Defaults
    resolvedItem.igst = itemInput.igst !== undefined ? Number(itemInput.igst) : (product ? product.taxSelection : 0);
    resolvedItem.cgst = itemInput.cgst !== undefined ? Number(itemInput.cgst) : (resolvedItem.igst / 2);
    resolvedItem.sgst = itemInput.sgst !== undefined ? Number(itemInput.sgst) : (resolvedItem.igst / 2);

    // Stock
    resolvedItem.availableStock = product.inventoryType === 'Serial'
        ? (product.serialData?.serialNumbers?.length || 0)
        : (product.availableQuantity || 0);

    // Calculations
    const qty = resolvedItem.qty;
    const price = resolvedItem.price;
    const discountValue = resolvedItem.discountValue;

    let discountAmount = 0;
    if (resolvedItem.discountType === 'Percentage') {
        discountAmount = (qty * price) * (discountValue / 100);
    } else {
        discountAmount = discountValue;
    }

    const taxableValue = (qty * price) - discountAmount;
    const igstAmount = taxableValue * (resolvedItem.igst / 100);
    const cgstAmount = taxableValue * (resolvedItem.cgst / 100);
    const sgstAmount = taxableValue * (resolvedItem.sgst / 100);
    const total = taxableValue + igstAmount + cgstAmount + sgstAmount;

    resolvedItem.taxableValue = Number(taxableValue.toFixed(2));
    resolvedItem.total = Number(total.toFixed(2));

    // Internal use: attach snapshot
    resolvedItem.productSnapshot = product.toObject();

    return resolvedItem;
};

// @desc    Resolve single invoice item with auto-population and calculations
// @route   POST /api/sale-invoice/resolve-item
// @access  Private
const resolveInvoiceItem = async (req, res) => {
    try {
        const itemData = req.body;
        if (!itemData.productName && !itemData.hsnSac && !itemData.productId) {
            return res.status(400).json({ success: false, message: "productName, productId, or hsnSac is required" });
        }

        const resolved = await resolveItemLogic(req.user._id, itemData);

        // Return only UI-required fields as requested
        const uiResponse = {
            productName: resolved.productName,
            productId: resolved.productId,
            hsnSac: resolved.hsnSac,
            qty: resolved.qty,
            uom: resolved.uom,
            price: resolved.price,
            discountType: resolved.discountType,
            discountValue: resolved.discountValue,
            igst: resolved.igst,
            cgst: resolved.cgst,
            sgst: resolved.sgst,
            taxableValue: resolved.taxableValue,
            total: resolved.total,
            availableStock: resolved.availableStock
        };

        // --- HSN/SAC Auto-Resolution Fallback ---
        if (uiResponse.hsnSac && !uiResponse.cgst && !uiResponse.sgst && !uiResponse.igst) {
            try {
                const code = String(uiResponse.hsnSac).trim();
                // Create a regex that matches the code with optional whitespace between characters
                // e.g. "9954" becomes "9\s*9\s*5\s*4" to match "99 54" or "9954"
                const robustRegex = new RegExp(`(^|[^0-9])${code.split('').join('\\s*')}([^0-9]|$)`);

                // Search in hsn_codes collection (expected to contain both HSN and SAC codes)
                const taxData = await mongoose.connection.db.collection('hsn_codes').findOne({
                    "Chapter / Heading /": { $regex: robustRegex }
                });

                if (taxData) {

                    // Access tax fields using exact bracket notation and convert to percentages
                    uiResponse.cgst = Number(taxData["CGST Rate (%)"] || 0) * 100;
                    uiResponse.sgst = Number(taxData["SGST / UTGST Rate (%)"] || 0) * 100;
                    uiResponse.igst = Number(taxData["IGST Rate (%)"] || 0) * 100;

                    // Add resolved tax metadata for frontend pre-selection (non-binding)
                    uiResponse.resolvedTaxType = uiResponse.igst > 0 ? 'IGST' : 'CGST+SGST';
                    uiResponse.resolvedGstRate = uiResponse.igst > 0 ? uiResponse.igst : (uiResponse.cgst + uiResponse.sgst);
                    uiResponse.resolvedIgst = uiResponse.igst;
                    uiResponse.resolvedCgst = uiResponse.cgst;
                    uiResponse.resolvedSgst = uiResponse.sgst;

                    // Final calculation for taxableValue and total with resolved tax
                    // Ensure calculations happen even if they were 0 before
                    const qty = Number(uiResponse.qty || 1);
                    const price = Number(uiResponse.price || 0);
                    const discountValue = Number(uiResponse.discountValue || 0);

                    let discountAmount = 0;
                    if (uiResponse.discountType === 'Percentage') {
                        discountAmount = (qty * price) * (discountValue / 100);
                    } else {
                        discountAmount = discountValue;
                    }

                    const taxableValue = (qty * price) - discountAmount;
                    uiResponse.taxableValue = Number(taxableValue.toFixed(2));

                    let gstAmount = 0;
                    if (uiResponse.igst > 0) {
                        gstAmount = taxableValue * (uiResponse.igst / 100);
                    } else {
                        gstAmount = taxableValue * ((uiResponse.cgst + uiResponse.sgst) / 100);
                    }
                    uiResponse.total = Number((taxableValue + gstAmount).toFixed(2));
                } else {


                    // Secondary Lookup: HSN_Rate
                    // HSN_Rate collection has 'HSN Code' as a Number (e.g., 4061000)
                    let hsnRateData = null;
                    const numericCode = Number(code.replace(/\s+/g, '')); // Remove spaces for number conversion

                    if (!isNaN(numericCode)) {
                        // Try exact numeric match first
                        hsnRateData = await mongoose.connection.db.collection('HSN_Rate').findOne({
                            "HSN Code": numericCode
                        });
                    }

                    // If not found or not a valid number (though validation/cleaning might imply it's numeric-ish), try string/regex match just in case some are strings
                    if (!hsnRateData) {
                        hsnRateData = await mongoose.connection.db.collection('HSN_Rate').findOne({
                            "HSN Code": { $regex: robustRegex }
                        });
                    }

                    if (hsnRateData && hsnRateData.Rate) {


                        // Parse Rate (e.g., "18%")
                        const rateString = String(hsnRateData.Rate).replace('%', '').trim();
                        const totalRate = parseFloat(rateString) || 0;

                        // Split IGST into CGST/SGST
                        uiResponse.igst = totalRate;
                        uiResponse.cgst = totalRate / 2;
                        uiResponse.sgst = totalRate / 2;

                        // Add resolved tax metadata
                        uiResponse.resolvedTaxType = 'CGST+SGST'; // Default assumption, or split logic
                        uiResponse.resolvedGstRate = totalRate;
                        uiResponse.resolvedIgst = totalRate;
                        uiResponse.resolvedCgst = totalRate / 2;
                        uiResponse.resolvedSgst = totalRate / 2;

                        // Final calculation for taxableValue and total
                        const qty = Number(uiResponse.qty || 1);
                        const price = Number(uiResponse.price || 0);
                        const discountValue = Number(uiResponse.discountValue || 0);

                        let discountAmount = 0;
                        if (uiResponse.discountType === 'Percentage') {
                            discountAmount = (qty * price) * (discountValue / 100);
                        } else {
                            discountAmount = discountValue;
                        }

                        const taxableValue = (qty * price) - discountAmount;
                        uiResponse.taxableValue = Number(taxableValue.toFixed(2));

                        let gstAmount = 0;
                        // Use IGST calculation logic or CGST+SGST sum (they are equal)
                        // But we should stick to typical logic: if local (cgst+sgst) else interstate (igst).
                        // Since we don't know the state here, we provide the split values but calculation usually depends on place of supply.
                        // However, the requested logic for primary was:
                        if (uiResponse.igst > 0) {
                            // Note: For HSN_Rate we forced IGST = Total.
                            // But locally we typically want CGST+SGST if it's intra-state. 
                            // The prompt says "return these values... so the frontend can auto-fill".
                            // We calculate Total using the IGST rate effectively (since IGST = CGST+SGST).
                            gstAmount = taxableValue * (uiResponse.igst / 100);
                        } else {
                            gstAmount = taxableValue * ((uiResponse.cgst + uiResponse.sgst) / 100);
                        }
                        uiResponse.total = Number((taxableValue + gstAmount).toFixed(2));
                    } else {

                    }
                }
            } catch (err) {
                console.error("HSN/SAC Fallback Error:", err.message);
            }
        }
        // ------------------------------------

        res.status(200).json({ success: true, data: uiResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create sale invoice with dynamic product lookup and auto-calculations
// @route   POST /api/sale-invoice/create-dynamic
// @access  Private
const handleCreateDynamicInvoiceLogic = async (req) => {
    if (!req.body) req.body = {};
    let bodyData = {};

    // 1. Extract data
    if (req.body.data) {
        try {
            bodyData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
        } catch (error) {
            throw new Error("Invalid JSON format in 'data' field");
        }
    } else {
        bodyData = { ...req.body };
        const nestedFields = [
            'customerInformation', 'invoiceDetails', 'items', 'additionalCharges',
            'totals', 'conversions', 'eWayBill', 'termsAndConditions', 'customFields'
        ];
        nestedFields.forEach(field => {
            if (bodyData[field] && typeof bodyData[field] === 'string') {
                try {
                    bodyData[field] = JSON.parse(bodyData[field]);
                } catch (error) {
                    throw new Error(`Invalid JSON format in field: ${field}`);
                }
            }
        });
    }

    if (!bodyData.items || !Array.isArray(bodyData.items)) throw new Error("Items array is required");

    // 2. Resolve Products and Calculate Item Totals
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const resolvedItems = [];
    for (let item of bodyData.items) {
        const resolved = await resolveItemLogic(req.user._id, item);

        // Stock Validation & Serial Handling
        if (resolved.productSnapshot) {
            const product = resolved.productSnapshot;
            if (product.itemType === 'Product') {
                if (product.inventoryType === 'Serial') {
                    if (resolved.qty > 0) {
                        if (!resolved.serialNumbers || !Array.isArray(resolved.serialNumbers)) {
                            throw new Error(`Serial numbers are required for ${product.name}`);
                        }
                        if (resolved.serialNumbers.length !== resolved.qty) {
                            throw new Error(`Number of serials (${resolved.serialNumbers.length}) must match quantity (${resolved.qty}) for ${product.name}`);
                        }
                        const availableSerials = product.serialData?.serialNumbers || [];
                        for (const sn of resolved.serialNumbers) {
                            if (!availableSerials.includes(sn)) {
                                throw new Error(`Serial number ${sn} is not available for ${product.name}`);
                            }
                        }
                    }
                } else {
                    if (resolved.qty > product.availableQuantity) {
                        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.availableQuantity}, Requested: ${resolved.qty}`);
                    }
                }
            }
        }

        // Accumulate totals
        const igstRate = Number(resolved.igst || 0);
        const cgstRate = Number(resolved.cgst || 0);
        const sgstRate = Number(resolved.sgst || 0);
        const taxableVal = Number(resolved.taxableValue || 0);

        totalTaxable += taxableVal;
        totalIGST += taxableVal * (igstRate / 100);
        totalCGST += taxableVal * (cgstRate / 100);
        totalSGST += taxableVal * (sgstRate / 100);

        resolvedItems.push(resolved);
    }

    bodyData.items = resolvedItems;

    // 3. Handle Additional Charges
    let totalAdditionalTax = 0;
    let chargesTotal = 0;
    if (bodyData.additionalCharges && Array.isArray(bodyData.additionalCharges)) {
        bodyData.additionalCharges.forEach(charge => {
            const amount = Number(charge.chargeAmount || 0);
            const taxRate = Number(charge.taxRate || 0);
            const tax = amount * (taxRate / 100);
            chargesTotal += amount;
            totalAdditionalTax += tax;
        });
    }

    // 4. Calculate Invoice Totals
    const totalTax = totalIGST + totalCGST + totalSGST + totalAdditionalTax;
    const rawTotal = totalTaxable + totalTax + chargesTotal;
    const grandTotal = Math.round(rawTotal);
    const roundOff = grandTotal - rawTotal;

    bodyData.totals = {
        totalTaxable: Number(totalTaxable.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalIGST: Number(totalIGST.toFixed(2)),
        totalCGST: Number(totalCGST.toFixed(2)),
        totalSGST: Number(totalSGST.toFixed(2)),
        roundOff: Number(roundOff.toFixed(2)),
        grandTotal: grandTotal,
        totalInWords: numberToWords(grandTotal)
    };

    if (bodyData.paymentType) bodyData.paymentType = bodyData.paymentType.toUpperCase();

    if (req.files && req.files.length > 0) {
        bodyData.attachments = req.files.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype
        }));
    }

    const invoice = await SaleInvoice.create({ ...bodyData, userId: req.user._id });

    // Atomic Stock Update
    for (const item of invoice.items) {
        if (!item.productId) continue;
        const product = await Product.findById(item.productId);
        if (!product || product.itemType !== 'Product') continue;

        if (product.inventoryType === 'Serial' && item.serialNumbers && item.serialNumbers.length > 0) {
            await Product.findByIdAndUpdate(item.productId, {
                $pull: { 'serialData.serialNumbers': { $in: item.serialNumbers } }
            });
        } else {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { availableQuantity: -item.qty }
            });
        }
    }

    await recordActivity(req, 'Insert', 'Sale Invoice', `Dynamic Sale Invoice created for: ${bodyData.customerInformation.ms}`, bodyData.invoiceDetails.invoiceNumber);

    if (bodyData.createDeliveryChallan) {
        const challan = await DeliveryChallan.create({
            userId: req.user._id, saleInvoiceId: invoice._id, customerInformation: bodyData.customerInformation,
            deliveryChallanDetails: { challanNumber: `DC-${bodyData.invoiceDetails.invoiceNumber}`, date: bodyData.invoiceDetails.date, deliveryMode: bodyData.invoiceDetails.deliveryMode ? bodyData.invoiceDetails.deliveryMode.toUpperCase() : 'HAND DELIVERY' },
            items: invoice.items, totals: invoice.totals, additionalNotes: bodyData.additionalNotes, documentRemarks: bodyData.documentRemarks
        });
        invoice.deliveryChallanId = challan._id;
        await invoice.save();
    }

    if (bodyData.shareOnEmail) {
        const customer = await Customer.findOne({ userId: req.user._id, companyName: bodyData.customerInformation.ms });
        if (customer && customer.email) sendInvoiceEmail(invoice, customer.email);
    }

    const userData = await User.findById(req.user._id);
    const options = getCopyOptions(req);
    const printConfig = await getSelectedPrintTemplate(req.user._id, 'Sale Invoice');
    const pdfBuffer = await generateSaleInvoicePDF(invoice, userData, options, 'Sale Invoice', printConfig);
    const pdfDir = 'src/uploads/invoices/pdf';
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const pdfFileName = `invoice-${invoice._id}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFileName);
    fs.writeFileSync(pdfPath, pdfBuffer);

    return { invoice, pdfUrl: `/uploads/invoices/pdf/${pdfFileName}` };
};

const createDynamicInvoice = async (req, res) => {
    try {
        const { invoice, pdfUrl } = await handleCreateDynamicInvoiceLogic(req);
        res.status(201).json({ success: true, message: "Dynamic invoice saved successfully", invoiceId: invoice._id, pdfUrl: pdfUrl, data: invoice });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: "Invoice number must be unique" });
        res.status(400).json({ success: false, message: error.message });
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
        const ids = req.params.id.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
        if (ids.length === 0) return res.status(400).json({ success: false, message: "Invalid ID(s) provided" });

        const invoices = await SaleInvoice.find({ _id: { $in: ids }, userId: req.user._id });
        if (invoices.length !== ids.length) return res.status(404).json({ success: false, message: "Some invoice(s) not found" });

        const firstInvoice = invoices[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstInvoice.customerInformation.ms });
        const email = req.body.email || customer?.email;

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const options = getCopyOptions(req);
        const { sendInvoiceEmail } = require('../../utils/emailHelper');

        // sendInvoiceEmail now handles multi-copy flags inside it or we can pass as options
        await sendInvoiceEmail(invoices, email, false, options, 'Sale Invoice');

        res.status(200).json({ success: true, message: `Invoice(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
        if (ids.length === 0) return res.status(400).json({ success: false, message: "Invalid ID(s) provided" });

        const invoices = await SaleInvoice.find({ _id: { $in: ids }, userId: req.user._id });
        if (invoices.length !== ids.length) return res.status(404).json({ success: false, message: "Some invoice(s) not found" });

        const firstInvoice = invoices[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstInvoice.customerInformation.ms });
        const phone = req.body.phone || customer?.phone;

        if (!phone) return res.status(400).json({ success: false, message: "Customer phone not found. Please provide a phone number." });

        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const options = getCopyOptions(req);

        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const token = generatePublicToken(req.params.id);
        const publicLink = `${req.protocol}://${req.get('host')}/api/sale-invoice/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (invoices.length === 1) {
            message = `Dear ${firstInvoice.customerInformation.ms},\n\nPlease find your Invoice No: ${firstInvoice.invoiceDetails.invoiceNumber} for Total Amount: ₹${firstInvoice.totals.grandTotal.toFixed(2)}.\n\nView/Download PDF: ${publicLink}\n\nThank you for your business!`;
        } else {
            message = `Dear ${firstInvoice.customerInformation.ms},\n\nPlease find your merged Invoices for Total Amount: ₹${invoices.reduce((sum, inv) => sum + inv.totals.grandTotal, 0).toFixed(2)}.\n\nView/Download PDF: ${publicLink}\n\nThank you for your business!`;
        }

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
        const ids = req.params.id.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
        if (ids.length === 0) return res.status(400).json({ success: false, message: "Invalid ID(s) provided" });

        const invoices = await SaleInvoice.find({ _id: { $in: ids }, userId: req.user._id });
        if (invoices.length !== ids.length) return res.status(404).json({ success: false, message: "Some invoice(s) not found" });

        const firstInvoice = invoices[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstInvoice.customerInformation.ms });
        const phone = req.body.phone || customer?.phone;

        if (!phone) return res.status(400).json({ success: false, message: "Customer phone not found. Please provide a phone number." });

        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_INVOICE_TEMPLATE_ID || process.env.MSG91_FLOW_ID;

        if (!authKey || !templateId) {
            return res.status(500).json({ success: false, message: "MSG91 credentials not configured" });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const fullMobile = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const token = generatePublicToken(req.params.id);
        const publicLink = `${req.protocol}://${req.get('host')}/api/sale-invoice/view-public/${req.params.id}/${token}`;

        const payload = {
            template_id: templateId,
            recipients: [{
                mobiles: fullMobile,
                invoice_no: invoices.length === 1 ? firstInvoice.invoiceDetails.invoiceNumber : 'Multiple',
                amount: invoices.reduce((sum, inv) => sum + inv.totals.grandTotal, 0).toFixed(2),
                view_link: publicLink
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
        const ids = req.params.id.split(',');
        const invoices = await SaleInvoice.find({ _id: { $in: ids }, userId: req.user._id });
        if (!invoices || invoices.length === 0) return res.status(404).json({ success: false, message: "Invoice(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Sale Invoice', invoices[0].branch);
        const pdfBuffer = await generateSaleInvoicePDF(invoices, userData, options, 'Sale Invoice', printConfig);

        const filename = invoices.length === 1 ? `Invoice_${invoices[0].invoiceDetails.invoiceNumber}.pdf` : `Merged_Invoices.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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

const duplicateInvoice = async (req, res) => {
    try {
        const original = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!original) return res.status(404).json({ success: false, message: "Invoice not found" });

        const duplicateData = original.toObject();
        delete duplicateData._id;
        delete duplicateData.createdAt;
        delete duplicateData.updatedAt;
        duplicateData.invoiceDetails.invoiceNumber = duplicateData.invoiceDetails.invoiceNumber + "-COPY";
        duplicateData.status = 'Active';

        const duplicate = await SaleInvoice.create(duplicateData);

        await recordActivity(
            req,
            'Duplicate',
            'Sale Invoice',
            `Invoice duplicated from: ${original.invoiceDetails.invoiceNumber} to ${duplicate.invoiceDetails.invoiceNumber}`,
            duplicate.invoiceDetails.invoiceNumber
        );

        res.status(201).json({ success: true, message: "Invoice duplicated successfully", data: duplicate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const cancelInvoice = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status: 'Cancelled' },
            { new: true }
        );
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        await recordActivity(
            req,
            'Cancel',
            'Sale Invoice',
            `Invoice cancelled: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Invoice cancelled successfully", data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const restoreInvoice = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        // Determine status based on payments
        let newStatus = 'Unpaid';
        if (invoice.paidAmount >= invoice.totals.grandTotal && invoice.totals.grandTotal > 0) {
            newStatus = 'Paid';
        } else if (invoice.paidAmount > 0) {
            newStatus = 'Partial';
        }

        invoice.status = newStatus;
        await invoice.save();

        await recordActivity(
            req,
            'Restore',
            'Sale Invoice',
            `Invoice restored: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Invoice restored successfully", data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const attachFileToInvoice = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files uploaded" });

        const newAttachments = req.files.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype
        }));

        const invoice = await SaleInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        await recordActivity(
            req,
            'Attachment',
            'Sale Invoice',
            `Files attached to Invoice: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Files attached successfully", data: invoice.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generateBarcodeForInvoice = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const cartItems = [];
        for (const item of invoice.items) {
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

        await recordActivity(
            req,
            'Generate Barcode',
            'Sale Invoice',
            `Barcode generation requested for Invoice: ${invoice.invoiceDetails.invoiceNumber}`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: `${cartItems.length} items added to barcode cart` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generateEWayBill = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        invoice.eWayBill = {
            generated: true,
            eWayBillNumber: `EW-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
            eWayBillDate: new Date(),
            eWayBillJson: { ...req.body }
        };
        await invoice.save();

        await recordActivity(
            req,
            'Generate E-Way Bill',
            'Sale Invoice',
            `E-Way Bill ${invoice.eWayBill.eWayBillNumber} generated`,
            invoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "E-Way Bill generated", data: invoice.eWayBill });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const downloadEWayBillJson = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice || !invoice.eWayBill.generated) return res.status(404).json({ success: false, message: "E-Way Bill not found" });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="EWayBill_${invoice.eWayBill.eWayBillNumber}.json"`);
        res.status(200).send(JSON.stringify(invoice.eWayBill.eWayBillJson, null, 2));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Conversions
const convertToDeliveryChallan = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const challan = await DeliveryChallan.create({
            userId: req.user._id,
            saleInvoiceId: invoice._id,
            customerInformation: invoice.customerInformation,
            deliveryChallanDetails: {
                challanNumber: `DC-FROM-SL-${invoice.invoiceDetails.invoiceNumber}`,
                date: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'SaleInvoice', docId: invoice._id } }
        });
        invoice.conversions.convertedTo.push({ docType: 'DeliveryChallan', docId: challan._id });
        await invoice.save();

        res.status(201).json({ success: true, message: "Converted to Delivery Challan", data: challan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToProformaInvoice = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const proforma = await Proforma.create({
            userId: req.user._id,
            customerInformation: invoice.customerInformation,
            proformaDetails: {
                proformaNumber: `PI-FROM-SL-${invoice.invoiceDetails.invoiceNumber}`,
                date: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'SaleInvoice', docId: invoice._id } }
        });
        invoice.conversions.convertedTo.push({ docType: 'Proforma', docId: proforma._id });
        await invoice.save();

        res.status(201).json({ success: true, message: "Converted to Proforma ", data: proforma });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToQuotation = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const quotation = await Quotation.create({
            userId: req.user._id,
            customerInformation: invoice.customerInformation,
            quotationDetails: {
                quotationNumber: `QT-FROM-SL-${invoice.invoiceDetails.invoiceNumber}`,
                date: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'SaleInvoice', docId: invoice._id } }
        });
        invoice.conversions.convertedTo.push({ docType: 'Quotation', docId: quotation._id });
        await invoice.save();

        res.status(201).json({ success: true, message: "Converted to Quotation", data: quotation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToCreditNote = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const creditNote = await CreditNote.create({
            userId: req.user._id,
            customerInformation: invoice.customerInformation,
            creditNoteDetails: {
                cnNumber: `CN-FROM-SL-${invoice.invoiceDetails.invoiceNumber}`,
                cnDate: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'SaleInvoice', docId: invoice._id } }
        });
        invoice.conversions.convertedTo.push({ docType: 'CreditNote', docId: creditNote._id });
        await invoice.save();

        res.status(201).json({ success: true, message: "Converted to Credit Note", data: creditNote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToDebitNote = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const debitNote = await DebitNote.create({
            userId: req.user._id,
            customerInformation: invoice.customerInformation,
            debitNoteDetails: {
                dnNumber: `DN-FROM-SL-${invoice.invoiceDetails.invoiceNumber}`,
                dnDate: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'SaleInvoice', docId: invoice._id } }
        });
        invoice.conversions.convertedTo.push({ docType: 'DebitNote', docId: debitNote._id });
        await invoice.save();

        res.status(201).json({ success: true, message: "Converted to Debit Note", data: debitNote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToPurchaseInvoice = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const purchaseInvoice = await PurchaseInvoice.create({
            userId: req.user._id,
            vendorInformation: { ...invoice.customerInformation, ms: invoice.customerInformation.ms },
            invoiceDetails: {
                invoiceNumber: `PUR-FROM-SL-${invoice.invoiceDetails.invoiceNumber}`,
                date: new Date()
            },
            items: invoice.items,
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'SaleInvoice', docId: invoice._id } }
        });
        invoice.conversions.convertedTo.push({ docType: 'PurchaseInvoice', docId: purchaseInvoice._id });
        await invoice.save();

        res.status(201).json({ success: true, message: "Converted to Purchase Invoice", data: purchaseInvoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const convertToPackingList = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const packingList = await PackingList.create({
            userId: req.user._id,
            customerInformation: invoice.customerInformation,
            packingListDetails: {
                plNumber: `PL-FROM-SL-${invoice.invoiceDetails.invoiceNumber}`,
                plDate: new Date()
            },
            items: invoice.items.map(item => ({ productName: item.productName, qty: item.qty })),
            totals: invoice.totals,
            conversions: { convertedFrom: { docType: 'SaleInvoice', docId: invoice._id } }
        });
        invoice.conversions.convertedTo.push({ docType: 'PackingList', docId: packingList._id });
        await invoice.save();

        res.status(201).json({ success: true, message: "Converted to Packing List", data: packingList });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update sale invoice
// @route   PUT /api/sale-invoice/:id
// @access  Private
const updateInvoice = async (req, res) => {
    try {
        if (!req.body) req.body = {};

        let bodyData = {};

        // 1️⃣ Extract data from req.body.data if it exists, otherwise use req.body
        if (req.body.data) {
            try {
                bodyData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } catch (error) {
                return res.status(400).json({ success: false, message: "Invalid JSON format in 'data' field" });
            }
        } else {
            bodyData = { ...req.body };
            // Parse individual nested fields if they are strings
            const nestedFields = [
                'customerInformation', 'invoiceDetails', 'items', 'additionalCharges',
                'totals', 'conversions', 'eWayBill', 'termsAndConditions', 'customFields', 'transportDetails'
            ];
            nestedFields.forEach(field => {
                if (bodyData[field] && typeof bodyData[field] === 'string') {
                    try {
                        bodyData[field] = JSON.parse(bodyData[field]);
                    } catch (error) {
                        throw new Error(`Invalid JSON format in field: ${field}`);
                    }
                }
            });
        }

        // 1.5️⃣ Normalize item field names (convert 'name' to 'productName' if needed)
        if (bodyData.items && Array.isArray(bodyData.items)) {
            bodyData.items = bodyData.items.map(item => {
                const normalizedItem = { ...item };

                // Normalize product name
                if (item.name && !item.productName) {
                    normalizedItem.productName = item.name;
                }

                // Normalize quantity (accept 'quantity' or 'qty', convert to 'qty')
                if (item.quantity && !item.qty) {
                    normalizedItem.qty = Number(item.quantity);
                } else if (item.qty) {
                    normalizedItem.qty = Number(item.qty);
                }

                // Normalize price (accept 'rate' or 'price', convert to 'price')
                if (item.rate && !item.price) {
                    normalizedItem.price = Number(item.rate);
                } else if (item.price) {
                    normalizedItem.price = Number(item.price);
                }

                // Normalize HSN/SAC
                if (item.hsnCode && !item.hsnSac) {
                    normalizedItem.hsnSac = item.hsnCode;
                }

                return normalizedItem;
            });
        }

        // 1.6️⃣ Normalize totals fields (convert to numbers and handle field variations)
        if (bodyData.totals && typeof bodyData.totals === 'object') {
            const totals = bodyData.totals;
            bodyData.totals = {
                ...totals,
                grandTotal: Number(totals.grandTotal || 0),
                totalTaxable: Number(totals.totalTaxable || totals.taxableAmount || 0),
                totalTax: Number(totals.totalTax || 0),
                totalCGST: Number(totals.totalCGST || totals.cgst || 0),
                totalSGST: Number(totals.totalSGST || totals.sgst || 0),
                totalIGST: Number(totals.totalIGST || totals.igst || 0),
                roundOff: Number(totals.roundOff || 0)
            };
        }

        // 1.7️⃣ Normalize paymentType to uppercase (schema requires uppercase enum)
        if (bodyData.paymentType && typeof bodyData.paymentType === 'string') {
            bodyData.paymentType = bodyData.paymentType.toUpperCase();
        }

        // 2️⃣ Handle attachments (if any new ones are uploaded)
        if (req.files && req.files.length > 0) {
            const newAttachments = req.files.map(file => ({
                fileName: file.filename,
                filePath: file.path,
                fileSize: file.size,
                mimeType: file.mimetype
            }));
            bodyData.attachments = newAttachments;
        }

        // 3️⃣ Validate
        const validationError = validateSaleInvoice(bodyData);
        if (validationError) return res.status(400).json({ success: false, message: validationError });

        // 4️⃣ Update invoice
        const invoice = await SaleInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { ...bodyData },
            { new: true, runValidators: true }
        );

        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        // 5️⃣ Record Activity
        await recordActivity(
            req,
            'Update',
            'Sale Invoice',
            `Sale Invoice updated for: ${invoice.customerInformation.ms}`,
            invoice.invoiceDetails.invoiceNumber
        );

        // 6️⃣ Re-generate PDF
        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Sale Invoice', bodyData.branch);
        const pdfBuffer = await generateSaleInvoicePDF(invoice, userData, options, 'Sale Invoice', printConfig);
        const pdfDir = 'src/uploads/invoices/pdf';
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }
        const pdfFileName = `invoice-${invoice._id}.pdf`;
        const pdfPath = path.join(pdfDir, pdfFileName);
        fs.writeFileSync(pdfPath, pdfBuffer);

        res.status(200).json({
            success: true,
            message: "Invoice updated successfully",
            data: invoice,
            pdfUrl: `/uploads/invoices/pdf/${pdfFileName}`
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Invoice number must be unique" });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Generate a secure public link for the invoice
 */
const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const invoices = await SaleInvoice.find({ _id: { $in: ids }, userId: req.user._id });
        if (!invoices || invoices.length === 0) return res.status(404).json({ success: false, message: "Invoice(s) not found" });

        const token = generatePublicToken(req.params.id);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/sale-invoice/view-public/${req.params.id}/${token}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Public View Invoice PDF (Unprotected)
 */
const viewInvoicePublic = async (req, res) => {
    try {
        const { id, token } = req.params;

        const expectedToken = generatePublicToken(id);

        if (token !== expectedToken) {
            return res.status(401).send("Invalid or expired link");
        }

        const ids = id.split(',');
        const invoices = await SaleInvoice.find({ _id: { $in: ids } });
        if (!invoices || invoices.length === 0) return res.status(404).send("Invoice(s) not found");

        const userData = await User.findById(invoices[0].userId);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(invoices[0].userId, 'Sale Invoice', invoices[0].branch);
        const pdfBuffer = await generateSaleInvoicePDF(invoices, userData || {}, options, 'Sale Invoice', printConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Invoice.pdf"');
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).send("Error rendering invoice");
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
    searchInvoices,
    duplicateInvoice,
    cancelInvoice,
    attachFileToInvoice,
    generateBarcodeForInvoice,
    generateEWayBill,
    downloadEWayBillJson,
    convertToDeliveryChallan,
    convertToProformaInvoice,
    convertToQuotation,
    convertToCreditNote,
    convertToDebitNote,
    convertToPurchaseInvoice,
    convertToPackingList,
    generatePublicLink,
    viewInvoicePublic,
    updateInvoice,
    createDynamicInvoice,
    resolveInvoiceItem,
    restoreInvoice
};
