const Quotation = require('../models/Quotation');
const QuotationCustomField = require('../models/QuotationCustomField');
const QuotationItemColumn = require('../models/QuotationItemColumn');
const Staff = require('../models/Staff');
const mongoose = require('mongoose');
const { generateQuotationPDF } = require('../utils/pdfHelper');

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

        // --- Items Processing (Including Item Level Custom Fields) ---
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const newQuotation = new Quotation({
            userId: req.user._id,
            customerInformation,
            quotationDetails,
            transportDetails,
            items: parsedItems,
            totals,
            paymentType,
            staff,
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

// @desc    Get Quotation Summary
// @route   GET /api/quotations/summary
const getQuotationSummary = async (req, res) => {
    try {
        const query = await buildQuotationQuery(req.user._id, req.query);

        const summaryData = await Quotation.aggregate([
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

module.exports = {
    createQuotation,
    getQuotations,
    getQuotationSummary,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    printQuotation,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
};
