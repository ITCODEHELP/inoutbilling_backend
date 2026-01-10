const Proforma = require('../../models/Other-Document-Model/Proforma');
const ProformaCustomField = require('../../models/Other-Document-Model/ProformaCustomField');
const ProformaItemColumn = require('../../models/Other-Document-Model/ProformaItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { generateProformaPDF } = require('../../utils/pdfHelper');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const { sendProformaEmail } = require('../../utils/emailHelper');
const Customer = require('../../models/Customer-Vendor-Model/Customer');

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
            const pdfBuffer = await generateProformaPDF(newProforma);
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

        const pdfBuffer = await generateProformaPDF(proforma);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=proforma-${proforma.proformaDetails.proformaNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

module.exports = {
    createProforma,
    getProformas,
    getProformaSummary,
    getProformaById,
    updateProforma,
    deleteProforma,
    printProforma,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
};
