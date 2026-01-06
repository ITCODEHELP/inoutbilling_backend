const DeliveryChallan = require('../models/DeliveryChallan');
const DeliveryChallanCustomField = require('../models/DeliveryChallanCustomField');
const DeliveryChallanItemColumn = require('../models/DeliveryChallanItemColumn');
const Staff = require('../models/Staff');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');
const { generateDeliveryChallanPDF } = require('../utils/pdfHelper');
const { sendDeliveryChallanEmail } = require('../utils/emailHelper');

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
            query[`customFields.${fieldId}`] = otherFilters[key];
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
            totals,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields,
            staff,
            print,
            shareOnEmail
        } = req.body;

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

        const newChallan = new DeliveryChallan({
            userId: req.user._id,
            customerInformation,
            deliveryChallanDetails,
            transportDetails,
            items: Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []),
            additionalCharges: Array.isArray(additionalCharges) ? additionalCharges : (typeof additionalCharges === 'string' ? JSON.parse(additionalCharges) : []),
            totals,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            staff,
            customFields: normalizedCustomFields
        });

        await newChallan.save();

        if (shareOnEmail) {
            const customer = await Customer.findOne({ userId: req.user._id, companyName: customerInformation.ms });
            if (customer && customer.email) {
                sendDeliveryChallanEmail(newChallan, customer.email);
            }
        }

        if (print) {
            const pdfBuffer = await generateDeliveryChallanPDF(newChallan);
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

// @desc    Get Delivery Challan Summary (No filters as requested)
// @route   GET /api/delivery-challans/summary
const getDeliveryChallanSummary = async (req, res) => {
    try {
        const query = { userId: req.user._id };

        const summaryData = await DeliveryChallan.aggregate([
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

const updateDeliveryChallan = async (req, res) => {
    try {
        let updateData = { ...req.body };
        // Compatibility for challanType -> deliveryChallanType
        if (updateData.deliveryChallanDetails && updateData.deliveryChallanDetails.challanType && !updateData.deliveryChallanDetails.deliveryChallanType) {
            updateData.deliveryChallanDetails.deliveryChallanType = updateData.deliveryChallanDetails.challanType;
        }

        const challan = await DeliveryChallan.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updateData,
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

        const pdfBuffer = await generateDeliveryChallanPDF(challan);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=challan-${challan.deliveryChallanDetails.challanNumber}.pdf`);
        res.send(pdfBuffer);
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
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
};
