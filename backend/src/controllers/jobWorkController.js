const JobWork = require('../models/JobWork');
const Staff = require('../models/Staff');
const Customer = require('../models/Customer');
const { calculateShippingDistance } = require('../utils/shippingHelper');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation } = require('../utils/documentHelper');
const numberToWords = require('../utils/numberToWords');

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

        // 🔹 Generate Job Work Number
        const jobWorkNumber = await generateJobWorkNumber(req.user._id);
        jobWorkDetails.jobWorkNumber = jobWorkNumber;

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
        if (status) {
            const statusMap = {
                'new': 'PENDING',
                'pending': 'PENDING',
                'in-work': 'IN PROGRESS',
                'completed': 'COMPLETED'
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
        const data = await getSummaryAggregation(req.user._id, query, JobWork);
        res.status(200).json({ success: true, data });
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

module.exports = {
    createJobWork,
    getJobWorks,
    getJobWorkById,
    updateJobWork,
    deleteJobWork,
    getJobWorkSummary,
    searchJobWorks
};
