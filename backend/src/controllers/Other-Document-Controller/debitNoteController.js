const DebitNote = require('../../models/Other-Document-Model/DebitNote');
const { calculateDocumentTotals, getSummaryAggregation } = require('../../utils/documentHelper');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const mongoose = require('mongoose');

// Generate Debit Note Number (following same pattern as Credit Note)
const generateDebitNoteNumber = async (userId) => {
    const lastDN = await DebitNote.findOne({ userId }).sort({ createdAt: -1 });
    if (!lastDN || !lastDN.debitNoteDetails?.dnNumber) {
        return 'DN-0001';
    }
    const lastNumber = parseInt(lastDN.debitNoteDetails.dnNumber.split('-')[1]) || 0;
    return `DN-${String(lastNumber + 1).padStart(4, '0')}`;
};

/**
 * @desc    Create Debit Note
 * @route   POST /api/debit-note
 */
const createDebitNote = async (req, res) => {
    try {
        const {
            customerInformation,
            debitNoteDetails = {},
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

        // 🔹 Generate Debit Note Number if not provided
        if (!debitNoteDetails.dnNumber) {
            const dnNumber = await generateDebitNoteNumber(req.user._id);
            debitNoteDetails.dnNumber = dnNumber;
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

        const newDebitNote = new DebitNote({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            debitNoteDetails,
            items: calculationResults.items,
            totals: {
                ...calculationResults.totals,
                totalDebitValue: calculationResults.totals.grandTotal
            },
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

        await newDebitNote.save();

        res.status(201).json({
            success: true,
            message: 'Debit Note created successfully',
            data: newDebitNote
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Debit Note number must be unique'
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all Debit Notes
 * @route   GET /api/debit-note
 */
const getDebitNotes = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;

        const query = { userId: req.user._id };
        const total = await DebitNote.countDocuments(query);

        const debitNotes = await DebitNote.find(query)
            .populate('staff', 'fullName')
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: debitNotes
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Debit Note by ID
 * @route   GET /api/debit-note/:id
 */
const getDebitNoteById = async (req, res) => {
    try {
        const debitNote = await DebitNote.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('staff', 'fullName');

        if (!debitNote) {
            return res.status(404).json({
                success: false,
                message: 'Debit Note not found'
            });
        }

        res.status(200).json({
            success: true,
            data: debitNote
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Debit Note
 * @route   PUT /api/debit-note/:id
 */
const updateDebitNote = async (req, res) => {
    try {
        const {
            customerInformation,
            debitNoteDetails,
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

        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges: additionalCharges
        }, calculationBranchId);

        let parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields || {};

        const updatedDebitNote = await DebitNote.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            {
                customerInformation,
                useSameShippingAddress,
                shippingAddress: finalShippingAddress,
                debitNoteDetails,
                items: calculationResults.items,
                totals: {
                    ...calculationResults.totals,
                    totalDebitValue: calculationResults.totals.grandTotal
                },
                additionalCharges: additionalCharges || [],
                staff,
                branch: effectiveBranch,
                bankDetails,
                termsTitle,
                termsDetails: Array.isArray(termsDetails) ? termsDetails : (termsDetails ? [termsDetails] : []),
                documentRemarks,
                shareOnEmail,
                customFields: parsedCustomFields
            },
            { new: true, runValidators: true }
        );

        if (!updatedDebitNote) {
            return res.status(404).json({
                success: false,
                message: 'Debit Note not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Debit Note updated successfully',
            data: updatedDebitNote
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Debit Note
 * @route   DELETE /api/debit-note/:id
 */
const deleteDebitNote = async (req, res) => {
    try {
        const debitNote = await DebitNote.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!debitNote) {
            return res.status(404).json({
                success: false,
                message: 'Debit Note not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Debit Note deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Search Debit Notes
 * @route   GET /api/debit-note/search
 */
const searchDebitNotes = async (req, res) => {
    try {
        const userId = req.user._id;
        const Staff = require('../models/Staff');
        const {
            search,
            company, customerName,
            product, productName,
            productGroup,
            fromDate, toDate,
            staffName,
            dnNumber, debitNoteNumber,
            minTotal, maxTotal,
            lrNo, eWayBill,
            itemNote,
            remarks,
            gstin,
            dnType, debitNoteType,
            docType,
            shippingAddress,
            advField, advOperator, advValue,
            page = 1, limit = 10, sort = 'createdAt', order = 'desc'
        } = req.query;

        // Safeguard: Ensure userId is valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Build query using $and to properly combine userId with other conditions
        const andConditions = [
            { userId: new mongoose.Types.ObjectId(userId) }
        ];

        // 1. Keyword Search ($or) - only if search has value
        if (search && search.trim()) {
            const searchTerm = search.trim();

            // Build $or conditions with existence checks
            const orConditions = [];

            // Always search in company name
            orConditions.push({ 'customerInformation.ms': { $regex: searchTerm, $options: 'i' } });

            // Always search in D.N. number
            orConditions.push({ 'debitNoteDetails.dnNumber': { $regex: searchTerm, $options: 'i' } });

            // Search in documentRemarks only if it exists
            orConditions.push({
                $and: [
                    { documentRemarks: { $exists: true, $ne: null, $ne: '' } },
                    { documentRemarks: { $regex: searchTerm, $options: 'i' } }
                ]
            });

            // Search in items array using $elemMatch
            orConditions.push({
                items: {
                    $elemMatch: {
                        productName: { $regex: searchTerm, $options: 'i' }
                    }
                }
            });

            orConditions.push({
                items: {
                    $elemMatch: {
                        itemNote: { $exists: true, $ne: null, $ne: '' },
                        itemNote: { $regex: searchTerm, $options: 'i' }
                    }
                }
            });

            andConditions.push({ $or: orConditions });
        }

        // 2. Specific Filters
        // Company filter - defensive check for empty values
        if ((company && company.trim()) || (customerName && customerName.trim())) {
            const companyValue = (company || customerName).trim();
            andConditions.push({ 'customerInformation.ms': { $regex: companyValue, $options: 'i' } });
        }

        // Product filter - defensive check
        if ((product && product.trim()) || (productName && productName.trim())) {
            const productValue = (product || productName).trim();
            andConditions.push({ items: { $elemMatch: { productName: { $regex: productValue, $options: 'i' } } } });
        }

        // Product Group filter
        if (productGroup && productGroup.trim()) {
            andConditions.push({ items: { $elemMatch: { productGroup: { $regex: productGroup.trim(), $options: 'i' } } } });
        }

        // D.N. Number filter
        if ((dnNumber && dnNumber.trim()) || (debitNoteNumber && debitNoteNumber.trim())) {
            const dnNo = (dnNumber || debitNoteNumber).trim();
            // Search in combined prefix-number-postfix or just number
            andConditions.push({
                $or: [
                    { 'debitNoteDetails.dnNumber': { $regex: dnNo, $options: 'i' } },
                    { 'debitNoteDetails.dnPrefix': { $regex: dnNo, $options: 'i' } },
                    { 'debitNoteDetails.dnPostfix': { $regex: dnNo, $options: 'i' } }
                ]
            });
        }

        // Remarks filter
        if (remarks && remarks.trim()) {
            andConditions.push({ documentRemarks: { $regex: remarks.trim(), $options: 'i' } });
        }

        // GSTIN filter
        if (gstin && gstin.trim()) {
            andConditions.push({ 'customerInformation.gstinPan': { $regex: gstin.trim(), $options: 'i' } });
        }

        // Item Note filter
        if (itemNote && itemNote.trim()) {
            andConditions.push({ items: { $elemMatch: { itemNote: { $regex: itemNote.trim(), $options: 'i' } } } });
        }

        // Debit Note Type (enum filter)
        if ((dnType && dnType.trim()) || (debitNoteType && debitNoteType.trim())) {
            const typeValue = (dnType || debitNoteType).trim().toLowerCase();
            const typeMap = {
                'goods return': 'goods return',
                'discount after save': 'discount after save',
                'correction in invoice': 'correction in invoice'
            };
            andConditions.push({ 'debitNoteDetails.dnType': typeMap[typeValue] || (dnType || debitNoteType).trim() });
        }

        // Doc Type (enum filter)
        if (docType && docType.trim()) {
            const docTypeValue = docType.trim().toLowerCase();
            const docTypeMap = {
                'regular': 'regular',
                'bill of supply': 'bill of supply',
                'sez debit note (with igst)': 'sez debit note (with IGST)',
                'sez debit note (without igst)': 'sez debit note (without IGST)',
                'export debit(with igst)': 'export debit(with IGST)',
                'export debit(without igst)': 'export debit(without IGST)'
            };
            andConditions.push({ 'debitNoteDetails.docType': docTypeMap[docTypeValue] || docType.trim() });
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
            andConditions.push({ 'debitNoteDetails.dnDate': dateQuery });
        }

        // Total Range
        if (minTotal || maxTotal) {
            const totalQuery = {};
            if (minTotal) totalQuery.$gte = Number(minTotal);
            if (maxTotal) totalQuery.$lte = Number(maxTotal);
            andConditions.push({ 'totals.grandTotal': totalQuery });
        }

        // staffName resolution
        if (staffName && staffName.trim()) {
            const staffs = await Staff.find({
                ownerRef: userId,
                fullName: { $regex: staffName.trim(), $options: 'i' }
            }).select('_id');
            if (staffs.length > 0) {
                andConditions.push({ staff: { $in: staffs.map(s => s._id) } });
            }
        }

        // LR No (from customFields)
        if (lrNo && lrNo.trim()) {
            andConditions.push({ 'customFields.lr_no': { $regex: lrNo.trim(), $options: 'i' } });
        }

        // E-Way Bill (three modes: without, with, cancelled)
        if (eWayBill && eWayBill.trim()) {
            const eWayMode = eWayBill.trim().toLowerCase();
            if (eWayMode === 'without' || eWayMode === 'without e-way bill') {
                andConditions.push({
                    $or: [
                        { 'customFields.eway_bill': { $exists: false } },
                        { 'customFields.eway_bill': '' },
                        { 'customFields.eway_bill': null }
                    ]
                });
            } else if (eWayMode === 'with' || eWayMode === 'with e-way bill') {
                andConditions.push({
                    'customFields.eway_bill': { $exists: true, $ne: '', $ne: null },
                    'customFields.eway_bill_status': { $ne: 'cancelled' }
                });
            } else if (eWayMode === 'cancelled' || eWayMode === 'cancelled e-way bill') {
                andConditions.push({ 'customFields.eway_bill_status': 'cancelled' });
            } else {
                // Direct search by e-way bill number
                andConditions.push({ 'customFields.eway_bill': { $regex: eWayBill.trim(), $options: 'i' } });
            }
        }

        // Shipping Address
        if (shippingAddress && shippingAddress.trim()) {
            andConditions.push({
                $or: [
                    { 'shippingAddress.street': { $regex: shippingAddress.trim(), $options: 'i' } },
                    { 'shippingAddress.city': { $regex: shippingAddress.trim(), $options: 'i' } },
                    { 'shippingAddress.state': { $regex: shippingAddress.trim(), $options: 'i' } }
                ]
            });
        }

        // 3. Advanced Filter (single field-operator-value)
        if (advField && advOperator && advValue !== undefined && advValue !== '') {
            const condition = {};
            let val = advValue;

            // Safeguard: If advField is _id, validate the value is a valid ObjectId
            if (advField === '_id' || advField.endsWith('._id')) {
                if (!mongoose.Types.ObjectId.isValid(val)) {
                    // Skip this filter instead of erroring
                } else {
                    condition[advField] = new mongoose.Types.ObjectId(val);
                }
            } else {
                switch (advOperator) {
                    case 'eq':
                    case 'equals':
                        condition[advField] = isNaN(val) ? val : Number(val);
                        break;
                    case 'ne':
                        condition[advField] = { $ne: isNaN(val) ? val : Number(val) };
                        break;
                    case 'gt':
                        condition[advField] = { $gt: isNaN(val) ? val : Number(val) };
                        break;
                    case 'gte':
                        condition[advField] = { $gte: isNaN(val) ? val : Number(val) };
                        break;
                    case 'lt':
                        condition[advField] = { $lt: isNaN(val) ? val : Number(val) };
                        break;
                    case 'lte':
                        condition[advField] = { $lte: isNaN(val) ? val : Number(val) };
                        break;
                    case 'contains':
                        condition[advField] = { $regex: val, $options: 'i' };
                        break;
                }
            }

            if (Object.keys(condition).length > 0) andConditions.push(condition);
        }

        // Build final query with $and
        const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

        const totalCount = await DebitNote.countDocuments(query);

        // Return "No record found" if no results
        if (totalCount === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No record found'
            });
        }

        const skip = (page - 1) * limit;
        const results = await DebitNote.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        res.status(200).json({
            success: true,
            count: results.length,
            total: totalCount,
            page: Number(page),
            pages: Math.ceil(totalCount / limit),
            data: results
        });

    } catch (error) {
        console.error('[Debit Note Search] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Debit Note Summary
 * @route   GET /api/debit-note/summary
 */
const getDebitNoteSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        let query = { userId };

        // Apply filters (same pattern as other documents)
        const { company, fromDate, toDate } = req.query;

        if (company) {
            query['customerInformation.ms'] = { $regex: company, $options: 'i' };
        }

        if (fromDate || toDate) {
            query['debitNoteDetails.dnDate'] = {};
            if (fromDate) query['debitNoteDetails.dnDate'].$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query['debitNoteDetails.dnDate'].$lte = end;
            }
        }

        const summary = await getSummaryAggregation(userId, query, DebitNote);

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createDebitNote,
    getDebitNotes,
    getDebitNoteById,
    updateDebitNote,
    deleteDebitNote,
    searchDebitNotes,
    getDebitNoteSummary
};
