const DeliveryChallan = require('../../models/Other-Document-Model/DeliveryChallan');
const Quotation = require('../../models/Other-Document-Model/Quotation');
const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const DeliveryChallanCustomField = require('../../models/Other-Document-Model/DeliveryChallanCustomField');
const DeliveryChallanItemColumn = require('../../models/Other-Document-Model/DeliveryChallanItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const mongoose = require('mongoose');
const { generateDeliveryChallanPDF } = require('../../utils/pdfHelper');
const { sendDeliveryChallanEmail } = require('../../utils/emailHelper');
const { calculateDocumentTotals, getSummaryAggregation, getSelectedPrintTemplate } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const { generateLabelPDF } = require('../../utils/deliveryChallanLabelHelper');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const User = require('../../models/User-Model/User');
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

// Helper to build search query (mirrors Quotation search logic)
const buildDeliveryChallanQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, customerName,
        product, productName,
        productGroup,
        fromDate, toDate,
        staffName,
        deliveryChallanNo, challanNumber,
        minAmount, maxAmount,
        lrNo, documentNo,
        itemNote,
        remarks, documentRemarks,
        gstin, gstinPan,
        deliveryChallanType,
        eWayBill,
        supplyType,
        shipTo, shippingAddress,
        advanceFilter, // { field, operator, value } or stringified
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return { userId };

    if (search) {
        query.$or = [
            { 'customerInformation.ms': { $regex: search, $options: 'i' } },
            { 'deliveryChallanDetails.challanNumber': { $regex: search, $options: 'i' } },
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

    if (deliveryChallanNo || challanNumber) {
        query['deliveryChallanDetails.challanNumber'] = { $regex: deliveryChallanNo || challanNumber, $options: 'i' };
    }

    if (deliveryChallanType) {
        query['deliveryChallanDetails.deliveryChallanType'] = deliveryChallanType;
    }

    if (eWayBill) {
        query['deliveryChallanDetails.eWayBill'] = eWayBill;
    }

    if (supplyType) {
        query['deliveryChallanDetails.supplyType'] = supplyType;
    }

    if (fromDate || toDate) {
        query['deliveryChallanDetails.date'] = {};
        if (fromDate) query['deliveryChallanDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['deliveryChallanDetails.date'].$lte = end;
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
                'Vehicle No': 'transportDetails.vehicleNo',
                'Taxable Total': 'totals.totalTaxable',
                'Transport Name': 'transportDetails.transportName',
                'Document Note': 'items.itemNote',
                'Shipping Name': 'customerInformation.shipTo',
                'Shipping State': 'customerInformation.shipTo',
                'Shipping City': 'customerInformation.shipTo'
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
            query[`customFields.${fieldId} `] = otherFilters[key];
        }
    }

    return query;
};

// @desc    Create Delivery Challan
// @route   POST /api/delivery-challans
const createDeliveryChallan = async (req, res) => {
    try {
        const {
            customerInformation,
            deliveryChallanDetails,
            transportDetails,
            items,
            additionalCharges,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields,
            staff,
            print,
            shareOnEmail
        } = req.body;

        // Distance Calculation
        let finalShippingAddress = req.body.shippingAddress || {};
        if (req.body.useSameShippingAddress) {
            finalShippingAddress = {
                street: customerInformation.address,
                city: customerInformation.city || '',
                state: customerInformation.state || '',
                country: customerInformation.country || 'India',
                pincode: customerInformation.pincode || ''
            };
        }

        const distance = await calculateShippingDistance(req.user._id, finalShippingAddress);
        finalShippingAddress.distance = distance;

        // Custom Fields Validation & Normalization
        let rawCustomFields = {};
        if (customFields) {
            rawCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
        }

        // Canonical format: lowercase with underscores
        const normalizedCustomFields = Object.keys(rawCustomFields).reduce((acc, key) => {
            const canonicalKey = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
            acc[canonicalKey] = rawCustomFields[key];
            return acc;
        }, {});

        const definitions = await DeliveryChallanCustomField.find({ userId: req.user._id, status: 'Active' });

        // Use a set to track validated canonical names to avoid duplicate errors for the same logical field
        const validatedFields = new Set();

        for (const def of definitions) {
            const canonicalDefName = def.name.trim().toLowerCase().replace(/[\s-]+/g, '_');

            if (def.required && !validatedFields.has(canonicalDefName)) {
                const value = normalizedCustomFields[canonicalDefName];
                if (value === undefined || value === null || value === '') {
                    return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
                }
                validatedFields.add(canonicalDefName);
            }
        }

        // Compatibility for challanType -> deliveryChallanType
        if (deliveryChallanDetails && deliveryChallanDetails.challanType && !deliveryChallanDetails.deliveryChallanType) {
            deliveryChallanDetails.deliveryChallanType = deliveryChallanDetails.challanType;
        }

        // --- Items Processing & Calculation ---
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges: req.body.additionalCharges
        }, req.body.branch);

        const newChallan = new DeliveryChallan({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            deliveryChallanDetails,
            transportDetails,
            items: calculationResults.items,
            additionalCharges: req.body.additionalCharges || [],
            totals: calculationResults.totals,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            staff,
            branch: req.body.branch,
            customFields: normalizedCustomFields
        });

        await newChallan.save();

        // Update source document if converted (e.g., Quotation)
        if (req.body.conversions && req.body.conversions.convertedFrom) {
            const { docType, docId } = req.body.conversions.convertedFrom;
            if (docType === 'Quotation' && docId) {
                await Quotation.findByIdAndUpdate(docId, {
                    $push: {
                        'conversions.convertedTo': {
                            docType: 'Delivery Challan',
                            docId: newChallan._id,
                            docNo: newChallan.deliveryChallanDetails.challanNumber,
                            convertedAt: new Date()
                        }
                    }
                });
            }
        }

        if (shareOnEmail) {
            const customer = await Customer.findOne({ userId: req.user._id, companyName: customerInformation.ms });
            if (customer && customer.email) {
                sendDeliveryChallanEmail(newChallan, customer.email);
            }
        }

        if (print) {
            const userData = await User.findById(req.user._id);
            const options = getCopyOptions(req);
            const templateName = await getSelectedPrintTemplate(req.user._id, 'Delivery Challan');
            const pdfBuffer = await generateSaleInvoicePDF(newChallan, userData, options, 'Delivery Challan', templateName);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=challan-${newChallan.deliveryChallanDetails.challanNumber}.pdf`);
            return res.send(pdfBuffer);
        }

        res.status(201).json({
            success: true,
            message: 'Delivery Challan created successfully',
            data: newChallan
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Challan number must be unique' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Search Delivery Challans (Dedicated API)
// @route   GET /api/delivery-challans/search
const searchDeliveryChallans = async (req, res) => {
    try {
        const query = await buildDeliveryChallanQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const challans = await DeliveryChallan.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await DeliveryChallan.countDocuments(query);

        res.status(200).json({
            success: true,
            count: challans.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: challans
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get All Delivery Challans (Paginated, no search/filters as requested)
// @route   GET /api/delivery-challans
const getDeliveryChallans = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const query = { userId: req.user._id };

        const challans = await DeliveryChallan.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit));

        const total = await DeliveryChallan.countDocuments(query);

        res.status(200).json({
            success: true,
            count: challans.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: challans
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Delivery Challan Summary
// @route   GET /api/delivery-challans/summary
const getDeliveryChallanSummary = async (req, res) => {
    try {
        const query = await buildDeliveryChallanQuery(req.user._id, req.query);
        const data = await getSummaryAggregation(req.user._id, query, DeliveryChallan);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Delivery Challan
// @route   GET /api/delivery-challans/:id
const getDeliveryChallanById = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });
        res.status(200).json({ success: true, data: challan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Delivery Challan
// @route   PUT /api/delivery-challans/:id
const updateDeliveryChallan = async (req, res) => {
    try {
        // Distance Calculation
        if (req.body.shippingAddress || req.body.useSameShippingAddress || req.body.customerInformation) {
            let currentDC = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
            let finalShippingAddress = req.body.shippingAddress || {};
            if (req.body.useSameShippingAddress) {
                const effectiveCustomerInfo = req.body.customerInformation || (currentDC ? currentDC.customerInformation : null);
                if (effectiveCustomerInfo) {
                    finalShippingAddress = {
                        street: effectiveCustomerInfo.address || '',
                        city: effectiveCustomerInfo.city || '',
                        state: effectiveCustomerInfo.state || '',
                        country: effectiveCustomerInfo.country || 'India',
                        pincode: effectiveCustomerInfo.pincode || ''
                    };
                }
            }
            const distance = await calculateShippingDistance(req.user._id, finalShippingAddress);
            finalShippingAddress.distance = distance;
            req.body.shippingAddress = finalShippingAddress;
        }

        // --- Recalculate Totals ---
        if (req.body.items || req.body.customerInformation || req.body.additionalCharges || req.body.branch) {
            const currentDC = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
            if (currentDC) {
                const calculationResults = await calculateDocumentTotals(req.user._id, {
                    customerInformation: req.body.customerInformation || currentDC.customerInformation,
                    items: req.body.items || currentDC.items,
                    additionalCharges: req.body.additionalCharges || currentDC.additionalCharges
                }, req.body.branch || currentDC.branch);

                req.body.items = calculationResults.items;
                req.body.totals = calculationResults.totals;
            }
        }

        // Custom Fields Validation & Normalization
        if (req.body.customFields) {
            let rawCustomFields = typeof req.body.customFields === 'string' ? JSON.parse(req.body.customFields) : req.body.customFields;
            const normalizedCustomFields = Object.keys(rawCustomFields).reduce((acc, key) => {
                const canonicalKey = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
                acc[canonicalKey] = rawCustomFields[key];
                return acc;
            }, {});
            req.body.customFields = normalizedCustomFields;

            const definitions = await DeliveryChallanCustomField.find({ userId: req.user._id, status: 'Active' });
            const validatedFields = new Set();
            for (const def of definitions) {
                const canonicalDefName = def.name.trim().toLowerCase().replace(/[\s-]+/g, '_');
                if (def.required && !validatedFields.has(canonicalDefName)) {
                    const value = normalizedCustomFields[canonicalDefName];
                    if (value === undefined || value === null || value === '') {
                        return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
                    }
                    validatedFields.add(canonicalDefName);
                }
            }
        }

        // Compatibility for challanType -> deliveryChallanType
        if (req.body.deliveryChallanDetails && req.body.deliveryChallanDetails.challanType && !req.body.deliveryChallanDetails.deliveryChallanType) {
            req.body.deliveryChallanDetails.deliveryChallanType = req.body.deliveryChallanDetails.challanType;
        }

        const challan = await DeliveryChallan.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });
        res.status(200).json({ success: true, data: challan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Delivery Challan
// @route   DELETE /api/delivery-challans/:id
const deleteDeliveryChallan = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });
        res.status(200).json({ success: true, message: 'Delivery Challan deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Print Delivery Challan
// @route   GET /api/delivery-challans/:id/print
const printDeliveryChallan = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Delivery Challan', challan.branch);
        const pdfBuffer = await generateSaleInvoicePDF(challan, userData, options, 'Delivery Challan', printConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=challan-${challan.deliveryChallanDetails.challanNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Download Delivery Challan(s) PDF (merged if multiple)
// @route   GET /api/delivery-challans/download/:id
const downloadDeliveryChallansPDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const challans = await DeliveryChallan.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!challans || challans.length === 0) return res.status(404).json({ success: false, message: "Delivery Challan(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Delivery Challan', challans[0].branch);
        const pdfBuffer = await generateSaleInvoicePDF(challans, userData, options, 'Delivery Challan', printConfig);

        const filename = challans.length === 1 ? `Challan_${challans[0].deliveryChallanDetails.challanNumber}.pdf` : `Merged_Challans.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Delivery Challan(s) via Email
// @route   POST /api/delivery-challans/share-email/:id
const shareDeliveryChallanEmail = async (req, res) => {
    try {
        const { sendInvoiceEmail } = require('../../utils/emailHelper');
        const ids = req.params.id.split(',');
        const challans = await DeliveryChallan.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!challans || challans.length === 0) return res.status(404).json({ success: false, message: "Delivery Challan(s) not found" });

        const firstDoc = challans[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || (customer ? customer.email : null);

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const options = getCopyOptions(req);
        // sendInvoiceEmail is generic enough to handle docList and docType
        await sendInvoiceEmail(challans, email, false, options, 'Delivery Challan');

        res.status(200).json({ success: true, message: `Delivery Challan(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Delivery Challan(s) via WhatsApp
// @route   POST /api/delivery-challans/share-whatsapp/:id
const shareDeliveryChallanWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const challans = await DeliveryChallan.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!challans || challans.length === 0) return res.status(404).json({ success: false, message: "Delivery Challan(s) not found" });

        const firstDoc = challans[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const phone = req.body.phone || (customer ? customer.phone : null);

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

        // Public link for previewing
        const publicLink = `${req.protocol}://${req.get('host')}/api/delivery-challans/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (challans.length === 1) {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your Delivery Challan No: ${firstDoc.deliveryChallanDetails.challanNumber}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your merged Delivery Challans.\n\nView Link: ${publicLink}\n\nThank you!`;
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

// --- Custom Field Handlers ---
const getCustomFields = async (req, res) => {
    try {
        const fields = await DeliveryChallanCustomField.find({ userId: req.user._id }).sort({ orderNo: 1 });
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

        const existingField = await DeliveryChallanCustomField.findOne({ userId: req.user._id, name: canonicalName });
        if (existingField) {
            return res.status(400).json({ success: false, message: `Custom field with name '${canonicalName}' already exists` });
        }

        const field = await DeliveryChallanCustomField.create({ ...req.body, name: canonicalName, userId: req.user._id });
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
            const existingField = await DeliveryChallanCustomField.findOne({
                userId: req.user._id,
                name: canonicalName,
                _id: { $ne: req.params.id }
            });
            if (existingField) {
                return res.status(400).json({ success: false, message: `Custom field with name '${canonicalName}' already exists` });
            }
            updateData.name = canonicalName;
        }

        const field = await DeliveryChallanCustomField.findOneAndUpdate(
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
        await DeliveryChallanCustomField.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get data for duplicating a Delivery Challan (Prefill Add Form)
// @route   GET /api/delivery-challans/:id/duplicate
const getDuplicateChallanData = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        const data = challan.toObject();

        // System fields to exclude
        delete data._id;
        delete data.status;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;
        delete data.attachments;
        delete data.cancelledAt;
        delete data.cancelledBy;

        // Reset document number
        if (data.deliveryChallanDetails) {
            delete data.deliveryChallanDetails.challanNumber;
        }

        // Linked references to exclude
        delete data.staff;

        // Reset sub-document IDs
        if (Array.isArray(data.items)) {
            data.items = data.items.map(item => {
                delete item._id;
                return item;
            });
        }

        res.status(200).json({
            success: true,
            message: 'Delivery Challan data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Item Column Handlers ---
const getItemColumns = async (req, res) => {
    try {
        const columns = await DeliveryChallanItemColumn.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createItemColumn = async (req, res) => {
    try {
        const column = await DeliveryChallanItemColumn.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateItemColumn = async (req, res) => {
    try {
        const column = await DeliveryChallanItemColumn.findOneAndUpdate(
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
        await DeliveryChallanItemColumn.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Delivery Challan Note
// @route   PATCH /api/delivery-challans/:id/note
const updateDeliveryChallanNote = async (req, res) => {
    try {
        const { note } = req.body || {};

        if (typeof note !== 'string') {
            return res.status(400).json({ success: false, message: 'Note must be a string' });
        }

        const challan = await DeliveryChallan.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { note },
            { new: true }
        );

        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        res.status(200).json({ success: true, data: challan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Generate Label/Envelope PDF
// @route   GET /api/delivery-challans/:id/label
const generateLabel = async (req, res) => {
    try {
        const { type = 'SHIPPING', size = 'Medium' } = req.query; // type: SHIPPING | ENVELOPE, size: Small | Medium | Large

        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        const fullUser = await require('../../models/User-Model/User').findById(req.user._id);

        const pdfBuffer = await generateLabelPDF(challan, fullUser, type.toUpperCase(), size);

        const filename = `${type}_${challan.deliveryChallanDetails.challanNumber}.pdf`;

        // Inline disposition allows both print (preview) and download (save as)
        // If specific download action is requested, force attachment
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


// @desc    Convert Delivery Challan to Sale Invoice
// @route   POST /api/delivery-challans/:id/convert-to-sale-invoice
const convertToSaleInvoice = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) {
            return res.status(404).json({ success: false, message: 'Delivery Challan not found' });
        }

        // Generate next invoice number (placeholder logic, usually handled by a helper or manual input)
        // Since we are creating it directly, we might need to fetch the next number or let the frontend handling creating it via 'convertToSaleInvoiceData' logic instead?
        // Wait, the prompt says: "create a Sale Invoice... return the created Sale Invoice ID so the frontend can redirect... with all data pre-filled".
        // Usually, "pre-filled" implies getting data, but "create a Sale Invoice" implies making the record.
        // Prompt says: "backend creates a Sale Invoice... return the created Sale Invoice ID".
        // This means I must actually SAVE the new invoice.

        // I need to generate a new unique invoice number. 
        // Typically handled by `invoicePrefix` + increment.
        // I'll search for the latest invoice to get the number.
        const lastInvoice = await SaleInvoice.findOne({ userId: req.user._id }).sort({ 'invoiceDetails.date': -1, createdAt: -1 });
        let nextInvoiceNumber = '1';
        if (lastInvoice && lastInvoice.invoiceDetails && lastInvoice.invoiceDetails.invoiceNumber) {
            // simple auto-increment if numeric
            const lastNum = parseInt(lastInvoice.invoiceDetails.invoiceNumber.replace(/\D/g, ''));
            if (!isNaN(lastNum)) {
                nextInvoiceNumber = (lastNum + 1).toString();
            }
        }

        const newInvoiceData = {
            userId: req.user._id,
            customerInformation: challan.customerInformation,
            invoiceDetails: {
                invoiceType: 'Regular', // Default
                invoicePrefix: '',
                invoiceNumber: nextInvoiceNumber,
                invoicePostfix: '',
                date: new Date(),
                deliveryMode: challan.deliveryChallanDetails.deliveryMode || '',
                bankSelection: challan.bankDetails || '',
                hideBankDetails: false
            },
            items: challan.items.map(item => ({
                productName: item.productName,
                productGroup: item.productGroup,
                itemNote: item.itemNote,
                hsnSac: item.hsnSac,
                qty: item.qty,
                uom: item.uom,
                price: item.price,
                discountValue: item.discount,
                discountType: 'Percentage',
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: item.price * item.qty, // Approximate
                total: item.total
            })),
            additionalCharges: challan.additionalCharges.map(charge => ({
                chargeName: charge.name,
                chargeAmount: charge.amount,
                taxRate: charge.tax
            })),
            totals: challan.totals,
            paymentType: 'CASH', // Default, requires input usually
            staff: challan.staff,
            branch: challan.branch,
            bankDetails: challan.bankDetails,
            termsTitle: challan.termsTitle,
            termsDetails: challan.termsDetails,
            documentRemarks: challan.documentRemarks,
            customFields: challan.customFields,
            conversions: {
                convertedFrom: {
                    docType: 'Delivery Challan',
                    docId: challan._id
                }
            },
            deliveryChallanId: challan._id,
            termAndConditions: { // Schema mismatch potential, checking SaleInvoice schema... it uses termsAndConditions object or termsDetails string?
                // SaleInvoice.js has `termsAndConditions` object AND `termsTitle`/`termsDetails`.
                // We'll map to `termsTitle`/`termsDetails` as per challan.
            }
        };

        const newInvoice = new SaleInvoice(newInvoiceData);
        await newInvoice.save();

        // Update Challan with conversion info
        await DeliveryChallan.findByIdAndUpdate(challan._id, {
            $push: {
                'conversions.convertedTo': {
                    docType: 'Sale Invoice',
                    docId: newInvoice._id,
                    docNo: newInvoice.invoiceDetails.invoiceNumber,
                    convertedAt: new Date()
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Converted to Sale Invoice successfully',
            data: {
                saleInvoiceId: newInvoice._id,
                invoiceNumber: newInvoice.invoiceDetails.invoiceNumber
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error could happen on invoice number race condition
            // In a real app we'd retry or user provides number. 
            return res.status(400).json({ success: false, message: 'Could not auto-generate unique Invoice Number. Please try manually.' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Setup conversion to Sale Invoice (Prefill Data)
// @route   GET /api/delivery-challans/:id/convert-to-invoice
const convertToSaleInvoiceData = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) {
            return res.status(404).json({ success: false, message: 'Delivery Challan not found' });
        }

        const data = challan.toObject();

        // Try to find the customer ID
        const customer = await Customer.findOne({
            userId: req.user._id,
            companyName: data.customerInformation.ms
        });

        const mappedData = {
            customerId: customer ? customer._id : null,
            customerInformation: data.customerInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            deliveryMode: data.deliveryChallanDetails?.deliveryMode || 'HAND DELIVERY',

            items: data.items.map(item => ({
                productName: item.productName,
                productGroup: item.productGroup,
                itemNote: item.itemNote,
                hsnSac: item.hsnSac,
                qty: item.qty,
                uom: item.uom,
                price: item.price,
                discountValue: item.discount, // Map discount to discountValue
                discountType: 'Percentage',   // Default to Percentage
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: item.price * item.qty,
                total: item.total
            })),
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            paymentType: data.paymentType || 'CASH', // Payment type might not be in Challan, default or empty
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: {
                    docType: 'Delivery Challan',
                    docId: challan._id
                }
            }
        };

        res.status(200).json({
            success: true,
            message: 'Delivery Challan data for conversion retrieved',
            data: mappedData
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Cancel Delivery Challan
// @route   PUT /api/delivery-challans/:id/cancel
const cancelDeliveryChallan = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        if (challan.status === 'CANCELLED') {
            return res.status(400).json({ success: false, message: 'Delivery Challan is already cancelled' });
        }

        challan.status = 'CANCELLED';
        challan.cancelledAt = new Date();
        challan.cancelledBy = req.user._id;

        await challan.save();

        res.status(200).json({ success: true, message: 'Delivery Challan cancelled successfully', data: challan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Restore Delivery Challan
// @route   PUT /api/delivery-challans/:id/restore
const restoreDeliveryChallan = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        if (challan.status !== 'CANCELLED') {
            return res.status(400).json({ success: false, message: 'Delivery Challan is not cancelled' });
        }

        challan.status = 'COMPLETED';
        challan.cancelledAt = undefined;
        challan.cancelledBy = undefined;

        await challan.save();

        res.status(200).json({ success: true, message: 'Delivery Challan restored successfully', data: challan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Upload Attachment to Delivery Challan
// @route   POST /api/delivery-challans/:id/attachments
const uploadAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) {
            // If challan not found, we should probably delete the uploaded file to avoid orphans, 
            // but for now let's just return error.
            return res.status(404).json({ success: false, message: 'Delivery Challan not found' });
        }

        const attachment = {
            fileName: req.file.originalname,
            filePath: req.file.path, // or relative path depending on config, usually path is full or relative
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date()
        };

        challan.attachments.push(attachment);
        await challan.save();

        res.status(201).json({
            success: true,
            message: 'File attached successfully',
            data: challan.attachments
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Attachments of Delivery Challan
// @route   GET /api/delivery-challans/:id/attachments
const getAttachments = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        res.status(200).json({ success: true, data: challan.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Attachment from Delivery Challan
// @route   DELETE /api/delivery-challans/:id/attachments/:attachmentId
const deleteAttachment = async (req, res) => {
    try {
        const challan = await DeliveryChallan.findOne({ _id: req.params.id, userId: req.user._id });
        if (!challan) return res.status(404).json({ success: false, message: 'Delivery Challan not found' });

        const attachmentIndex = challan.attachments.findIndex(att => att._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            return res.status(404).json({ success: false, message: 'Attachment not found' });
        }

        // In a real app, we should delete the file from filesystem here using fs.unlink
        // const fs = require('fs');
        // try { fs.unlinkSync(challan.attachments[attachmentIndex].filePath); } catch(e) { }

        challan.attachments.splice(attachmentIndex, 1);
        await challan.save();

        res.status(200).json({ success: true, message: 'Attachment removed successfully', data: challan.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const challans = await DeliveryChallan.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!challans || challans.length === 0) return res.status(404).json({ success: false, message: "Delivery Challan(s) not found" });

        const token = generatePublicToken(req.params.id);

        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/delivery-challans/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const viewDeliveryChallanPublic = async (req, res) => {
    try {
        const { id, token } = req.params;

        const expectedToken = generatePublicToken(id);

        if (token !== expectedToken) {
            return res.status(401).send("Invalid or expired link");
        }

        const ids = id.split(',');
        const challans = await DeliveryChallan.find({ _id: { $in: ids } }).sort({ createdAt: 1 });
        if (!challans || challans.length === 0) return res.status(404).send("Delivery Challan(s) not found");

        const userData = await User.findById(challans[0].userId);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(challans[0].userId, 'Delivery Challan', challans[0].branch);
        const pdfBuffer = await generateSaleInvoicePDF(challans, userData || {}, options, 'Delivery Challan', printConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="DeliveryChallan.pdf"');
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).send("Error rendering delivery challan");
    }
};

module.exports = {
    createDeliveryChallan,
    getDeliveryChallans,
    getDeliveryChallanSummary,
    getDeliveryChallanById,
    updateDeliveryChallan,
    deleteDeliveryChallan,
    printDeliveryChallan,
    searchDeliveryChallans,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getDuplicateChallanData,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    updateDeliveryChallanNote,
    generateLabel,
    convertToSaleInvoice,
    convertToSaleInvoiceData,
    cancelDeliveryChallan,
    restoreDeliveryChallan,
    uploadAttachment,
    getAttachments,
    deleteAttachment,
    downloadDeliveryChallansPDF,
    shareDeliveryChallanEmail,
    shareDeliveryChallanWhatsApp,
    generatePublicLink,
    viewDeliveryChallanPublic
};
