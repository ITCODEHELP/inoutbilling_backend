const SaleOrder = require('../../models/Other-Document-Model/SaleOrder');
const SaleOrderCustomField = require('../../models/Other-Document-Model/SaleOrderCustomField');
const SaleOrderItemColumn = require('../../models/Other-Document-Model/SaleOrderItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { calculateShippingDistance } = require('../../utils/shippingHelper');

// Helper to build search query
const buildSaleOrderQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, customerName,
        product, productName,
        productGroup,
        fromDate, toDate,
        staffName,
        soNo, soNumber,
        minAmount, maxAmount,
        lrNo, documentNo,
        itemNote,
        remarks, documentRemarks,
        gstin, gstinPan,
        saleOrderType,
        status,
        shipTo, shippingAddress,
        advanceFilter, // { field, operator, value } or stringified
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return { userId };

    if (search) {
        query.$or = [
            { 'customerInformation.ms': { $regex: search, $options: 'i' } },
            { 'saleOrderDetails.soNumber': { $regex: search, $options: 'i' } },
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

    if (soNo || soNumber) {
        query['saleOrderDetails.soNumber'] = { $regex: soNo || soNumber, $options: 'i' };
    }

    if (saleOrderType) {
        query['saleOrderDetails.saleOrderType'] = saleOrderType;
    }

    if (status) {
        query['saleOrderDetails.status'] = status;
    }

    if (fromDate || toDate) {
        query['saleOrderDetails.date'] = {};
        if (fromDate) query['saleOrderDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['saleOrderDetails.date'].$lte = end;
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

// @desc    Create Sale Order
// @route   POST /api/sale-orders
const createSaleOrder = async (req, res) => {
    try {
        const {
            customerInformation,
            saleOrderDetails,
            transportDetails,
            items,
            additionalCharges,
            totals,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields,
            staff
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

        const normalizedCustomFields = Object.keys(rawCustomFields).reduce((acc, key) => {
            const canonicalKey = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
            acc[canonicalKey] = rawCustomFields[key];
            return acc;
        }, {});

        const definitions = await SaleOrderCustomField.find({ userId: req.user._id, status: 'Active' });
        for (const def of definitions) {
            const canonicalDefName = def.name.trim().toLowerCase().replace(/[\s-]+/g, '_');
            if (def.required) {
                const value = normalizedCustomFields[canonicalDefName];
                if (value === undefined || value === null || value === '') {
                    return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
                }
            }
        }

        // --- Items Processing & Calculation ---
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges: req.body.additionalCharges
        }, req.body.branch);

        const newSaleOrder = new SaleOrder({
            userId: req.user._id,
            customerInformation,
            saleOrderDetails,
            transportDetails,
            items: calculationResults.items,
            totals: calculationResults.totals,
            additionalCharges: req.body.additionalCharges || [],
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            staff,
            branch: req.body.branch,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            customFields: normalizedCustomFields
        });

        await newSaleOrder.save();

        res.status(201).json({
            success: true,
            message: 'Sale Order created successfully',
            data: newSaleOrder
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Sale Order number must be unique' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Search Sale Orders
// @route   GET /api/sale-orders/search
const searchSaleOrders = async (req, res) => {
    try {
        const query = await buildSaleOrderQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const saleOrders = await SaleOrder.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await SaleOrder.countDocuments(query);

        res.status(200).json({
            success: true,
            count: saleOrders.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: saleOrders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get All Sale Orders
// @route   GET /api/sale-orders
const getSaleOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        const query = { userId: req.user._id };

        const saleOrders = await SaleOrder.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await SaleOrder.countDocuments(query);

        res.status(200).json({
            success: true,
            count: saleOrders.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: saleOrders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Sale Order Summary
// @route   GET /api/sale-orders/summary
const getSaleOrderSummary = async (req, res) => {
    try {
        const query = await buildSaleOrderQuery(req.user._id, req.query);
        const data = await getSummaryAggregation(req.user._id, query, SaleOrder);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Sale Order
// @route   GET /api/sale-orders/:id
const getSaleOrderById = async (req, res) => {
    try {
        const saleOrder = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id }).populate('staff', 'fullName');
        if (!saleOrder) return res.status(404).json({ success: false, message: 'Sale Order not found' });
        res.status(200).json({ success: true, data: saleOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Sale Order
// @route   PUT /api/sale-orders/:id
const updateSaleOrder = async (req, res) => {
    try {
        // Distance Calculation
        if (req.body.shippingAddress || req.body.useSameShippingAddress || req.body.customerInformation) {
            let currentSO = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
            let finalShippingAddress = req.body.shippingAddress || {};
            if (req.body.useSameShippingAddress) {
                const effectiveCustomerInfo = req.body.customerInformation || (currentSO ? currentSO.customerInformation : null);
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

        // Custom field normalization if provided in update
        if (req.body.customFields) {
            const rawCustomFields = typeof req.body.customFields === 'string' ? JSON.parse(req.body.customFields) : req.body.customFields;
            req.body.customFields = Object.keys(rawCustomFields).reduce((acc, key) => {
                const canonicalKey = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
                acc[canonicalKey] = rawCustomFields[key];
                return acc;
            }, {});
        }

        // --- Recalculate Totals ---
        if (req.body.items || req.body.customerInformation || req.body.additionalCharges || req.body.branch) {
            const currentSO = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
            if (currentSO) {
                const calculationResults = await calculateDocumentTotals(req.user._id, {
                    customerInformation: req.body.customerInformation || currentSO.customerInformation,
                    items: req.body.items || currentSO.items,
                    additionalCharges: req.body.additionalCharges || currentSO.additionalCharges
                }, req.body.branch || currentSO.branch);

                req.body.items = calculationResults.items;
                req.body.totals = calculationResults.totals;
            }
        }

        const saleOrder = await SaleOrder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        ).populate('staff', 'fullName');

        if (!saleOrder) return res.status(404).json({ success: false, message: 'Sale Order not found' });
        res.status(200).json({ success: true, data: saleOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Sale Order
// @route   DELETE /api/sale-orders/:id
const deleteSaleOrder = async (req, res) => {
    try {
        const saleOrder = await SaleOrder.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!saleOrder) return res.status(404).json({ success: false, message: 'Sale Order not found' });
        res.status(200).json({ success: true, message: 'Sale Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Custom Field Handlers ---
const getCustomFields = async (req, res) => {
    try {
        const fields = await SaleOrderCustomField.find({ userId: req.user._id }).sort({ orderNo: 1 });
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
        const existingField = await SaleOrderCustomField.findOne({ userId: req.user._id, name: canonicalName });
        if (existingField) {
            return res.status(400).json({ success: false, message: `Custom field with name '${canonicalName}' already exists` });
        }
        const field = await SaleOrderCustomField.create({ ...req.body, name: canonicalName, userId: req.user._id });
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
            const existingField = await SaleOrderCustomField.findOne({
                userId: req.user._id,
                name: canonicalName,
                _id: { $ne: req.params.id }
            });
            if (existingField) {
                return res.status(400).json({ success: false, message: `Custom field with name '${canonicalName}' already exists` });
            }
            updateData.name = canonicalName;
        }
        const field = await SaleOrderCustomField.findOneAndUpdate(
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
        await SaleOrderCustomField.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Item Column Handlers ---
const getItemColumns = async (req, res) => {
    try {
        const columns = await SaleOrderItemColumn.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createItemColumn = async (req, res) => {
    try {
        const column = await SaleOrderItemColumn.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateItemColumn = async (req, res) => {
    try {
        const column = await SaleOrderItemColumn.findOneAndUpdate(
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
        await SaleOrderItemColumn.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createSaleOrder,
    getSaleOrders,
    getSaleOrderSummary,
    getSaleOrderById,
    updateSaleOrder,
    deleteSaleOrder,
    searchSaleOrders,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
};
