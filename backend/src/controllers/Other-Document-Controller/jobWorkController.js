const JobWork = require('../../models/Other-Document-Model/JobWork');
const Staff = require('../../models/Setting-Model/Staff');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation, getSelectedPrintTemplate } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const DeliveryChallan = require('../../models/Other-Document-Model/DeliveryChallan');
const { generateJobWorkPDF } = require('../../utils/jobWorkPdfHelper');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
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

/**
 * Generate unique Job Work Number (user-wise)
 * Format: JW-00001
 */
const generateJobWorkNumber = async (userId) => {
    const lastJobWork = await JobWork.findOne({ userId })
        .sort({ createdAt: -1 })
        .select('jobWorkDetails.jobWorkNumber');

    let nextNumber = 1;

    if (lastJobWork?.jobWorkDetails?.jobWorkNumber) {
        const match = lastJobWork.jobWorkDetails.jobWorkNumber.match(/\d+$/);
        if (match) {
            nextNumber = parseInt(match[0], 10) + 1;
        }
    }

    return `JW-${String(nextNumber).padStart(5, '0')}`;
};

/**
 * Build search query
 */
const buildJobWorkQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, customerName,
        fromDate, toDate,
        status,
        jobWorkNumber,
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return query;

    if (search) {
        query.$or = [
            { 'customerInformation.ms': { $regex: search, $options: 'i' } },
            { 'jobWorkDetails.jobWorkNumber': { $regex: search, $options: 'i' } },
            { documentRemarks: { $regex: search, $options: 'i' } },
            { 'items.productName': { $regex: search, $options: 'i' } }
        ];
    }

    if (company || customerName) {
        query['customerInformation.ms'] = { $regex: company || customerName, $options: 'i' };
    }

    if (jobWorkNumber) {
        query['jobWorkDetails.jobWorkNumber'] = { $regex: jobWorkNumber, $options: 'i' };
    }

    if (status) {
        query['jobWorkDetails.status'] = status;
    }

    if (fromDate || toDate) {
        query['jobWorkDetails.date'] = {};
        if (fromDate) query['jobWorkDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['jobWorkDetails.date'].$lte = end;
        }
    }

    for (const key in otherFilters) {
        if (key.startsWith('cf_')) {
            const fieldId = key.replace('cf_', '');
            query[`customFields.${fieldId}`] = otherFilters[key];
        }
    }

    return query;
};

/**
 * CREATE JOB WORK
 */
const createJobWork = async (req, res) => {
    try {
        const {
            customerInformation,
            jobWorkDetails = {},
            shippingAddress,
            useSameShippingAddress,
            items,
            additionalCharges,
            branch,
            staff,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            shareOnEmail,
            customFields
        } = req.body;

        const effectiveBranch = branch && branch.state ? branch : (branch?._id || branch);
        const calculationBranchId = (effectiveBranch && effectiveBranch.state) ? effectiveBranch : (effectiveBranch && mongoose.Types.ObjectId.isValid(effectiveBranch) ? effectiveBranch : null);

        // 🔹 Resolve shipping address
        let finalShippingAddress = {};

        if (useSameShippingAddress === true) {
            finalShippingAddress = {
                street: customerInformation?.address || '',
                city: customerInformation?.city || '',
                state: customerInformation?.state || '',
                country: customerInformation?.country || 'India',
                pincode: customerInformation?.pincode || ''
            };
        } else {
            finalShippingAddress = shippingAddress || {};
        }

        // 🔹 Calculate distance
        if (finalShippingAddress?.pincode) {
            const distance = await calculateShippingDistance(
                req.user._id,
                finalShippingAddress,
                calculationBranchId
            );
            finalShippingAddress.distance = distance;
        } else {
            finalShippingAddress.distance = 0;
        }

        // 🔹 Generate Job Work Number if not provided
        if (!jobWorkDetails.jobWorkNumber) {
            const jobWorkNumber = await generateJobWorkNumber(req.user._id);
            jobWorkDetails.jobWorkNumber = jobWorkNumber;
        }

        // No Map conversion needed, using plain objects
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges: additionalCharges
        }, calculationBranchId);

        // Use top-level customFields as is (plain object)
        let parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields || {};

        const newJobWork = new JobWork({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            jobWorkDetails,
            items: calculationResults.items,
            totals: calculationResults.totals,
            additionalCharges: additionalCharges || [],
            staff,
            branch: effectiveBranch,
            bankDetails,
            termsTitle,
            termsDetails: Array.isArray(termsDetails) ? termsDetails : (termsDetails ? [termsDetails] : []),
            documentRemarks,
            shareOnEmail,
            customFields: parsedCustomFields
        });

        await newJobWork.save();

        res.status(201).json({
            success: true,
            message: 'Job Work created successfully',
            data: newJobWork
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Job Work number must be unique'
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Search Job Works
// @route   GET /api/job-work/search
const searchJobWorks = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            search,
            company, customerName,
            product, productName,
            productGroup,
            fromDate, toDate,
            staffName,
            jobWorkNumber,
            total,
            lrNo,
            itemNote,
            remarks,
            gstin,
            status,
            jobWorkType,
            shippingAddress,
            advanceFilters, // Array of { field, operator, value }
            page = 1, limit = 10, sort = 'createdAt', order = 'desc'
        } = req.query;

        let query = { userId };

        // 1. Keyword Search ($or)
        if (search) {
            query.$or = [
                { 'customerInformation.ms': { $regex: search, $options: 'i' } },
                { 'jobWorkDetails.jobWorkNumber': { $regex: search, $options: 'i' } },
                { documentRemarks: { $regex: search, $options: 'i' } },
                { 'items.productName': { $regex: search, $options: 'i' } }
            ];
        }

        // 2. Specific Filters ($and)
        const andFilters = [];

        if (company || customerName) {
            andFilters.push({ 'customerInformation.ms': { $regex: company || customerName, $options: 'i' } });
        }

        if (product || productName) {
            andFilters.push({ 'items.productName': { $regex: product || productName, $options: 'i' } });
        }

        if (productGroup) {
            andFilters.push({ 'items.productGroup': { $regex: productGroup, $options: 'i' } });
        }

        if (jobWorkNumber) {
            andFilters.push({ 'jobWorkDetails.jobWorkNumber': { $regex: jobWorkNumber, $options: 'i' } });
        }

        if (remarks) {
            andFilters.push({ documentRemarks: { $regex: remarks, $options: 'i' } });
        }

        if (gstin) {
            andFilters.push({ 'customerInformation.gstinPan': { $regex: gstin, $options: 'i' } });
        }

        if (itemNote) {
            andFilters.push({ 'items.itemNote': { $regex: itemNote, $options: 'i' } });
        }

        // Status Mapping
        // Status Mapping
        if (status) {
            const statusMap = {
                'new': 'New',
                'pending': 'Pending',
                'in-work': 'In-Work',
                'completed': 'Completed',
                'cancelled': 'Cancelled'
            };
            const dbStatus = statusMap[status.toLowerCase()] || status;
            andFilters.push({ 'jobWorkDetails.status': dbStatus });
        }

        // Job Work Type Mapping (if exists in data)
        if (jobWorkType) {
            andFilters.push({ 'jobWorkDetails.type': jobWorkType });
        }

        // Date Range
        if (fromDate || toDate) {
            const dateQuery = {};
            if (fromDate) dateQuery.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                dateQuery.$lte = end;
            }
            andFilters.push({ 'jobWorkDetails.date': dateQuery });
        }

        // Total
        if (total) {
            andFilters.push({ 'totals.grandTotal': Number(total) });
        }

        // staffName resolution
        if (staffName) {
            const staffs = await Staff.find({
                ownerRef: userId,
                fullName: { $regex: staffName, $options: 'i' }
            }).select('_id');
            andFilters.push({ staff: { $in: staffs.map(s => s._id) } });
        }

        // LR No (from customFields if specified)
        if (lrNo) {
            // User requested mapping: lrNo -> customFields.lr_no
            andFilters.push({ 'customFields.lr_no': { $regex: lrNo, $options: 'i' } });
        }

        // Shipping Address
        if (shippingAddress) {
            andFilters.push({
                $or: [
                    { 'shippingAddress.street': { $regex: shippingAddress, $options: 'i' } },
                    { 'shippingAddress.city': { $regex: shippingAddress, $options: 'i' } },
                    { 'shippingAddress.state': { $regex: shippingAddress, $options: 'i' } }
                ]
            });
        }

        // 3. Advance Filters Array
        let parsedAdvanceFilters = advanceFilters;
        if (typeof advanceFilters === 'string') {
            try { parsedAdvanceFilters = JSON.parse(advanceFilters); } catch (e) { parsedAdvanceFilters = []; }
        }

        if (Array.isArray(parsedAdvanceFilters)) {
            parsedAdvanceFilters.forEach(af => {
                if (af.field && af.operator) {
                    const condition = {};
                    let val = af.value;

                    switch (af.operator) {
                        case 'equals': condition[af.field] = val; break;
                        case 'contains': condition[af.field] = { $regex: val, $options: 'i' }; break;
                        case 'startsWith': condition[af.field] = { $regex: '^' + val, $options: 'i' }; break;
                        case 'endsWith': condition[af.field] = { $regex: val + '$', $options: 'i' }; break;
                        case 'gt': condition[af.field] = { $gt: isNaN(val) ? val : Number(val) }; break;
                        case 'lt': condition[af.field] = { $lt: isNaN(val) ? val : Number(val) }; break;
                        case 'between':
                            if (val && typeof val === 'string' && val.includes(',')) {
                                const [v1, v2] = val.split(',').map(v => isNaN(v.trim()) ? v.trim() : Number(v.trim()));
                                condition[af.field] = { $gte: v1, $lte: v2 };
                            }
                            break;
                        case 'in':
                            if (Array.isArray(val)) {
                                condition[af.field] = { $in: val };
                            } else if (typeof val === 'string') {
                                condition[af.field] = { $in: val.split(',').map(v => v.trim()) };
                            }
                            break;
                    }
                    if (Object.keys(condition).length > 0) andFilters.push(condition);
                }
            });
        }

        if (andFilters.length > 0) {
            query.$and = andFilters;
        }

        const skip = (page - 1) * limit;
        const results = await JobWork.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName')
            .populate('branch', 'name');

        const totalCount = await JobWork.countDocuments(query);

        res.status(200).json({
            success: true,
            data: results,
            pagination: {
                total: totalCount,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET ALL JOB WORKS
 */
const getJobWorks = async (req, res) => {
    try {
        const query = await buildJobWorkQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;

        const jobWorks = await JobWork.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName')
            .populate('branch', 'name');

        const total = await JobWork.countDocuments(query);

        res.status(200).json({
            success: true,
            count: jobWorks.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: jobWorks
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET SINGLE JOB WORK
 */
const getJobWorkById = async (req, res) => {
    try {
        const jobWork = await JobWork.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('staff', 'fullName')
            .populate('branch', 'name');

        if (!jobWork) {
            return res.status(404).json({ success: false, message: 'Job Work not found' });
        }

        res.status(200).json({ success: true, data: jobWork });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * UPDATE JOB WORK
 */
const updateJobWork = async (req, res) => {
    try {
        const { id } = req.params;
        const currentJW = await JobWork.findOne({ _id: id, userId: req.user._id });

        if (!currentJW) {
            return res.status(404).json({ success: false, message: 'Job Work not found' });
        }

        const {
            customerInformation,
            jobWorkDetails,
            shippingAddress,
            useSameShippingAddress,
            items,
            additionalCharges,
            branch,
            staff,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            shareOnEmail,
            customFields
        } = req.body;

        const effectiveBranch = branch !== undefined
            ? (branch && branch.state ? branch : (branch?._id || branch))
            : currentJW.branch;

        const calculationBranchId = (effectiveBranch && effectiveBranch.state)
            ? effectiveBranch
            : (effectiveBranch && mongoose.Types.ObjectId.isValid(effectiveBranch) ? effectiveBranch : null);

        // 🔹 Recalculate shipping address & distance if needed
        if (shippingAddress || useSameShippingAddress !== undefined || customerInformation || branch !== undefined) {
            let finalShippingAddress = shippingAddress || currentJW.shippingAddress || {};

            if (useSameShippingAddress === true || (useSameShippingAddress === undefined && currentJW.useSameShippingAddress)) {
                const info = customerInformation || currentJW.customerInformation;
                finalShippingAddress = {
                    street: info?.address || '',
                    city: info?.city || '',
                    state: info?.state || '',
                    country: info?.country || 'India',
                    pincode: info?.pincode || ''
                };
            }

            if (finalShippingAddress?.pincode) {
                const distance = await calculateShippingDistance(
                    req.user._id,
                    finalShippingAddress,
                    calculationBranchId
                );
                finalShippingAddress.distance = distance;
            }
            req.body.shippingAddress = finalShippingAddress;
        }

        // 🔹 Recalculate Totals
        if (items || customerInformation || additionalCharges || branch !== undefined) {
            let itemsToCalculate = items || currentJW.items;
            if (typeof itemsToCalculate === 'string') itemsToCalculate = JSON.parse(itemsToCalculate);

            const calculationResults = await calculateDocumentTotals(req.user._id, {
                customerInformation: customerInformation || currentJW.customerInformation,
                items: itemsToCalculate,
                additionalCharges: additionalCharges || currentJW.additionalCharges
            }, calculationBranchId);

            req.body.items = calculationResults.items;
            req.body.totals = calculationResults.totals;
        }

        // 🔹 Handle top-level customFields
        if (customFields !== undefined) {
            req.body.customFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
        }

        // 🔹 Handle termsDetails
        if (termsDetails !== undefined) {
            req.body.termsDetails = Array.isArray(termsDetails) ? termsDetails : (termsDetails ? [termsDetails] : []);
        }

        // Ensure branch is correctly saved
        if (branch !== undefined) {
            req.body.branch = effectiveBranch;
        }

        const updatedJobWork = await JobWork.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Job Work updated successfully',
            data: updatedJobWork
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET JOB WORK SUMMARY
 */
const getJobWorkSummary = async (req, res) => {
    try {
        const query = await buildJobWorkQuery(req.user._id, req.query);
        const summary = await getSummaryAggregation(req.user._id, query, JobWork);

        // Fetch status counts specifically for Job Work
        // Dynamic approach: Pending = Not Completed AND Not Cancelled
        const pendingCount = await JobWork.countDocuments({
            ...query,
            'jobWorkDetails.status': { $nin: ['Completed', 'Cancelled'] }
        });
        const completedCount = await JobWork.countDocuments({
            ...query,
            'jobWorkDetails.status': 'Completed'
        });

        res.status(200).json({
            success: true,
            data: {
                ...summary,
                pendingCount,
                completedCount
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE JOB WORK
 */
const deleteJobWork = async (req, res) => {
    try {
        const jobWork = await JobWork.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!jobWork) {
            return res.status(404).json({ success: false, message: 'Job Work not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Job Work deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Job Work Status
// @route   PATCH /api/job-works/:id/status
const updateJobWorkStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

        // Validated against user settings in frontend/service layer if needed
        // Allowing dynamic string to support custom statuses

        const jobWork = await JobWork.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $set: { 'jobWorkDetails.status': status } },
            { new: true } // Removed runValidators to prevent legacy data from blocking updates
        );

        if (!jobWork) {
            return res.status(404).json({ success: false, message: 'Job Work not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Status updated successfully',
            data: { status: jobWork.jobWorkDetails.status }
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Remaining Quantity for Job Work items
// @route   GET /api/job-works/:id/remaining-quantity
const getJobWorkRemainingQty = async (req, res) => {
    try {
        const jwId = req.params.id;
        const userId = req.user._id;

        const jw = await JobWork.findOne({ _id: jwId, userId });
        if (!jw) return res.status(404).json({ success: false, message: 'Job Work not found' });

        // Find all linked documents that consumed quantity
        const siDocs = await SaleInvoice.find({
            userId,
            'conversions.convertedFrom.docId': jwId
        });

        const dcDocs = await DeliveryChallan.find({
            userId,
            'conversions.convertedFrom.docId': jwId,
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

        jw.items.forEach(jwItem => {
            const totalQty = Number(jwItem.qty || 0);
            const usedQty = consumedQtyMap[jwItem.productName] || 0;
            const remainingQty = Math.max(0, totalQty - usedQty);

            if (remainingQty > 0) {
                resultData.push({
                    productName: jwItem.productName,
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

// @desc    Setup conversion to Delivery Challan (Prefill Data)
// @route   GET /api/job-works/:id/convert-to-challan
const convertJWToChallanData = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) return res.status(404).json({ success: false, message: 'Job Work not found' });

        const data = jw.toObject();
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
                convertedFrom: { docType: 'Job Work', docId: jw._id }
            }
        };
        res.status(200).json({ success: true, message: 'Job Work data for Delivery Challan conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Sale Invoice (Prefill Data)
// @route   GET /api/job-works/:id/convert-to-invoice
const convertJWToInvoiceData = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) {
            return res.status(404).json({ success: false, message: 'Job Work not found' });
        }

        const data = jw.toObject();

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
            paymentType: data.paymentType || 'CREDIT', // Default if missing in JW
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: {
                    docType: 'Job Work',
                    docId: jw._id
                }
            }
        };

        res.status(200).json({
            success: true,
            message: 'Job Work data for conversion retrieved',
            data: mappedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Sale Order (Prefill Data)
// @route   GET /api/job-works/:id/convert-to-sale-order
const convertJWToSaleOrderData = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) {
            return res.status(404).json({ success: false, message: 'Job Work not found' });
        }

        const data = jw.toObject();

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
                discount: item.discount,
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
                convertedFrom: {
                    docType: 'Job Work',
                    docId: jw._id
                }
            }
        };

        res.status(200).json({
            success: true,
            message: 'Job Work data for Sale Order conversion retrieved',
            data: mappedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Quotation (Prefill Data)
// @route   GET /api/job-works/:id/convert-to-quotation
const convertJWToQuotationData = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) {
            return res.status(404).json({ success: false, message: 'Job Work not found' });
        }

        const data = jw.toObject();

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
                discount: item.discount,
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: (item.price || 0) * (item.qty || 0),
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
                convertedFrom: {
                    docType: 'Job Work',
                    docId: jw._id
                }
            }
        };

        res.status(200).json({
            success: true,
            message: 'Job Work data for Quotation conversion retrieved',
            data: mappedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get data for duplicating a Job Work (Prefill Add Form)
// @route   GET /api/job-works/:id/duplicate
const getDuplicateJobWorkData = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) return res.status(404).json({ success: false, message: 'Job Work not found' });

        const data = jw.toObject();

        // System fields to exclude
        delete data._id;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;

        // Reset document number (will be generated anew)
        if (data.jobWorkDetails) {
            delete data.jobWorkDetails.jobWorkNumber;
            delete data.jobWorkDetails.status; // Consistency with SO duplicate
        }

        // Linked references to exclude (consistency with SO duplicate)
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
            message: 'Job Work data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Attachment Handlers ---

// @desc    Attach files to Job Work
// @route   POST /api/job-works/:id/attach-file
const attachJobWorkFile = async (req, res) => {
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

        const jw = await JobWork.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!jw) return res.status(404).json({ success: false, message: "Job Work not found" });

        res.status(200).json({ success: true, message: "Files attached successfully", data: jw.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Job Work Attachments
// @route   GET /api/job-works/:id/attachments
const getJobWorkAttachments = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) return res.status(404).json({ success: false, message: "Job Work not found" });
        res.status(200).json({ success: true, data: jw.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update (Replace) Job Work Attachment
// @route   PUT /api/job-works/:id/attachment/:attachmentId
const updateJobWorkAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Job Work not found" });
        }

        const attachmentIndex = jw.attachments.findIndex(a => a._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Remove old file
        const oldFile = jw.attachments[attachmentIndex].filePath;
        if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile); } catch (e) { console.error("Error deleting old file:", e); }
        }

        // Update metadata
        jw.attachments[attachmentIndex] = {
            _id: jw.attachments[attachmentIndex]._id,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        await jw.save();

        res.status(200).json({ success: true, message: "Attachment replaced successfully", data: jw.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Job Work Attachment
// @route   DELETE /api/job-works/:id/attachment/:attachmentId
const deleteJobWorkAttachment = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) return res.status(404).json({ success: false, message: "Job Work not found" });

        const attachment = jw.attachments.find(a => a._id.toString() === req.params.attachmentId);
        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        // Remove from disk
        if (fs.existsSync(attachment.filePath)) {
            try { fs.unlinkSync(attachment.filePath); } catch (e) { console.error("Error deleting file:", e); }
        }

        // Remove from array
        jw.attachments = jw.attachments.filter(a => a._id.toString() !== req.params.attachmentId);
        await jw.save();

        res.status(200).json({ success: true, message: "Attachment deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Print Job Work
// @route   GET /api/job-works/:id/print
const printJobWork = async (req, res) => {
    try {
        const jw = await JobWork.findOne({ _id: req.params.id, userId: req.user._id });
        if (!jw) return res.status(404).json({ success: false, message: 'Job Work not found' });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        // Map Job Work to template structure
        const mappedJW = jw.toObject();
        mappedJW.jobWorkDetails = {
            jobWorkNumber: jw.jobWorkDetails.jobWorkNumber,
            date: jw.jobWorkDetails.date
        };

        const pdfBuffer = await generateJobWorkPDF(mappedJW, userData, options);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=job-work-${jw.jobWorkDetails.jobWorkNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Download Job Work PDF (Supports merged)
// @route   GET /api/job-works/:id/download-pdf
const downloadJobWorkPDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const jws = await JobWork.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!jws || jws.length === 0) return res.status(404).json({ success: false, message: "Job Work(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        // Map Job Works to template structure
        const mappedJWs = jws.map(jw => {
            const mapped = jw.toObject();
            mapped.jobWorkDetails = {
                jobWorkNumber: jw.jobWorkDetails.jobWorkNumber,
                date: jw.jobWorkDetails.date
            };
            return mapped;
        });

        const pdfBuffer = await generateJobWorkPDF(mappedJWs, userData, options);

        const filename = jws.length === 1 ? `JobWork_${jws[0].jobWorkDetails.jobWorkNumber}.pdf` : `Merged_JobWorks.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Job Work via Email
// @route   POST /api/job-works/:id/share-email
const shareJobWorkEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
        if (ids.length === 0) return res.status(400).json({ success: false, message: "Invalid ID(s) provided" });

        const jws = await JobWork.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (jws.length !== ids.length) return res.status(404).json({ success: false, message: "Some Job Work(s) not found" });

        const firstDoc = jws[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || customer?.email;

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const options = getCopyOptions(req);

        // Map Job Works to template structure for email attachment
        const mappedJWs = jws.map(jw => {
            const mapped = jw.toObject();
            mapped.jobWorkDetails = {
                jobWorkNumber: jw.jobWorkDetails.jobWorkNumber,
                date: jw.jobWorkDetails.date
            };
            return mapped;
        });

        await sendInvoiceEmail(mappedJWs, email, false, options, 'Job Work');
        res.status(200).json({ success: true, message: `Job Work(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Share Job Work via WhatsApp
// @route   POST /api/job-works/:id/share-whatsapp
const shareJobWorkWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const jws = await JobWork.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!jws || jws.length === 0) return res.status(404).json({ success: false, message: "Job Work(s) not found" });

        const firstDoc = jws[0];
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
        const publicLink = `${req.protocol}://${req.get('host')}/api/job-works/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (jws.length === 1) {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your Job Work No: ${firstDoc.jobWorkDetails.jobWorkNumber} for Total Amount: ${firstDoc.totals.grandTotal.toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your merged Job Works for Total Amount: ${jws.reduce((sum, q) => sum + q.totals.grandTotal, 0).toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
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
// @route   GET /api/job-works/:id/public-link
const generateJobWorkPublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const jws = await JobWork.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!jws || jws.length === 0) return res.status(404).json({ success: false, message: "Job Work(s) not found" });

        const token = generatePublicToken(req.params.id);
        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/job-works/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    View Job Work Publicly
// @route   GET /api/job-works/view-public/:id/:token
const viewJobWorkPublic = async (req, res) => {
    try {
        const { id, token } = req.params;
        const generatedToken = generatePublicToken(id);

        if (token !== generatedToken) {
            return res.status(403).send('Invalid or expired link');
        }

        const ids = id.split(',');
        const jws = await JobWork.find({ _id: { $in: ids } }).sort({ createdAt: 1 });
        if (!jws || jws.length === 0) return res.status(404).send('Job Work not found');

        const userData = await User.findById(jws[0].userId);
        const options = getCopyOptions(req);

        // Map Job Works to template structure
        const mappedJWs = jws.map(jw => {
            const mapped = jw.toObject();
            mapped.jobWorkDetails = {
                jobWorkNumber: jw.jobWorkDetails.jobWorkNumber,
                date: jw.jobWorkDetails.date
            };
            return mapped;
        });

        const pdfBuffer = await generateJobWorkPDF(mappedJWs, userData, options);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=job-work.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = {
    createJobWork,
    getJobWorks,
    getJobWorkById,
    updateJobWork,
    deleteJobWork,
    getJobWorkSummary,
    searchJobWorks,
    updateJobWorkStatus,
    getJobWorkRemainingQty,
    convertJWToChallanData,
    convertJWToInvoiceData,
    convertJWToSaleOrderData,
    convertJWToQuotationData,
    getDuplicateJobWorkData,
    attachJobWorkFile,
    getJobWorkAttachments,
    updateJobWorkAttachment,
    deleteJobWorkAttachment,
    printJobWork,
    downloadJobWorkPDF,
    shareJobWorkEmail,
    shareJobWorkWhatsApp,
    generateJobWorkPublicLink,
    viewJobWorkPublic
};
