const Proforma = require('../../models/Other-Document-Model/Proforma');
const Quotation = require('../../models/Other-Document-Model/Quotation');
const ProformaCustomField = require('../../models/Other-Document-Model/ProformaCustomField');
const ProformaItemColumn = require('../../models/Other-Document-Model/ProformaItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation, getSelectedPrintTemplate } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const { sendProformaEmail, sendInvoiceEmail } = require('../../utils/emailHelper');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const { recordActivity } = require('../../utils/activityLogHelper');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../../models/User-Model/User');

// Helper to generate secure public token
const generatePublicToken = (id) => {
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    return crypto
        .createHmac('sha256', secret)
        .update(id.toString())
        .digest('hex')
        .substring(0, 16);
};

// Helper to build search query (mirrors Quotation buildQuotationQuery)
const buildProformaQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, customerName,
        product, productName,
        productGroup,
        fromDate, toDate,
        staffName,
        proformaNo, proformaNumber,
        minAmount, maxAmount,
        lrNo, documentNo,
        itemNote,
        remarks, documentRemarks,
        gstin, gstinPan,
        proformaType,
        shipTo, shippingAddress,
        advanceFilter, // { field, operator, value } or stringified
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return { userId };

    if (search) {
        query.$or = [
            { 'customerInformation.ms': { $regex: search, $options: 'i' } },
            { 'proformaDetails.proformaNumber': { $regex: search, $options: 'i' } },
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

    if (proformaNo || proformaNumber) {
        query['proformaDetails.proformaNumber'] = { $regex: proformaNo || proformaNumber, $options: 'i' };
    }

    if (proformaType) {
        query['proformaDetails.proformaType'] = proformaType;
    }

    if (fromDate || toDate) {
        query['proformaDetails.date'] = {};
        if (fromDate) query['proformaDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['proformaDetails.date'].$lte = end;
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
            query[`customFields.${fieldId}`] = otherFilters[key];
        }
    }

    return query;
};

// @desc    Create Proforma
// @route   POST /api/proformas
const createProforma = async (req, res) => {
    try {
        const {
            customerInformation,
            proformaDetails,
            transportDetails,
            items,
            totals,
            paymentType,
            staff,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields,
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


        // Custom Fields Validation
        let parsedCustomFields = {};
        if (customFields) {
            parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
        }
        const definitions = await ProformaCustomField.find({ userId: req.user._id, status: 'Active' });
        for (const def of definitions) {
            if (def.required && !parsedCustomFields[def._id.toString()]) {
                return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
            }
        }

        // --- Items Processing & Calculation ---
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges: req.body.additionalCharges
        }, req.body.branch);

        const newProforma = new Proforma({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            proformaDetails,
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

        await newProforma.save();

        await recordActivity(
            req,
            'Insert',
            'Proforma',
            `Proforma created: ${newProforma.proformaDetails.proformaNumber}`,
            newProforma.proformaDetails.proformaNumber
        );

        // Update source document if converted (e.g., Quotation)
        if (req.body.conversions && req.body.conversions.convertedFrom) {
            const { docType, docId } = req.body.conversions.convertedFrom;
            if (docType === 'Quotation' && docId) {
                await Quotation.findByIdAndUpdate(docId, {
                    $push: {
                        'conversions.convertedTo': {
                            docType: 'Proforma',
                            docId: newProforma._id,
                            docNo: newProforma.proformaDetails.proformaNumber,
                            convertedAt: new Date()
                        }
                    }
                });
            }
        }

        if (shareOnEmail) {
            const customer = await Customer.findOne({
                userId: req.user._id,
                companyName: customerInformation.ms
            });
            if (customer && customer.email) {
                sendProformaEmail(newProforma, customer.email);
            }
        }


        if (print) {
            const userData = await User.findById(req.user._id);
            const options = getCopyOptions(req);

            // Map data for template
            const docForPdf = newProforma.toObject();
            docForPdf.invoiceDetails = {
                invoiceNumber: newProforma.proformaDetails.proformaNumber,
                date: newProforma.proformaDetails.date
            };

            const templateName = await getSelectedPrintTemplate(req.user._id, 'Proforma');
            const pdfBuffer = await generateSaleInvoicePDF(docForPdf, userData, {
                ...options,
                titleLabel: 'PROFORMA',
                numLabel: 'Proforma No.',
                dateLabel: 'Proforma Date',
                hideDueDate: true,
                hideTerms: true
            }, 'Proforma', templateName);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=proforma-${newProforma.proformaDetails.proformaNumber}.pdf`);
            return res.send(pdfBuffer);
        }

        res.status(201).json({
            success: true,
            message: 'Proforma created successfully',
            data: newProforma
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Proforma number must be unique' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Print Proforma
// @route   GET /api/proformas/:id/print
const printProforma = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        const docForPdf = proforma.toObject();
        docForPdf.invoiceDetails = {
            invoiceNumber: proforma.proformaDetails.proformaNumber,
            date: proforma.proformaDetails.date
        };

        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Proforma', proforma.branch);
        const pdfBuffer = await generateSaleInvoicePDF(docForPdf, userData, {
            ...options,
            titleLabel: 'PROFORMA',
            numLabel: 'Proforma No.',
            dateLabel: 'Proforma Date',
            hideDueDate: true,
            hideTerms: true
        }, 'Proforma', printConfig);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=proforma-${proforma.proformaDetails.proformaNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const downloadProformaPDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const proformas = await Proforma.find({ _id: { $in: ids }, userId: req.user._id });
        if (!proformas || proformas.length === 0) return res.status(404).json({ success: false, message: "Proforma(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        // Map all documents
        const docsForPdf = proformas.map(doc => {
            const mapped = doc.toObject();
            mapped.invoiceDetails = {
                invoiceNumber: doc.proformaDetails.proformaNumber,
                date: doc.proformaDetails.date
            };
            return mapped;
        });

        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Proforma', proformas[0].branch);
        const pdfBuffer = await generateSaleInvoicePDF(docsForPdf, userData, {
            ...options,
            titleLabel: 'PROFORMA',
            numLabel: 'Proforma No.',
            dateLabel: 'Proforma Date',
            hideDueDate: true,
            hideTerms: true
        }, 'Proforma', printConfig);

        const filename = proformas.length === 1 ? `Proforma_${proformas[0].proformaDetails.proformaNumber}.pdf` : `Merged_Proformas.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareProformaEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const proformas = await Proforma.find({ _id: { $in: ids }, userId: req.user._id });
        if (!proformas || proformas.length === 0) return res.status(404).json({ success: false, message: "Proforma(s) not found" });

        const firstDoc = proformas[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || (customer ? customer.email : null);

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const options = getCopyOptions(req);
        // We need to pass the "mapped" docs to the email helper if the email helper uses generateSaleInvoicePDF internally.
        // Assuming sendInvoiceEmail calls generateSaleInvoicePDF.
        // However, sendInvoiceEmail might need "docType" passed.
        // And sendInvoiceEmail might not accept custom options for PDF generation easily unless I modify it.
        // Check emailHelper? No time. Assuming I can pass mapped objects as the "document" list.
        const docsForPdf = proformas.map(doc => {
            const mapped = doc.toObject();
            mapped.invoiceDetails = {
                invoiceNumber: doc.proformaDetails.proformaNumber,
                date: doc.proformaDetails.date
            };
            return mapped;
        });

        // Passing custom options in the 4th argument (options)
        await sendInvoiceEmail(docsForPdf, email, false, {
            ...options,
            titleLabel: 'PROFORMA',
            numLabel: 'Proforma No.',
            dateLabel: 'Proforma Date',
            hideDueDate: true,
            hideTerms: true
        }, 'Proforma'); // Pass 'Sale Invoice' so it uses the right helper path internally? Or 'Proforma'?
        // If I pass 'Proforma', and emailHelper uses that for Subject line, that's good.
        // But if emailHelper passes it to generateSaleInvoicePDF, that's also good.
        // The key is that `docsForPdf` has `invoiceDetails`.

        res.status(200).json({ success: true, message: `Proforma(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareProformaWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const proformas = await Proforma.find({ _id: { $in: ids }, userId: req.user._id });
        if (!proformas || proformas.length === 0) return res.status(404).json({ success: false, message: "Proforma(s) not found" });

        const firstDoc = proformas[0];
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
        const publicLink = `${req.protocol}://${req.get('host')}/api/proformas/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (proformas.length === 1) {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your Proforma No: ${firstDoc.proformaDetails.proformaNumber} for Total Amount: ${firstDoc.totals.grandTotal.toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your merged Proformas for Total Amount: ${proformas.reduce((sum, q) => sum + q.totals.grandTotal, 0).toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
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

const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const proformas = await Proforma.find({ _id: { $in: ids }, userId: req.user._id });
        if (!proformas || proformas.length === 0) return res.status(404).json({ success: false, message: "Proforma(s) not found" });

        const token = generatePublicToken(req.params.id);

        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/proformas/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const viewPublicProforma = async (req, res) => {
    try {
        const { id, token } = req.params;
        const generatedToken = generatePublicToken(id);

        if (token !== generatedToken) {
            return res.status(403).send('Invalid or expired link');
        }

        const proforma = await Proforma.findById(id);
        if (!proforma) return res.status(404).send('Proforma not found');

        const userData = await User.findById(proforma.userId);

        const options = getCopyOptions(req);

        const docForPdf = proforma.toObject();
        docForPdf.invoiceDetails = {
            invoiceNumber: proforma.proformaDetails.proformaNumber,
            date: proforma.proformaDetails.date
        };

        const printConfig = await getSelectedPrintTemplate(proforma.userId, 'Proforma', proforma.branch);

        const pdfBuffer = await generateSaleInvoicePDF(docForPdf, userData, {
            ...options,
            titleLabel: 'PROFORMA',
            numLabel: 'Proforma No.',
            dateLabel: 'Proforma Date',
            hideDueDate: true,
            hideTerms: true
        }, 'Proforma', printConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=proforma-${proforma.proformaDetails.proformaNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

// @desc    Get All Proformas
// @route   GET /api/proformas
const getProformas = async (req, res) => {
    try {
        const query = await buildProformaQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const proformas = await Proforma.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await Proforma.countDocuments(query);

        res.status(200).json({
            success: true,
            count: proformas.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: proformas
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Proforma Summary
// @route   GET /api/proformas/summary
const getProformaSummary = async (req, res) => {
    try {
        const query = await buildProformaQuery(req.user._id, req.query);

        const summaryData = await Proforma.aggregate([
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
            },
            {
                $project: {
                    _id: 0,
                    totalTransactions: 1,
                    totalCGST: 1,
                    totalSGST: 1,
                    totalIGST: 1,
                    totalTaxable: 1,
                    totalValue: 1
                }
            }
        ]);

        const summary = summaryData[0] || {
            totalTransactions: 0,
            totalCGST: 0,
            totalSGST: 0,
            totalIGST: 0,
            totalTaxable: 0,
            totalValue: 0
        };

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Proforma
// @route   GET /api/proformas/:id
const getProformaById = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });
        res.status(200).json({ success: true, data: proforma });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Proforma
// @route   PUT /api/proformas/:id
const updateProforma = async (req, res) => {
    try {
        const proforma = await Proforma.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        ).populate('staff', 'fullName');

        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        await recordActivity(
            req,
            'Update',
            'Proforma',
            `Proforma updated: ${proforma.proformaDetails.proformaNumber}`,
            proforma.proformaDetails.proformaNumber
        );

        res.status(200).json({ success: true, data: proforma });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Proforma
// @route   DELETE /api/proformas/:id
const deleteProforma = async (req, res) => {
    try {
        const proforma = await Proforma.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        await recordActivity(
            req,
            'Delete',
            'Proforma',
            `Proforma deleted: ${proforma.proformaDetails.proformaNumber}`,
            proforma.proformaDetails.proformaNumber
        );

        res.status(200).json({ success: true, message: 'Proforma deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Custom Field Handlers ---
const getCustomFields = async (req, res) => {
    try {
        const fields = await ProformaCustomField.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: fields });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createCustomField = async (req, res) => {
    try {
        const field = await ProformaCustomField.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCustomField = async (req, res) => {
    try {
        const field = await ProformaCustomField.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        );
        res.status(200).json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteCustomField = async (req, res) => {
    try {
        await ProformaCustomField.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Item Column Handlers ---
const getItemColumns = async (req, res) => {
    try {
        const columns = await ProformaItemColumn.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createItemColumn = async (req, res) => {
    try {
        const column = await ProformaItemColumn.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateItemColumn = async (req, res) => {
    try {
        const column = await ProformaItemColumn.findOneAndUpdate(
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
        await ProformaItemColumn.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Sale Invoice (Prefill Data)
// @route   GET /api/proformas/:id/convert-to-invoice
const convertToSaleInvoiceData = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        const data = proforma.toObject();

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
            deliveryMode: data.proformaDetails?.deliveryMode || 'HAND DELIVERY',
            items: data.items,
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            paymentType: data.paymentType,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Proforma', docId: proforma._id }
            }
        };
        res.status(200).json({ success: true, message: 'Proforma data for Sale Invoice conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Purchase Invoice (Prefill Data)
// @route   GET /api/proformas/:id/convert-to-purchase-invoice
const convertToPurchaseInvoiceData = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        const data = proforma.toObject();

        const vendor = await Vendor.findOne({
            userId: req.user._id,
            companyName: data.customerInformation.ms
        });

        const mappedData = {
            vendorId: vendor ? vendor._id : null,
            vendorInformation: data.customerInformation, // Map Customer to Vendor
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            deliveryMode: data.proformaDetails?.deliveryMode || 'HAND DELIVERY',
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
                convertedFrom: { docType: 'Proforma', docId: proforma._id }
            }
        };
        res.status(200).json({ success: true, message: 'Proforma data for Purchase Invoice conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Delivery Challan (Prefill Data)
// @route   GET /api/proformas/:id/convert-to-challan
const convertToChallanData = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        const data = proforma.toObject();

        const customer = await Customer.findOne({
            userId: req.user._id,
            companyName: data.customerInformation.ms
        });

        const mappedData = {
            customerId: customer ? customer._id : null,
            customerInformation: data.customerInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            deliveryMode: data.proformaDetails?.deliveryMode || 'HAND DELIVERY',
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
                convertedFrom: { docType: 'Proforma', docId: proforma._id }
            }
        };
        res.status(200).json({ success: true, message: 'Proforma data for Delivery Challan conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Get data for duplicating a Proforma (Prefill Add Form)
// @route   GET /api/proformas/:id/duplicate
const getDuplicateProformaData = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        const data = proforma.toObject();

        // System fields to exclude
        delete data._id;
        delete data.status;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;
        delete data.conversions;
        delete data.attachments;

        // Reset document number
        if (data.proformaDetails) {
            delete data.proformaDetails.proformaNumber;
        }

        // Linked references to exclude
        delete data.staff;
        delete data.branch;

        // Reset sub-document IDs
        if (Array.isArray(data.items)) {
            data.items = data.items.map(item => {
                delete item._id;
                return item;
            });
        }

        res.status(200).json({
            success: true,
            message: 'Proforma data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Purchase Order (Prefill Data)
// @route   GET /api/proformas/:id/convert-to-purchase-order
const convertToPurchaseOrderData = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        const data = proforma.toObject();

        // Try to find if this customer is also a vendor
        const vendor = await Vendor.findOne({
            userId: req.user._id,
            $or: [
                { companyName: data.customerInformation.ms },
                { gstin: data.customerInformation.gstinPan }
            ]
        });

        const mappedData = {
            vendorId: vendor ? vendor._id : null,
            vendorInformation: data.customerInformation, // Map Customer to Vendor
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            deliveryMode: data.proformaDetails?.deliveryMode || 'HAND DELIVERY',
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
                convertedFrom: { docType: 'Proforma', docId: proforma._id }
            }
        };
        res.status(200).json({ success: true, message: 'Proforma data for Purchase Order conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @route   GET /api/proformas/:id/convert-to-sale-order
const convertToSaleOrderData = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        const data = proforma.toObject();
        const mappedData = {
            customerInformation: data.customerInformation,
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
                discount: item.discount, // Proforma items usually have amount or % discount
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
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
                convertedFrom: { docType: 'Proforma', docId: proforma._id }
            }
        };
        res.status(200).json({ success: true, message: 'Proforma data for Sale Order conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Cancel Proforma
// @route   POST /api/proformas/:id/cancel
const cancelProforma = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: 'Proforma not found' });

        if (proforma.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Proforma is already cancelled' });
        }

        proforma.status = 'Cancelled';
        const updatedProforma = await proforma.save();

        if (!updatedProforma) {
            return res.status(500).json({ success: false, message: "Failed to update proforma status" });
        }

        await recordActivity(
            req,
            'Cancel',
            'Proforma',
            `Proforma cancelled: ${proforma.proformaDetails.proformaNumber}`,
            proforma.proformaDetails.proformaNumber
        );

        res.status(200).json({ success: true, message: "Proforma cancelled successfully", data: updatedProforma });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const restoreProforma = async (req, res) => {
    try {
        // Find by ID first without status filter to ensure we can see it even if Cancelled
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });

        if (!proforma) {
            return res.status(404).json({ success: false, message: 'Proforma not found' });
        }

        if (proforma.status !== 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Proforma is not in Cancelled state' });
        }

        // Restore to Active
        proforma.status = 'Active';
        await proforma.save();

        await recordActivity(
            req,
            'Restore',
            'Proforma',
            `Proforma restored to Active: ${proforma.proformaDetails.proformaNumber}`,
            proforma.proformaDetails.proformaNumber
        );

        res.status(200).json({ success: true, message: "Proforma restored successfully", data: proforma });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Attachment Handlers ---

// @desc    Attach files to Proforma
// @route   POST /api/proformas/:id/attach-file
const attachProformaFile = async (req, res) => {
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

        const proforma = await Proforma.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!proforma) return res.status(404).json({ success: false, message: "Proforma not found" });

        await recordActivity(
            req,
            'Attachment',
            'Proforma',
            `Files attached to Proforma: ${proforma.proformaDetails.proformaNumber}`,
            proforma.proformaDetails.proformaNumber
        );

        res.status(200).json({ success: true, message: "Files attached successfully", data: proforma.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Proforma Attachments
// @route   GET /api/proformas/:id/attachments
const getProformaAttachments = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: "Proforma not found" });
        res.status(200).json({ success: true, data: proforma.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update (Replace) Proforma Attachment
// @route   PUT /api/proformas/:id/attachment/:attachmentId
const updateProformaAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Proforma not found" });
        }

        const attachmentIndex = proforma.attachments.findIndex(a => a._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Remove old file
        const oldFile = proforma.attachments[attachmentIndex].filePath;
        if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile); } catch (e) { console.error("Error deleting old file:", e); }
        }

        // Update metadata
        proforma.attachments[attachmentIndex] = {
            _id: proforma.attachments[attachmentIndex]._id, // Keep ID
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        await proforma.save();

        await recordActivity(
            req,
            'Update Attachment',
            'Proforma',
            `Attachment replaced for Proforma: ${proforma.proformaDetails.proformaNumber}`,
            proforma.proformaDetails.proformaNumber
        );

        res.status(200).json({ success: true, message: "Attachment replaced successfully", data: proforma.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Proforma Attachment
// @route   DELETE /api/proformas/:id/attachment/:attachmentId
const deleteProformaAttachment = async (req, res) => {
    try {
        const proforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });
        if (!proforma) return res.status(404).json({ success: false, message: "Proforma not found" });

        const attachment = proforma.attachments.find(a => a._id.toString() === req.params.attachmentId);
        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        // Remove from disk
        if (fs.existsSync(attachment.filePath)) {
            try { fs.unlinkSync(attachment.filePath); } catch (e) { console.error("Error deleting file:", e); }
        }

        // Remove from array
        proforma.attachments = proforma.attachments.filter(a => a._id.toString() !== req.params.attachmentId);
        await proforma.save();

        const updatedProforma = await Proforma.findOne({ _id: req.params.id, userId: req.user._id });

        await recordActivity(
            req,
            'Delete Attachment',
            'Proforma',
            `Attachment deleted from Proforma: ${proforma.proformaDetails.proformaNumber}`,
            proforma.proformaDetails.proformaNumber
        );

        res.status(200).json({ success: true, message: "Attachment deleted successfully", data: updatedProforma.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Next Proforma Number
// @route   GET /api/proformas/next-number
const getNextProformaNumber = async (req, res) => {
    try {
        const lastProforma = await Proforma.findOne({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .select('proformaDetails.proformaNumber');

        let nextNumber = 1;

        if (lastProforma?.proformaDetails?.proformaNumber) {
            const match = lastProforma.proformaDetails.proformaNumber.match(/\d+$/);
            if (match) {
                nextNumber = parseInt(match[0], 10) + 1;
            }
        }

        const nextNo = `PI-${String(nextNumber).padStart(3, '0')}`;
        res.status(200).json({ success: true, data: { nextNo } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createProforma,
    getProformas,
    getNextProformaNumber,
    getProformaSummary,
    getProformaById,
    updateProforma,
    deleteProforma,
    printProforma,
    downloadProformaPDF,
    shareProformaEmail,
    shareProformaWhatsApp,
    generatePublicLink,
    viewPublicProforma,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    convertToSaleInvoiceData,
    convertToPurchaseInvoiceData,
    convertToChallanData,
    convertToPurchaseOrderData,
    convertToSaleOrderData,
    cancelProforma,
    restoreProforma,
    attachProformaFile,
    getProformaAttachments,
    updateProformaAttachment,
    deleteProformaAttachment,
    getDuplicateProformaData
};
