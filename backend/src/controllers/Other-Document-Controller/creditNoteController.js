const CreditNote = require('../../models/Other-Document-Model/CreditNote');
const { calculateDocumentTotals, getSummaryAggregation } = require('../../utils/documentHelper');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const mongoose = require('mongoose');

// Generate Credit Note Number (following same pattern as Job Work)
const generateCreditNoteNumber = async (userId) => {
    const lastCN = await CreditNote.findOne({ userId }).sort({ createdAt: -1 });
    if (!lastCN || !lastCN.creditNoteDetails?.cnNumber) {
        return 'CN-0001';
    }
    const lastNumber = parseInt(lastCN.creditNoteDetails.cnNumber.split('-')[1]) || 0;
    return `CN-${String(lastNumber + 1).padStart(4, '0')}`;
};

/**
 * @desc    Create Credit Note
 * @route   POST /api/credit-note
 */
const createCreditNote = async (req, res) => {
    try {
        const {
            customerInformation,
            creditNoteDetails = {},
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

        // 🔹 Generate Credit Note Number if not provided
        if (!creditNoteDetails.cnNumber) {
            const cnNumber = await generateCreditNoteNumber(req.user._id);
            creditNoteDetails.cnNumber = cnNumber;
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

        const newCreditNote = new CreditNote({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            creditNoteDetails,
            items: calculationResults.items,
            totals: {
                ...calculationResults.totals,
                totalCreditValue: calculationResults.totals.grandTotal
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

        await newCreditNote.save();

        res.status(201).json({
            success: true,
            message: 'Credit Note created successfully',
            data: newCreditNote
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Credit Note number must be unique'
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all Credit Notes
 * @route   GET /api/credit-note
 */
const getCreditNotes = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;

        const query = { userId: req.user._id };
        const total = await CreditNote.countDocuments(query);

        const creditNotes = await CreditNote.find(query)
            .populate('staff', 'fullName')
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: creditNotes
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Credit Note by ID
 * @route   GET /api/credit-note/:id
 */
const getCreditNoteById = async (req, res) => {
    try {
        const creditNote = await CreditNote.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('staff', 'fullName');

        if (!creditNote) {
            return res.status(404).json({
                success: false,
                message: 'Credit Note not found'
            });
        }

        res.status(200).json({
            success: true,
            data: creditNote
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Credit Note
 * @route   PUT /api/credit-note/:id
 */
const updateCreditNote = async (req, res) => {
    try {
        const {
            customerInformation,
            creditNoteDetails,
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

        const updatedCreditNote = await CreditNote.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            {
                customerInformation,
                useSameShippingAddress,
                shippingAddress: finalShippingAddress,
                creditNoteDetails,
                items: calculationResults.items,
                totals: {
                    ...calculationResults.totals,
                    totalCreditValue: calculationResults.totals.grandTotal
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

        if (!updatedCreditNote) {
            return res.status(404).json({
                success: false,
                message: 'Credit Note not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Credit Note updated successfully',
            data: updatedCreditNote
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Credit Note
 * @route   DELETE /api/credit-note/:id
 */
const deleteCreditNote = async (req, res) => {
    try {
        const creditNote = await CreditNote.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!creditNote) {
            return res.status(404).json({
                success: false,
                message: 'Credit Note not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Credit Note deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Search Credit Notes
 * @route   GET /api/credit-note/search
 */
const searchCreditNotes = async (req, res) => {
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
            cnNumber, creditNoteNumber,
            minTotal, maxTotal,
            lrNo, eWayBill,
            itemNote,
            remarks,
            gstin,
            cnType, creditNoteType,
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

        let query = { userId };

        // 1. Keyword Search ($or)
        if (search) {
            // Safeguard: Never use search term as _id
            query.$or = [
                { 'customerInformation.ms': { $regex: search, $options: 'i' } },
                { 'creditNoteDetails.cnNumber': { $regex: search, $options: 'i' } },
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

        if (cnNumber || creditNoteNumber) {
            const cnNo = cnNumber || creditNoteNumber;
            // Search in combined prefix-number-postfix or just number
            andFilters.push({
                $or: [
                    { 'creditNoteDetails.cnNumber': { $regex: cnNo, $options: 'i' } },
                    { 'creditNoteDetails.cnPrefix': { $regex: cnNo, $options: 'i' } },
                    { 'creditNoteDetails.cnPostfix': { $regex: cnNo, $options: 'i' } }
                ]
            });
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

        // Credit Note Type
        if (cnType || creditNoteType) {
            andFilters.push({ 'creditNoteDetails.cnType': cnType || creditNoteType });
        }

        // Doc Type
        if (docType) {
            andFilters.push({ 'creditNoteDetails.docType': docType });
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
            andFilters.push({ 'creditNoteDetails.cnDate': dateQuery });
        }

        // Total Range
        if (minTotal || maxTotal) {
            const totalQuery = {};
            if (minTotal) totalQuery.$gte = Number(minTotal);
            if (maxTotal) totalQuery.$lte = Number(maxTotal);
            andFilters.push({ 'totals.grandTotal': totalQuery });
        }

        // staffName resolution
        if (staffName) {
            const staffs = await Staff.find({
                ownerRef: userId,
                fullName: { $regex: staffName, $options: 'i' }
            }).select('_id');
            if (staffs.length > 0) {
                andFilters.push({ staff: { $in: staffs.map(s => s._id) } });
            }
        }

        // LR No (from customFields)
        if (lrNo) {
            andFilters.push({ 'customFields.lr_no': { $regex: lrNo, $options: 'i' } });
        }

        // E-Way Bill (from customFields)
        if (eWayBill) {
            andFilters.push({ 'customFields.eway_bill': { $regex: eWayBill, $options: 'i' } });
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

        // 3. Advanced Filter (single field-operator-value)
        if (advField && advOperator && advValue !== undefined) {
            const condition = {};
            let val = advValue;

            // Safeguard: If advField is _id, validate the value is a valid ObjectId
            if (advField === '_id' || advField.endsWith('._id')) {
                if (!mongoose.Types.ObjectId.isValid(val)) {
                    console.warn(`[Credit Note Search] Invalid ObjectId for field ${advField}: ${val}`);
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

            if (Object.keys(condition).length > 0) andFilters.push(condition);
        }

        if (andFilters.length > 0) {
            query.$and = andFilters;
        }

        // Log the final query for debugging
        console.log('[Credit Note Search] Final MongoDB Query:', JSON.stringify(query, null, 2));

        const totalCount = await CreditNote.countDocuments(query);

        // Return "No record found" if no results
        if (totalCount === 0) {
            console.log('[Credit Note Search] No records found for query');
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No record found'
            });
        }

        const skip = (page - 1) * limit;
        const results = await CreditNote.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        console.log(`[Credit Note Search] Found ${totalCount} total records, returning ${results.length}`);

        res.status(200).json({
            success: true,
            count: results.length,
            total: totalCount,
            page: Number(page),
            pages: Math.ceil(totalCount / limit),
            data: results
        });

    } catch (error) {
        console.error('[Credit Note Search] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Credit Note Summary
 * @route   GET /api/credit-note/summary
 */
const getCreditNoteSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        let query = { userId };

        // Apply filters (same pattern as other documents)
        const { company, fromDate, toDate } = req.query;

        if (company) {
            query['customerInformation.ms'] = { $regex: company, $options: 'i' };
        }

        if (fromDate || toDate) {
            query['creditNoteDetails.cnDate'] = {};
            if (fromDate) query['creditNoteDetails.cnDate'].$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query['creditNoteDetails.cnDate'].$lte = end;
            }
        }

        const summary = await getSummaryAggregation(userId, query, CreditNote);

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createCreditNote,
    getCreditNotes,
    getCreditNoteById,
    updateCreditNote,
    deleteCreditNote,
    searchCreditNotes,
    getCreditNoteSummary
};
