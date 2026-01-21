const PurchaseOrder = require('../../models/Other-Document-Model/PurchaseOrder');
const PurchaseOrderCustomField = require('../../models/Other-Document-Model/PurchaseOrderCustomField');
const PurchaseOrderItemColumn = require('../../models/Other-Document-Model/PurchaseOrderItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const Quotation = require('../../models/Other-Document-Model/Quotation');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { calculateShippingDistance } = require('../../utils/shippingHelper');

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
    deleteItemColumn
};
