const SaleOrder = require('../../models/Other-Document-Model/SaleOrder');
const SaleOrderCustomField = require('../../models/Other-Document-Model/SaleOrderCustomField');
const SaleOrderItemColumn = require('../../models/Other-Document-Model/SaleOrderItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation, getSelectedPrintTemplate } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const DeliveryChallan = require('../../models/Other-Document-Model/DeliveryChallan');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const User = require('../../models/User-Model/User');
const crypto = require('crypto');
const fs = require('fs');

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
        query['status'] = status;
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
            staff,
            status
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
            customFields: normalizedCustomFields,
            status: status || 'New'
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

// @desc    Update Sale Order Status
// @route   PATCH /api/sale-orders/:id/status
const updateSaleOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

        const validStatuses = ['New', 'Pending', 'In-Work', 'Completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const so = await SaleOrder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status },
            { new: true, runValidators: true }
        );

        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        res.status(200).json({ success: true, data: { status: so.status } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Remaining Quantity for Sale Order items
// @route   GET /api/sale-orders/:id/remaining-quantity
const getSaleOrderRemainingQty = async (req, res) => {
    try {
        const soId = req.params.id;
        const userId = req.user._id;

        const so = await SaleOrder.findOne({ _id: soId, userId });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        // Find all linked documents that consumed quantity
        const siDocs = await SaleInvoice.find({
            userId,
            'conversions.convertedFrom.docId': soId
        });

        const dcDocs = await DeliveryChallan.find({
            userId,
            'conversions.convertedFrom.docId': soId,
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

        siDocs.forEach(doc => processItems(doc.items));
        dcDocs.forEach(doc => processItems(doc.items));

        const resultData = [];
        let totalItemsRemainingCount = 0;

        so.items.forEach(soItem => {
            const totalQty = Number(soItem.qty || 0);
            const usedQty = consumedQtyMap[soItem.productName] || 0;
            const remainingQty = Math.max(0, totalQty - usedQty);

            if (remainingQty > 0) {
                resultData.push({
                    productName: soItem.productName,
                    usedQty,
                    totalQty,
                    remainingQty,
                    displayFormat: `${usedQty}/${totalQty}`
                });
                totalItemsRemainingCount++;
            }
        });

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

// @desc    Setup conversion to Delivery Challan (Prefill Data)
// @route   GET /api/sale-orders/:id/convert-to-challan
const convertSOToChallanData = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        const data = so.toObject();
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
                convertedFrom: { docType: 'Sale Order', docId: so._id }
            }
        };
        res.status(200).json({ success: true, message: 'Sale Order data for Delivery Challan conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Sale Invoice (Prefill Data)
// @route   GET /api/sale-orders/:id/convert-to-invoice
const convertSOToInvoiceData = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) {
            return res.status(404).json({ success: false, message: 'Sale Order not found' });
        }

        const data = so.toObject();

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
                convertedFrom: {
                    docType: 'Sale Order',
                    docId: so._id
                }
            }
        };

        res.status(200).json({
            success: true,
            message: 'Sale Order data for conversion retrieved',
            data: mappedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Proforma Invoice (Prefill Data)
// @route   GET /api/sale-orders/:id/convert-to-proforma
const convertSOToProformaData = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        const data = so.toObject();
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
                convertedFrom: { docType: 'Sale Order', docId: so._id }
            }
        };
        res.status(200).json({ success: true, message: 'Sale Order data for Proforma conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Purchase Order (Prefill Data)
// @route   GET /api/sale-orders/:id/convert-to-purchase-order
const convertSOToPurchaseOrderData = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        const data = so.toObject();
        const mappedData = {
            vendorInformation: data.customerInformation,
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
                convertedFrom: { docType: 'Sale Order', docId: so._id }
            }
        };
        res.status(200).json({ success: true, message: 'Sale Order data for Purchase Order conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Get data for duplicating a Sale Order (Prefill Add Form)
// @route   GET /api/sale-orders/:id/duplicate
const getDuplicateSOData = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        const data = so.toObject();

        // System fields to exclude
        delete data._id;
        delete data.status;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;

        // Reset document number (will be generated anew)
        if (data.saleOrderDetails) {
            delete data.saleOrderDetails.soNumber;
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
            message: 'Sale Order data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cancel Sale Order
// @route   POST /api/sale-orders/:id/cancel
const cancelSaleOrder = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        if (so.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Sale Order is already cancelled' });
        }

        so.status = 'Cancelled';
        await so.save();

        res.status(200).json({ success: true, message: "Sale Order cancelled successfully", data: so });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Restore Sale Order
// @route   POST /api/sale-orders/:id/restore
const restoreSaleOrder = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        if (so.status !== 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Sale Order is not in Cancelled state' });
        }

        so.status = 'New';
        await so.save();

        res.status(200).json({ success: true, message: "Sale Order restored successfully", data: so });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Attachment Handlers ---

// @desc    Attach files to Sale Order
// @route   POST /api/sale-orders/:id/attach-file
const attachSaleOrderFile = async (req, res) => {
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

        const so = await SaleOrder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!so) return res.status(404).json({ success: false, message: "Sale Order not found" });

        res.status(200).json({ success: true, message: "Files attached successfully", data: so.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Sale Order Attachments
// @route   GET /api/sale-orders/:id/attachments
const getSaleOrderAttachments = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: "Sale Order not found" });
        res.status(200).json({ success: true, data: so.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update (Replace) Sale Order Attachment
// @route   PUT /api/sale-orders/:id/attachment/:attachmentId
const updateSaleOrderAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Sale Order not found" });
        }

        const attachmentIndex = so.attachments.findIndex(a => a._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Remove old file
        const oldFile = so.attachments[attachmentIndex].filePath;
        if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile); } catch (e) { console.error("Error deleting old file:", e); }
        }

        // Update metadata
        so.attachments[attachmentIndex] = {
            _id: so.attachments[attachmentIndex]._id,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        await so.save();

        res.status(200).json({ success: true, message: "Attachment replaced successfully", data: so.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Sale Order Attachment
// @route   DELETE /api/sale-orders/:id/attachment/:attachmentId
const deleteSaleOrderAttachment = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: "Sale Order not found" });

        const attachment = so.attachments.find(a => a._id.toString() === req.params.attachmentId);
        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        // Remove from disk
        if (fs.existsSync(attachment.filePath)) {
            try { fs.unlinkSync(attachment.filePath); } catch (e) { console.error("Error deleting file:", e); }
        }

        // Remove from array
        so.attachments = so.attachments.filter(a => a._id.toString() !== req.params.attachmentId);
        await so.save();

        res.status(200).json({ success: true, message: "Attachment deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Print Sale Order
// @route   GET /api/sale-orders/:id/print
const printSaleOrder = async (req, res) => {
    try {
        const so = await SaleOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!so) return res.status(404).json({ success: false, message: 'Sale Order not found' });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        // Map Sale Order to Sale Invoice template structure
        const mappedSO = so.toObject();
        mappedSO.invoiceDetails = {
            invoiceNumber: so.saleOrderDetails.soNumber,
            date: so.saleOrderDetails.date
        };

        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Sale Order', so.branch);
        const pdfBuffer = await generateSaleInvoicePDF(mappedSO, userData, options, 'Sale Order', printConfig);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=sale-order-${so.saleOrderDetails.soNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Download Sale Order PDF (Supports merged)
// @route   GET /api/sale-orders/:id/download-pdf
const downloadSaleOrderPDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const sos = await SaleOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (!sos || sos.length === 0) return res.status(404).json({ success: false, message: "Sale Order(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        // Map Sale Orders to Sale Invoice template structure
        const mappedSOs = sos.map(so => {
            const mapped = so.toObject();
            mapped.invoiceDetails = {
                invoiceNumber: so.saleOrderDetails.soNumber,
                date: so.saleOrderDetails.date
            };
            return mapped;
        });

        const pdfBuffer = await generateSaleInvoicePDF(mappedSOs, userData, options, 'Sale Order');

        const filename = sos.length === 1 ? `SaleOrder_${sos[0].saleOrderDetails.soNumber}.pdf` : `Merged_SaleOrders.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Sale Order via Email
// @route   POST /api/sale-orders/:id/share-email
const shareSaleOrderEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
        if (ids.length === 0) return res.status(400).json({ success: false, message: "Invalid ID(s) provided" });

        const sos = await SaleOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (sos.length !== ids.length) return res.status(404).json({ success: false, message: "Some Sale Order(s) not found" });

        const firstDoc = sos[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || customer?.email;

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const options = getCopyOptions(req);

        // Map Sale Orders to Sale Invoice template structure for email attachment
        const mappedSOs = sos.map(so => {
            const mapped = so.toObject();
            mapped.invoiceDetails = {
                invoiceNumber: so.saleOrderDetails.soNumber,
                date: so.saleOrderDetails.date
            };
            return mapped;
        });

        // Use sendInvoiceEmail with 'Sale Order' type
        await sendInvoiceEmail(mappedSOs, email, false, options, 'Sale Order');
        res.status(200).json({ success: true, message: `Sale Order(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Sale Order via WhatsApp
// @route   POST /api/sale-orders/:id/share-whatsapp
const shareSaleOrderWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const sos = await SaleOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (!sos || sos.length === 0) return res.status(404).json({ success: false, message: "Sale Order(s) not found" });

        const firstDoc = sos[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
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
        const publicLink = `${req.protocol}://${req.get('host')}/api/sale-orders/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (sos.length === 1) {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your Sale Order No: ${firstDoc.saleOrderDetails.soNumber} for Total Amount: ${firstDoc.totals.grandTotal.toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your merged Sale Orders for Total Amount: ${sos.reduce((sum, q) => sum + q.totals.grandTotal, 0).toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
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
// @route   GET /api/sale-orders/:id/public-link
const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const sos = await SaleOrder.find({ _id: { $in: ids }, userId: req.user._id });
        if (!sos || sos.length === 0) return res.status(404).json({ success: false, message: "Sale Order(s) not found" });

        const token = generatePublicToken(req.params.id);
        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/sale-orders/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    View Sale Order Publicly
// @route   GET /api/sale-orders/view-public/:id/:token
const viewSaleOrderPublic = async (req, res) => {
    try {
        const { id, token } = req.params;
        const generatedToken = generatePublicToken(id);

        if (token !== generatedToken) {
            return res.status(403).send('Invalid or expired link');
        }

        const ids = id.split(',');
        const sos = await SaleOrder.find({ _id: { $in: ids } });
        if (!sos || sos.length === 0) return res.status(404).send('Sale Order not found');

        const userData = await User.findById(sos[0].userId);
        const options = getCopyOptions(req);

        // Map Sale Orders to Sale Invoice template structure
        const mappedSOs = sos.map(so => {
            const mapped = so.toObject();
            mapped.invoiceDetails = {
                invoiceNumber: so.saleOrderDetails.soNumber,
                date: so.saleOrderDetails.date
            };
            return mapped;
        });

        const pdfBuffer = await generateSaleInvoicePDF(mappedSOs, userData, options, 'Sale Order');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=sale-order.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = {
    createSaleOrder,
    getSaleOrders,
    getSaleOrderSummary,
    getSaleOrderById,
    updateSaleOrder,
    deleteSaleOrder,
    updateSaleOrderStatus,
    searchSaleOrders,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    getSaleOrderRemainingQty,
    convertSOToChallanData,
    convertSOToInvoiceData,
    convertSOToProformaData,
    convertSOToPurchaseOrderData,
    getDuplicateSOData,
    cancelSaleOrder,
    restoreSaleOrder,
    attachSaleOrderFile,
    getSaleOrderAttachments,
    updateSaleOrderAttachment,
    deleteSaleOrderAttachment,
    printSaleOrder,
    downloadSaleOrderPDF,
    shareSaleOrderEmail,
    shareSaleOrderWhatsApp,
    generatePublicLink,
    viewSaleOrderPublic
};
