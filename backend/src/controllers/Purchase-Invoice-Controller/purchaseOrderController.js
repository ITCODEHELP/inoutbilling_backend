const PurchaseOrder = require('../../models/Other-Document-Model/PurchaseOrder');
const PurchaseOrderCustomField = require('../../models/Other-Document-Model/PurchaseOrderCustomField');
const PurchaseOrderItemColumn = require('../../models/Other-Document-Model/PurchaseOrderItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const Quotation = require('../../models/Other-Document-Model/Quotation');
const PurchaseInvoice = require('../../models/Purchase-Invoice-Model/PurchaseInvoice');
const DeliveryChallan = require('../../models/Other-Document-Model/DeliveryChallan');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const User = require('../../models/User-Model/User');
const { generatePurchaseOrderLabelPDF } = require('../../utils/purchaseOrderLabelHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Helper to generate secure public token
const generatePublicToken = (id) => {
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    return crypto
        .createHmac('sha256', secret)
        .update(id.toString())
        .digest('hex')
        .substring(0, 16);
};

// Helper to build search query
const buildPurchaseOrderQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, vendorName,
        product, productName,
        productGroup,
        fromDate, toDate,
        staffName,
        poNo, poNumber,
        minAmount, maxAmount,
        lrNo, documentNo,
        itemNote,
        remarks, documentRemarks,
        gstin, gstinPan,
        purchaseOrderType,
        deliveryMode,
        shipTo, shippingAddress,
        advanceFilter, // { field, operator, value } or stringified
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return { userId };

    if (search) {
        query.$or = [
            { 'vendorInformation.ms': { $regex: search, $options: 'i' } },
            { 'purchaseOrderDetails.poNumber': { $regex: search, $options: 'i' } },
            { documentRemarks: { $regex: search, $options: 'i' } },
            { 'items.productName': { $regex: search, $options: 'i' } }
        ];
    }

    // Basic Filters
    if (company || vendorName) {
        query['vendorInformation.ms'] = { $regex: company || vendorName, $options: 'i' };
    }

    if (product || productName) {
        query['items.productName'] = { $regex: product || productName, $options: 'i' };
    }

    if (productGroup) {
        query['items.productGroup'] = { $regex: productGroup, $options: 'i' };
    }

    if (poNo || poNumber) {
        query['purchaseOrderDetails.poNumber'] = { $regex: poNo || poNumber, $options: 'i' };
    }

    if (purchaseOrderType) {
        query['purchaseOrderDetails.purchaseOrderType'] = purchaseOrderType;
    }

    if (deliveryMode) {
        query['purchaseOrderDetails.deliveryMode'] = deliveryMode;
    }

    if (fromDate || toDate) {
        query['purchaseOrderDetails.date'] = {};
        if (fromDate) query['purchaseOrderDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['purchaseOrderDetails.date'].$lte = end;
        }
    }

    if (minAmount || maxAmount) {
        query['totals.grandTotal'] = {};
        if (minAmount) query['totals.grandTotal'].$gte = Number(minAmount);
        if (maxAmount) query['totals.grandTotal'].$lte = Number(maxAmount);
    }

    if (lrNo || documentNo) {
        query['transportDetails.documentNo'] = { $regex: lrNo || documentNo, $options: 'i' };
    }

    if (itemNote) {
        query['items.itemNote'] = { $regex: itemNote, $options: 'i' };
    }

    if (remarks || documentRemarks) {
        query.documentRemarks = { $regex: remarks || documentRemarks, $options: 'i' };
    }

    if (gstin || gstinPan) {
        query['vendorInformation.gstinPan'] = { $regex: gstin || gstinPan, $options: 'i' };
    }

    if (shipTo || shippingAddress) {
        query['vendorInformation.shipTo'] = { $regex: shipTo || shippingAddress, $options: 'i' };
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
                'Contact No': 'vendorInformation.phone',
                'City': 'vendorInformation.address',
                'State': 'vendorInformation.placeOfSupply',
                'Vehicle No': 'transportDetails.vehicleNo',
                'Taxable Total': 'totals.totalTaxable',
                'Transport Name': 'transportDetails.transportName',
                'Document Note': 'items.itemNote',
                'Shipping Name': 'vendorInformation.shipTo',
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

    // Custom Fields filters
    for (const key in otherFilters) {
        if (key.startsWith('cf_')) {
            const fieldId = key.replace('cf_', '');
            query[`customFields.${fieldId}`] = otherFilters[key];
        }
    }

    return query;
};

// @desc    Create Purchase Order
// @route   POST /api/purchase-orders
const createPurchaseOrder = async (req, res) => {
    try {
        const {
            vendorInformation,
            purchaseOrderDetails,
            transportDetails,
            items,
            additionalCharges,
            totals,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields,
            staff,
            branch
        } = req.body;

        // Distance Calculation
        let finalShippingAddress = req.body.shippingAddress || {};
        if (req.body.useSameShippingAddress) {
            finalShippingAddress = {
                street: vendorInformation.address,
                city: vendorInformation.city || '',
                state: vendorInformation.state || '',
                country: vendorInformation.country || 'India',
                pincode: vendorInformation.pincode || ''
            };
        }

        const distance = await calculateShippingDistance(req.user._id, finalShippingAddress);
        finalShippingAddress.distance = distance;

        // Custom Fields Validation & Normalization
        let rawCustomFields = {};
        if (customFields) {
            rawCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
        }

        const parsedCustomFields = Object.keys(rawCustomFields).reduce((acc, key) => {
            const canonicalKey = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
            acc[canonicalKey] = rawCustomFields[key];
            return acc;
        }, {});

        const definitions = await PurchaseOrderCustomField.find({ userId: req.user._id, status: 'Active' });
        const validatedFields = new Set();
        for (const def of definitions) {
            const canonicalDefName = def.name.trim().toLowerCase().replace(/[\s-]+/g, '_');
            if (def.required && !validatedFields.has(canonicalDefName)) {
                const value = parsedCustomFields[canonicalDefName];
                if (value === undefined || value === null || value === '') {
                    return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
                }
                validatedFields.add(canonicalDefName);
            }
        }

        // --- Items Processing & Calculation ---
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const calculationResults = await calculateDocumentTotals(req.user._id, {
            vendorInformation,
            items: parsedItems,
            additionalCharges: req.body.additionalCharges
        }, req.body.branch);

        const newPurchaseOrder = new PurchaseOrder({
            userId: req.user._id,
            vendorInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            purchaseOrderDetails,
            transportDetails,
            items: calculationResults.items,
            totals: calculationResults.totals,
            additionalCharges: req.body.additionalCharges || [],
            staff,
            branch: req.body.branch,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields: parsedCustomFields
        });

        await newPurchaseOrder.save();

        // Update source document if converted (e.g., Quotation)
        if (req.body.conversions && req.body.conversions.convertedFrom) {
            const { docType, docId } = req.body.conversions.convertedFrom;
            if (docType === 'Quotation' && docId) {
                await Quotation.findByIdAndUpdate(docId, {
                    $push: {
                        'conversions.convertedTo': {
                            docType: 'Purchase Order',
                            docId: newPurchaseOrder._id,
                            docNo: newPurchaseOrder.purchaseOrderDetails.poNumber,
                            convertedAt: new Date()
                        }
                    }
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Purchase Order created successfully',
            data: newPurchaseOrder
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Purchase Order number must be unique' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Search Purchase Orders
// @route   GET /api/purchase-orders/search
const searchPurchaseOrders = async (req, res) => {
    try {
        const query = await buildPurchaseOrderQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const pos = await PurchaseOrder.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await PurchaseOrder.countDocuments(query);

        res.status(200).json({
            success: true,
            count: pos.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: pos
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get All Purchase Orders (Paginated)
// @route   GET /api/purchase-orders
const getPurchaseOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const query = { userId: req.user._id };

        const pos = await PurchaseOrder.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await PurchaseOrder.countDocuments(query);

        res.status(200).json({
            success: true,
            count: pos.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: pos
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Purchase Order Summary
// @route   GET /api/purchase-orders/summary
const getPurchaseOrderSummary = async (req, res) => {
    try {
        const query = await buildPurchaseOrderQuery(req.user._id, req.query);
        const data = await getSummaryAggregation(req.user._id, query, PurchaseOrder);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Purchase Order
// @route   GET /api/purchase-orders/:id
const getPurchaseOrderById = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });
        res.status(200).json({ success: true, data: po });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Purchase Order
// @route   PUT /api/purchase-orders/:id
const updatePurchaseOrder = async (req, res) => {
    try {
        // Distance Calculation
        if (req.body.shippingAddress || req.body.useSameShippingAddress || req.body.vendorInformation) {
            let currentPO = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
            let finalShippingAddress = req.body.shippingAddress || {};
            if (req.body.useSameShippingAddress) {
                const effectiveVendorInfo = req.body.vendorInformation || (currentPO ? currentPO.vendorInformation : null);
                if (effectiveVendorInfo) {
                    finalShippingAddress = {
                        street: effectiveVendorInfo.address || '',
                        city: effectiveVendorInfo.city || '',
                        state: effectiveVendorInfo.state || '',
                        country: effectiveVendorInfo.country || 'India',
                        pincode: effectiveVendorInfo.pincode || ''
                    };
                }
            }
            const distance = await calculateShippingDistance(req.user._id, finalShippingAddress);
            finalShippingAddress.distance = distance;
            req.body.shippingAddress = finalShippingAddress;
        }

        // --- Recalculate Totals ---
        if (req.body.items || req.body.vendorInformation || req.body.additionalCharges || req.body.branch) {
            const currentPO = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
            if (currentPO) {
                const calculationResults = await calculateDocumentTotals(req.user._id, {
                    vendorInformation: req.body.vendorInformation || currentPO.vendorInformation,
                    items: req.body.items || currentPO.items,
                    additionalCharges: req.body.additionalCharges || currentPO.additionalCharges
                }, req.body.branch || currentPO.branch);

                req.body.items = calculationResults.items;
                req.body.totals = calculationResults.totals;
            }
        }

        const purchaseOrder = await PurchaseOrder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: po });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Purchase Order
// @route   DELETE /api/purchase-orders/:id
const deletePurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });
        res.status(200).json({ success: true, message: 'Purchase Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Purchase Order Status
// @route   PATCH /api/purchase-orders/:id/status
const updatePurchaseOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

        const validStatuses = ['New', 'Pending', 'In-Work', 'Completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const po = await PurchaseOrder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status },
            { new: true, runValidators: true }
        );

        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        res.status(200).json({ success: true, data: { status: po.status } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Remaining Quantity for Purchase Order items
// @route   GET /api/purchase-orders/:id/remaining-quantity
// @desc    Print Purchase Order
// @route   GET /api/purchase-orders/:id/print
const printPurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        options.isPurchaseOrder = true;

        // Map PO to Challan template structure
        const mappedPO = po.toObject();
        mappedPO.deliveryChallanDetails = {
            challanNumber: po.purchaseOrderDetails.poNumber,
            date: po.purchaseOrderDetails.date
        };
        mappedPO.customerInformation = po.vendorInformation;

        const pdfBuffer = await generateSaleInvoicePDF(mappedPO, userData, options, 'Delivery Challan');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=purchase-order-${po.purchaseOrderDetails.poNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Download Purchase Order PDF (Supports merged)
// @route   GET /api/purchase-orders/:id/download-pdf
const downloadPurchaseOrderPDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const pos = await PurchaseOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (!pos || pos.length === 0) return res.status(404).json({ success: false, message: "Purchase Order(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        options.isPurchaseOrder = true;

        // Map POs to Challan template structure
        const mappedPOs = pos.map(po => {
            const mapped = po.toObject();
            mapped.deliveryChallanDetails = {
                challanNumber: po.purchaseOrderDetails.poNumber,
                date: po.purchaseOrderDetails.date
            };
            mapped.customerInformation = po.vendorInformation;
            return mapped;
        });

        const pdfBuffer = await generateSaleInvoicePDF(mappedPOs, userData, options, 'Delivery Challan');

        const filename = pos.length === 1 ? `PurchaseOrder_${pos[0].purchaseOrderDetails.poNumber}.pdf` : `Merged_PurchaseOrders.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Purchase Order via Email
// @route   POST /api/purchase-orders/:id/share-email
const sharePurchaseOrderEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
        if (ids.length === 0) return res.status(400).json({ success: false, message: "Invalid ID(s) provided" });

        const pos = await PurchaseOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (pos.length !== ids.length) return res.status(404).json({ success: false, message: "Some Purchase Order(s) not found" });

        const firstDoc = pos[0];
        const vendor = await Vendor.findOne({ userId: req.user._id, companyName: firstDoc.vendorInformation.ms });
        const email = req.body.email || vendor?.email;

        if (!email) return res.status(400).json({ success: false, message: "Vendor email not found. Please provide an email address." });

        const options = getCopyOptions(req);

        // Map POs to Challan template structure for email attachment
        const mappedPOs = pos.map(po => {
            const mapped = po.toObject();
            mapped.deliveryChallanDetails = {
                challanNumber: po.purchaseOrderDetails.poNumber,
                date: po.purchaseOrderDetails.date
            };
            mapped.customerInformation = po.vendorInformation;
            return mapped;
        });

        // Use sendInvoiceEmail with 'Delivery Challan' type
        await sendInvoiceEmail(mappedPOs, email, false, options, 'Delivery Challan');
        res.status(200).json({ success: true, message: `Purchase Order(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Purchase Order via WhatsApp
// @route   POST /api/purchase-orders/:id/share-whatsapp
const sharePurchaseOrderWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const pos = await PurchaseOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (!pos || pos.length === 0) return res.status(404).json({ success: false, message: "Purchase Order(s) not found" });

        const firstDoc = pos[0];
        const vendor = await Vendor.findOne({ userId: req.user._id, companyName: firstDoc.vendorInformation.ms });
        const phone = req.body.phone || vendor?.phone;

        if (!phone) return res.status(400).json({ success: false, message: "Vendor phone not found. Please provide a phone number." });

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
        const publicLink = `${req.protocol}://${req.get('host')}/api/purchase-orders/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (pos.length === 1) {
            message = `Dear ${firstDoc.vendorInformation.ms},\n\nPlease find your Purchase Order No: ${firstDoc.purchaseOrderDetails.poNumber} for Total Amount: ${firstDoc.totals.grandTotal.toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Dear ${firstDoc.vendorInformation.ms},\n\nPlease find your merged Purchase Orders for Total Amount: ${pos.reduce((sum, q) => sum + q.totals.grandTotal, 0).toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
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

// @desc    Generate Public Link
// @route   GET /api/purchase-orders/:id/public-link
const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const pos = await PurchaseOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (!pos || pos.length === 0) return res.status(404).json({ success: false, message: "Purchase Order(s) not found" });

        const token = generatePublicToken(req.params.id);
        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/purchase-orders/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    View Purchase Order Publicly
// @route   GET /api/purchase-orders/view-public/:id/:token
const viewPurchaseOrderPublic = async (req, res) => {
    try {
        const { id, token } = req.params;
        const generatedToken = generatePublicToken(id);

        if (token !== generatedToken) {
            return res.status(403).send('Invalid or expired link');
        }

        const ids = id.split(',');
        const pos = await PurchaseOrder.find({ _id: { $in: ids } });
        if (!pos || pos.length === 0) return res.status(404).send('Purchase Order not found');

        const userData = await User.findById(pos[0].userId);
        const options = getCopyOptions(req);
        options.isPurchaseOrder = true;

        // Map POs to Challan template structure
        const mappedPOs = pos.map(po => {
            const mapped = po.toObject();
            mapped.deliveryChallanDetails = {
                challanNumber: po.purchaseOrderDetails.poNumber,
                date: po.purchaseOrderDetails.date
            };
            mapped.customerInformation = po.vendorInformation;
            return mapped;
        });

        const pdfBuffer = await generateSaleInvoicePDF(mappedPOs, userData, options, 'Delivery Challan');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=purchase-order.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const getPurchaseOrderRemainingQty = async (req, res) => {
    try {
        const poId = req.params.id;
        const userId = req.user._id;

        const po = await PurchaseOrder.findOne({ _id: poId, userId });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        // Find all linked documents that consumed quantity
        // Supporting Purchase Invoice and Delivery Challan as requested
        const piDocs = await PurchaseInvoice.find({
            userId,
            'conversions.convertedFrom.docId': poId,
            'status': 'Active'
        });

        const dcDocs = await DeliveryChallan.find({
            userId,
            'conversions.convertedFrom.docId': poId,
            'status': 'COMPLETED'
        });

        // Map to aggregate consumed quantity by productName
        const consumedQtyMap = {};
        const processItems = (items) => {
            if (!Array.isArray(items)) return;
            items.forEach(item => {
                const name = item.productName;
                const qty = Number(item.qty || 0);
                if (name) {
                    consumedQtyMap[name] = (consumedQtyMap[name] || 0) + qty;
                }
            });
        };

        piDocs.forEach(doc => processItems(doc.items));
        dcDocs.forEach(doc => processItems(doc.items));

        const resultData = [];
        let totalItemsRemainingCount = 0;

        po.items.forEach(poItem => {
            const totalQty = Number(poItem.qty || 0);
            const usedQty = consumedQtyMap[poItem.productName] || 0;
            const remainingQty = Math.max(0, totalQty - usedQty);

            // Per requirement: If remaining is zero, return empty/null dataset (exclude from list)
            if (remainingQty > 0) {
                resultData.push({
                    productName: poItem.productName,
                    usedQty,
                    totalQty,
                    remainingQty,
                    displayFormat: `${usedQty}/${totalQty}`
                });
                totalItemsRemainingCount++;
            }
        });

        // Per requirement: If total remaining quantity is zero, return empty or null dataset
        if (resultData.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: null
            });
        }

        res.status(200).json({
            success: true,
            count: totalItemsRemainingCount,
            data: resultData
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Generate Label/Envelope PDF for Purchase Order
// @route   GET /api/purchase-orders/:id/label
const generatePOLabel = async (req, res) => {
    try {
        const { type = 'SHIPPING', size = 'Medium' } = req.query; // type: SHIPPING | ENVELOPE, size: Small | Medium | Large

        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        const fullUser = await User.findById(req.user._id);

        const pdfBuffer = await generatePurchaseOrderLabelPDF(po, fullUser, type.toUpperCase(), size);

        const filename = `${type}_${po.purchaseOrderDetails.poNumber}.pdf`;

        // Inline disposition allows both print (browser-based printing) and view (preview)
        if (req.query.action === 'download') {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Purchase Invoice (Prefill Data)
// @route   GET /api/purchase-orders/:id/convert-to-purchase-invoice
const convertPOToPurchaseInvoiceData = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        const data = po.toObject();
        const mappedData = {
            vendorInformation: data.vendorInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items.map(item => ({
                productName: item.productName,
                productGroup: item.productGroup,
                itemNote: item.itemNote,
                hsnSac: item.hsnSac,
                qty: item.qty,
                uom: item.uom,
                price: item.price,
                discountValue: item.discount, // Purchase Order has 'discount' (percentage usually)
                discountType: 'Percentage',
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: item.price * item.qty,
                total: item.total
            })),
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Purchase Order', docId: po._id }
            }
        };
        res.status(200).json({ success: true, message: 'Purchase Order data for Purchase Invoice conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Delivery Challan (Prefill Data)
// @route   GET /api/purchase-orders/:id/convert-to-challan
const convertPOToChallanData = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        const data = po.toObject();
        const mappedData = {
            customerInformation: data.vendorInformation, // Map Vendor to Customer for Challan
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items,
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Purchase Order', docId: po._id }
            }
        };
        res.status(200).json({ success: true, message: 'Purchase Order data for Delivery Challan conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Get data for duplicating a Purchase Order (Prefill Add Form)
// @route   GET /api/purchase-orders/:id/duplicate
const getDuplicatePOData = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        const data = po.toObject();

        // System fields to exclude
        delete data._id;
        delete data.status;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;

        // Reset document number (will be generated anew)
        if (data.purchaseOrderDetails) {
            delete data.purchaseOrderDetails.poNumber;
        }

        // Linked references to exclude
        delete data.staff;
        delete data.branch;

        // Reset sub-document IDs for items and charges
        if (Array.isArray(data.items)) {
            data.items = data.items.map(item => {
                delete item._id;
                return item;
            });
        }
        if (Array.isArray(data.additionalCharges)) {
            data.additionalCharges = data.additionalCharges.map(charge => {
                delete charge._id;
                return charge;
            });
        }

        res.status(200).json({
            success: true,
            message: 'Purchase Order data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cancel Purchase Order
// @route   POST /api/purchase-orders/:id/cancel
const cancelPurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        if (po.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Purchase Order is already cancelled' });
        }

        po.status = 'Cancelled';
        await po.save();

        await recordActivity(
            req,
            'Cancel',
            'Purchase Order',
            `Purchase Order cancelled: ${po.purchaseOrderDetails.poNumber}`,
            po.purchaseOrderDetails.poNumber
        );

        res.status(200).json({ success: true, message: "Purchase Order cancelled successfully", data: po });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Restore Purchase Order
// @route   POST /api/purchase-orders/:id/restore
const restorePurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found' });

        if (po.status !== 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Purchase Order is not in Cancelled state' });
        }

        po.status = 'New';
        await po.save();

        await recordActivity(
            req,
            'Restore',
            'Purchase Order',
            `Purchase Order restored: ${po.purchaseOrderDetails.poNumber}`,
            po.purchaseOrderDetails.poNumber
        );

        res.status(200).json({ success: true, message: "Purchase Order restored successfully", data: po });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Attachment Handlers ---

// @desc    Attach files to Purchase Order
// @route   POST /api/purchase-orders/:id/attach-file
const attachPurchaseOrderFile = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files uploaded" });

        const newAttachments = req.files.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        }));

        const po = await PurchaseOrder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!po) return res.status(404).json({ success: false, message: "Purchase Order not found" });

        await recordActivity(
            req,
            'Attachment',
            'Purchase Order',
            `Files attached to Purchase Order: ${po.purchaseOrderDetails.poNumber}`,
            po.purchaseOrderDetails.poNumber
        );

        res.status(200).json({ success: true, message: "Files attached successfully", data: po.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Purchase Order Attachments
// @route   GET /api/purchase-orders/:id/attachments
const getPurchaseOrderAttachments = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: "Purchase Order not found" });
        res.status(200).json({ success: true, data: po.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update (Replace) Purchase Order Attachment
// @route   PUT /api/purchase-orders/:id/attachment/:attachmentId
const updatePurchaseOrderAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }

        const attachmentIndex = po.attachments.findIndex(a => a._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Remove old file
        const oldFile = po.attachments[attachmentIndex].filePath;
        if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile); } catch (e) { console.error("Error deleting old file:", e); }
        }

        // Update metadata
        po.attachments[attachmentIndex] = {
            _id: po.attachments[attachmentIndex]._id, // Keep ID
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        await po.save();

        await recordActivity(
            req,
            'Update Attachment',
            'Purchase Order',
            `Attachment replaced for Purchase Order: ${po.purchaseOrderDetails.poNumber}`,
            po.purchaseOrderDetails.poNumber
        );

        res.status(200).json({ success: true, message: "Attachment replaced successfully", data: po.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Purchase Order Attachment
// @route   DELETE /api/purchase-orders/:id/attachment/:attachmentId
const deletePurchaseOrderAttachment = async (req, res) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!po) return res.status(404).json({ success: false, message: "Purchase Order not found" });

        const attachment = po.attachments.find(a => a._id.toString() === req.params.attachmentId);
        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        // Remove from disk
        if (fs.existsSync(attachment.filePath)) {
            try { fs.unlinkSync(attachment.filePath); } catch (e) { console.error("Error deleting file:", e); }
        }

        // Remove from array
        po.attachments = po.attachments.filter(a => a._id.toString() !== req.params.attachmentId);
        await po.save();

        await recordActivity(
            req,
            'Delete Attachment',
            'Purchase Order',
            `Attachment deleted from Purchase Order: ${po.purchaseOrderDetails.poNumber}`,
            po.purchaseOrderDetails.poNumber
        );

        res.status(200).json({ success: true, message: "Attachment deleted successfully", data: po.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Custom Field Handlers ---
const getCustomFields = async (req, res) => {
    try {
        const fields = await PurchaseOrderCustomField.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: fields });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createCustomField = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const canonicalName = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
        const existingField = await PurchaseOrderCustomField.findOne({ userId: req.user._id, name: canonicalName });
        if (existingField) {
            return res.status(400).json({ success: false, message: `Custom field with name '${canonicalName}' already exists` });
        }
        const field = await PurchaseOrderCustomField.create({ ...req.body, name: canonicalName, userId: req.user._id });
        res.status(201).json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCustomField = async (req, res) => {
    try {
        const { name } = req.body;
        let updateData = { ...req.body };
        if (name) {
            const canonicalName = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
            const existingField = await PurchaseOrderCustomField.findOne({
                userId: req.user._id,
                name: canonicalName,
                _id: { $ne: req.params.id }
            });
            if (existingField) {
                return res.status(400).json({ success: false, message: `Custom field with name '${canonicalName}' already exists` });
            }
            updateData.name = canonicalName;
        }
        const field = await PurchaseOrderCustomField.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updateData,
            { new: true }
        );
        res.status(200).json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteCustomField = async (req, res) => {
    try {
        await PurchaseOrderCustomField.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Item Column Handlers ---
const getItemColumns = async (req, res) => {
    try {
        const columns = await PurchaseOrderItemColumn.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createItemColumn = async (req, res) => {
    try {
        const column = await PurchaseOrderItemColumn.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateItemColumn = async (req, res) => {
    try {
        const column = await PurchaseOrderItemColumn.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        );
        res.status(200).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteItemColumn = async (req, res) => {
    try {
        await PurchaseOrderItemColumn.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderSummary,
    getPurchaseOrderById,
    updatePurchaseOrder,
    deletePurchaseOrder,
    searchPurchaseOrders,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    updatePurchaseOrderStatus,
    getPurchaseOrderRemainingQty,
    generatePOLabel,
    convertPOToPurchaseInvoiceData,
    convertPOToChallanData,
    getDuplicatePOData,
    cancelPurchaseOrder,
    restorePurchaseOrder,
    attachPurchaseOrderFile,
    getPurchaseOrderAttachments,
    updatePurchaseOrderAttachment,
    deletePurchaseOrderAttachment,
    printPurchaseOrder,
    downloadPurchaseOrderPDF,
    sharePurchaseOrderEmail,
    sharePurchaseOrderWhatsApp,
    generatePublicLink,
    viewPurchaseOrderPublic
};
