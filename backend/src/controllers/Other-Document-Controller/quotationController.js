const Quotation = require('../../models/Other-Document-Model/Quotation');
const QuotationCustomField = require('../../models/Other-Document-Model/QuotationCustomField');
const QuotationItemColumn = require('../../models/Other-Document-Model/QuotationItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { generateQuotationPDF } = require('../../utils/pdfHelper');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const fs = require('fs');
const path = require('path');

// Helper to build search query (mirrors DailyExpense buildExpenseQuery)
const buildQuotationQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, customerName,
        product, productName,
        productGroup,
        fromDate, toDate,
        staffName,
        quotationNo, quotationNumber,
        minAmount, maxAmount,
        lrNo, documentNo,
        itemNote,
        remarks, documentRemarks,
        gstin, gstinPan,
        quotationType,
        shipTo, shippingAddress,
        advanceFilter, // { field, operator, value } or stringified
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return { userId };

    if (search) {
        query.$or = [
            { 'customerInformation.ms': { $regex: search, $options: 'i' } },
            { 'quotationDetails.quotationNumber': { $regex: search, $options: 'i' } },
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

    if (quotationNo || quotationNumber) {
        query['quotationDetails.quotationNumber'] = { $regex: quotationNo || quotationNumber, $options: 'i' };
    }

    if (quotationType) {
        query['quotationDetails.quotationType'] = quotationType;
    }

    if (fromDate || toDate) {
        query['quotationDetails.date'] = {};
        if (fromDate) query['quotationDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['quotationDetails.date'].$lte = end;
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

// @desc    Create Quotation
// @route   POST /api/quotations
const createQuotation = async (req, res) => {
    try {
        const {
            customerInformation,
            quotationDetails,
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
            print
        } = req.body;

        const { calculateShippingDistance } = require('../../utils/shippingHelper');

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

        // Custom Fields Validation (Atomic behavior reuse)
        let parsedCustomFields = {};
        if (customFields) {
            parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
        }
        const definitions = await QuotationCustomField.find({ userId: req.user._id, status: 'Active' });
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

        const newQuotation = new Quotation({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            quotationDetails,
            transportDetails,
            items: calculationResults.items,
            totals: calculationResults.totals,
            additionalCharges: req.body.additionalCharges || [],
            paymentType,
            staff,
            branch: req.body.branch,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields: parsedCustomFields
        });

        await newQuotation.save();

        if (print) {
            const pdfBuffer = await generateQuotationPDF(newQuotation);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=quotation-${newQuotation.quotationDetails.quotationNumber}.pdf`);
            return res.send(pdfBuffer);
        }

        res.status(201).json({
            success: true,
            message: 'Quotation created successfully',
            data: newQuotation
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Quotation number must be unique' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Print Quotation
// @route   GET /api/quotations/:id/print
const printQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const pdfBuffer = await generateQuotationPDF(quotation);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=quotation-${quotation.quotationDetails.quotationNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get All Quotations
// @route   GET /api/quotations
const getQuotations = async (req, res) => {
    try {
        const query = await buildQuotationQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        // Fetch paginated data
        const quotations = await Quotation.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await Quotation.countDocuments(query);

        res.status(200).json({
            success: true,
            count: quotations.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: quotations
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getQuotationSummary = async (req, res) => {
    try {
        const query = await buildQuotationQuery(req.user._id, req.query);
        const data = await getSummaryAggregation(req.user._id, query, Quotation);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Quotation
// @route   GET /api/quotations/:id
const getQuotationById = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
        res.status(200).json({ success: true, data: quotation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Quotation
// @route   PUT /api/quotations/:id
const updateQuotation = async (req, res) => {
    try {
        // Distance Calculation
        // Fetch current quotation to get existing customerInformation if not provided in req.body
        let currentQuotationForDistance = null;
        if (req.body.shippingAddress || req.body.useSameShippingAddress || req.body.customerInformation) {
            currentQuotationForDistance = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
            if (!currentQuotationForDistance && (req.body.useSameShippingAddress && !req.body.customerInformation)) {
                return res.status(404).json({ success: false, message: 'Quotation not found for distance calculation' });
            }

            let finalShippingAddress = req.body.shippingAddress || {};
            if (req.body.useSameShippingAddress) {
                const effectiveCustomerInfo = req.body.customerInformation || (currentQuotationForDistance ? currentQuotationForDistance.customerInformation : null);
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
            const currentQuotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
            if (currentQuotation) {
                const calculationResults = await calculateDocumentTotals(req.user._id, {
                    customerInformation: req.body.customerInformation || currentQuotation.customerInformation,
                    items: req.body.items || currentQuotation.items,
                    additionalCharges: req.body.additionalCharges || currentQuotation.additionalCharges
                }, req.body.branch || currentQuotation.branch);

                req.body.items = calculationResults.items;
                req.body.totals = calculationResults.totals;
            }
        }

        const quotation = await Quotation.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        ).populate('staff', 'fullName');

        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
        res.status(200).json({ success: true, data: quotation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Quotation
// @route   DELETE /api/quotations/:id
const deleteQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
        res.status(200).json({ success: true, message: 'Quotation deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Custom Field Handlers (Mirror Daily Expense) ---
const getCustomFields = async (req, res) => {
    try {
        const fields = await QuotationCustomField.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: fields });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createCustomField = async (req, res) => {
    try {
        const field = await QuotationCustomField.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCustomField = async (req, res) => {
    try {
        const field = await QuotationCustomField.findOneAndUpdate(
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
        await QuotationCustomField.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Item Column Handlers ---
const getItemColumns = async (req, res) => {
    try {
        const columns = await QuotationItemColumn.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createItemColumn = async (req, res) => {
    try {
        const column = await QuotationItemColumn.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateItemColumn = async (req, res) => {
    try {
        const column = await QuotationItemColumn.findOneAndUpdate(
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
        await QuotationItemColumn.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Sale Invoice (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-invoice
const convertToSaleInvoiceData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) {
            return res.status(404).json({ success: false, message: 'Quotation not found' });
        }

        const data = quotation.toObject();

        // Map data to Sale Invoice structure for frontend prefilling
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
                discountValue: item.discount, // Quotation uses 'discount', Invoice uses 'discountValue'
                discountType: 'Percentage', // Defaulting to Percentage as Quotation discount is usually percentage
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: item.price * item.qty, // Simple estimate, will be recalculated on save
                total: item.total
            })),
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
                convertedFrom: {
                    docType: 'Quotation',
                    docId: quotation._id
                }
            }
        };

        res.status(200).json({
            success: true,
            message: 'Quotation data for conversion retrieved',
            data: mappedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Purchase Invoice (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-purchase-invoice
const convertToPurchaseInvoiceData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            vendorInformation: data.customerInformation, // Map Customer to Vendor
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
                discountValue: item.discount,
                discountType: 'Percentage',
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: item.price * item.qty,
                total: item.total
            })),
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
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Purchase Invoice conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Proforma Invoice (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-proforma
const convertToProformaData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            customerInformation: data.customerInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
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
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Proforma conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Delivery Challan (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-challan
const convertToChallanData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            customerInformation: data.customerInformation,
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
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Delivery Challan conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Purchase Order (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-purchase-order
const convertToPurchaseOrderData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            vendorInformation: data.customerInformation, // Map Customer to Vendor
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
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Purchase Order conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};


// --- Attachment Handlers ---

// @desc    Attach files to Quotation
// @route   POST /api/quotations/:id/attach-file
const attachQuotationFile = async (req, res) => {
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

        const quotation = await Quotation.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

        await recordActivity(
            req,
            'Attachment',
            'Quotation',
            `Files attached to Quotation: ${quotation.quotationDetails.quotationNumber}`,
            quotation.quotationDetails.quotationNumber
        );

        res.status(200).json({ success: true, message: "Files attached successfully", data: quotation.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Quotation Attachments
// @route   GET /api/quotations/:id/attachments
const getQuotationAttachments = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });
        res.status(200).json({ success: true, data: quotation.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update (Replace) Quotation Attachment
// @route   PUT /api/quotations/:id/attachment/:attachmentId
const updateQuotationAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Quotation not found" });
        }

        const attachmentIndex = quotation.attachments.findIndex(a => a._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Remove old file
        const oldFile = quotation.attachments[attachmentIndex].filePath;
        if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile); } catch (e) { console.error("Error deleting old file:", e); }
        }

        // Update metadata
        quotation.attachments[attachmentIndex] = {
            _id: quotation.attachments[attachmentIndex]._id, // Keep ID
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        await quotation.save();

        await recordActivity(
            req,
            'Update Attachment',
            'Quotation',
            `Attachment replaced for Quotation: ${quotation.quotationDetails.quotationNumber}`,
            quotation.quotationDetails.quotationNumber
        );

        res.status(200).json({ success: true, message: "Attachment replaced successfully", data: quotation.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Quotation Attachment
// @route   DELETE /api/quotations/:id/attachment/:attachmentId
const deleteQuotationAttachment = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

        const attachment = quotation.attachments.find(a => a._id.toString() === req.params.attachmentId);
        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        // Remove from disk
        if (fs.existsSync(attachment.filePath)) {
            try { fs.unlinkSync(attachment.filePath); } catch (e) { console.error("Error deleting file:", e); }
        }

        // Remove from array
        quotation.attachments = quotation.attachments.filter(a => a._id.toString() !== req.params.attachmentId);
        await quotation.save();

        await recordActivity(
            req,
            'Delete Attachment',
            'Quotation',
            `Attachment deleted from Quotation: ${quotation.quotationDetails.quotationNumber}`,
            quotation.quotationDetails.quotationNumber
        );

        res.status(200).json({ success: true, message: "Attachment deleted successfully", data: quotation.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createQuotation,
    getQuotations,
    getQuotationSummary,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    printQuotation,
    convertToSaleInvoiceData,
    convertToPurchaseInvoiceData,
    convertToProformaData,
    convertToChallanData,
    convertToPurchaseOrderData,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    attachQuotationFile,
    getQuotationAttachments,
    updateQuotationAttachment,
    deleteQuotationAttachment
};
