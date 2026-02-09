const DebitNote = require('../../models/Other-Document-Model/DebitNote');
const { calculateDocumentTotals, getSummaryAggregation, getSelectedPrintTemplate } = require('../../utils/documentHelper');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const mongoose = require('mongoose');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const User = require('../../models/User-Model/User');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const crypto = require('crypto');

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

        if (finalShippingAddress?.pincode) {
            const distance = await calculateShippingDistance(req.user._id, finalShippingAddress, calculationBranchId);
            finalShippingAddress.distance = distance;
        } else {
            finalShippingAddress.distance = 0;
        }

        if (!debitNoteDetails.dnNumber) {
            debitNoteDetails.dnNumber = await generateDebitNoteNumber(req.user._id);
        }

        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);
        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges
        }, calculationBranchId);

        let parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields || {};

        const newDebitNote = new DebitNote({
            userId: req.user._id,
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
        });

        await newDebitNote.save();
        res.status(201).json({ success: true, message: 'Debit Note created successfully', data: newDebitNote });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Debit Note number must be unique' });
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all Debit Notes
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

        res.status(200).json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: debitNotes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Debit Note by ID
 */
const getDebitNoteById = async (req, res) => {
    try {
        const debitNote = await DebitNote.findOne({ _id: req.params.id, userId: req.user._id }).populate('staff', 'fullName');
        if (!debitNote) return res.status(404).json({ success: false, message: 'Debit Note not found' });
        res.status(200).json({ success: true, data: debitNote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Debit Note
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

        if (finalShippingAddress?.pincode) {
            const distance = await calculateShippingDistance(req.user._id, finalShippingAddress, calculationBranchId);
            finalShippingAddress.distance = distance;
        } else {
            finalShippingAddress.distance = 0;
        }

        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);
        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges
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

        if (!updatedDebitNote) return res.status(404).json({ success: false, message: 'Debit Note not found' });
        res.status(200).json({ success: true, message: 'Debit Note updated successfully', data: updatedDebitNote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Debit Note
 */
const deleteDebitNote = async (req, res) => {
    try {
        const debitNote = await DebitNote.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!debitNote) return res.status(404).json({ success: false, message: 'Debit Note not found' });
        res.status(200).json({ success: true, message: 'Debit Note deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Search Debit Notes
 */
const searchDebitNotes = async (req, res) => {
    try {
        const userId = req.user._id;
        const Staff = require('../../models/Setting-Model/Staff');
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

        if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

        const andConditions = [{ userId: new mongoose.Types.ObjectId(userId) }];

        if (search && search.trim()) {
            const searchTerm = search.trim();
            const orConditions = [
                { 'customerInformation.ms': { $regex: searchTerm, $options: 'i' } },
                { 'debitNoteDetails.dnNumber': { $regex: searchTerm, $options: 'i' } },
                { documentRemarks: { $regex: searchTerm, $options: 'i' } },
                { items: { $elemMatch: { productName: { $regex: searchTerm, $options: 'i' } } } }
            ];
            andConditions.push({ $or: orConditions });
        }

        if (company || customerName) andConditions.push({ 'customerInformation.ms': { $regex: (company || customerName).trim(), $options: 'i' } });
        if (product || productName) andConditions.push({ items: { $elemMatch: { productName: { $regex: (product || productName).trim(), $options: 'i' } } } });
        if (productGroup) andConditions.push({ items: { $elemMatch: { productGroup: { $regex: productGroup.trim(), $options: 'i' } } } });
        if (dnNumber || debitNoteNumber) {
            const dnNo = (dnNumber || debitNoteNumber).trim();
            andConditions.push({ 'debitNoteDetails.dnNumber': { $regex: dnNo, $options: 'i' } });
        }
        if (remarks) andConditions.push({ documentRemarks: { $regex: remarks.trim(), $options: 'i' } });
        if (gstin) andConditions.push({ 'customerInformation.gstinPan': { $regex: gstin.trim(), $options: 'i' } });
        if (itemNote) andConditions.push({ items: { $elemMatch: { itemNote: { $regex: itemNote.trim(), $options: 'i' } } } });

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

        if (minTotal || maxTotal) {
            const totalQuery = {};
            if (minTotal) totalQuery.$gte = Number(minTotal);
            if (maxTotal) totalQuery.$lte = Number(maxTotal);
            andConditions.push({ 'totals.grandTotal': totalQuery });
        }

        if (staffName) {
            const staffs = await Staff.find({ ownerRef: userId, fullName: { $regex: staffName.trim(), $options: 'i' } }).select('_id');
            if (staffs.length > 0) andConditions.push({ staff: { $in: staffs.map(s => s._id) } });
        }

        if (shippingAddress) {
            andConditions.push({
                $or: [
                    { 'shippingAddress.street': { $regex: shippingAddress.trim(), $options: 'i' } },
                    { 'shippingAddress.city': { $regex: shippingAddress.trim(), $options: 'i' } },
                    { 'shippingAddress.state': { $regex: shippingAddress.trim(), $options: 'i' } }
                ]
            });
        }

        const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];
        const totalCount = await DebitNote.countDocuments(query);
        const skip = (page - 1) * limit;
        const results = await DebitNote.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        res.status(200).json({ success: true, count: results.length, total: totalCount, page: Number(page), pages: Math.ceil(totalCount / limit), data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Debit Note Summary
 */
const getDebitNoteSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        let query = { userId };
        const { company, fromDate, toDate } = req.query;

        if (company) query['customerInformation.ms'] = { $regex: company, $options: 'i' };
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
        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper for tokens
const generatePublicToken = (id) => {
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    return crypto.createHmac('sha256', secret).update(id.toString()).digest('hex').substring(0, 16);
};

const downloadDebitNotePDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const debitNotes = await DebitNote.find({ _id: { $in: ids }, userId: req.user._id });
        if (!debitNotes || debitNotes.length === 0) return res.status(404).json({ success: false, message: "Debit Note(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Debit Note', debitNotes[0].branch);

        const pdfBuffer = await generateSaleInvoicePDF(debitNotes, userData, { ...options, hideDueDate: true, hideTerms: true }, 'Debit Note', printConfig);
        const filename = debitNotes.length === 1 ? `DebitNote_${debitNotes[0].debitNoteDetails.dnNumber}.pdf` : `Merged_DebitNotes.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareDebitNoteEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const debitNotes = await DebitNote.find({ _id: { $in: ids }, userId: req.user._id });
        if (!debitNotes || debitNotes.length === 0) return res.status(404).json({ success: false, message: "Debit Note(s) not found" });

        const firstDoc = debitNotes[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || (customer ? customer.email : null);
        if (!email) return res.status(400).json({ success: false, message: "Customer email not found" });

        const options = getCopyOptions(req);
        await sendInvoiceEmail(debitNotes, email, false, { ...options, hideDueDate: true, hideTerms: true }, 'Debit Note');
        res.status(200).json({ success: true, message: `Debit Note(s) sent successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareDebitNoteWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const debitNotes = await DebitNote.find({ _id: { $in: ids }, userId: req.user._id });
        const firstDoc = debitNotes[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const phone = req.body.phone || (customer ? customer.phone : null);
        if (!phone) return res.status(400).json({ success: false, message: "Customer phone not found" });

        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const token = generatePublicToken(req.params.id);
        const publicLink = `${req.protocol}://${req.get('host')}/api/debit-note/view-public/${req.params.id}/${token}`;

        const message = `Dear ${firstDoc.customerInformation.ms},\nPlease find your Debit Note No: ${firstDoc.debitNoteDetails.dnNumber}.\nLink: ${publicLink}`;
        res.status(200).json({ success: true, data: { whatsappNumber, deepLink: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generateDebitNotePublicLink = async (req, res) => {
    try {
        const token = generatePublicToken(req.params.id);
        res.status(200).json({ success: true, publicLink: `${req.protocol}://${req.get('host')}/api/debit-note/view-public/${req.params.id}/${token}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const viewPublicDebitNote = async (req, res) => {
    try {
        const { id, token } = req.params;
        if (token !== generatePublicToken(id)) return res.status(403).send('Invalid link');
        const debitNote = await DebitNote.findById(id);
        const userData = await User.findById(debitNote.userId);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(debitNote.userId, 'Debit Note', debitNote.branch);
        const pdfBuffer = await generateSaleInvoicePDF(debitNote, userData, { ...options, hideDueDate: true, hideTerms: true }, 'Debit Note', printConfig);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = {
    createDebitNote,
    getDebitNotes,
    getDebitNoteById,
    updateDebitNote,
    deleteDebitNote,
    searchDebitNotes,
    getDebitNoteSummary,
    downloadDebitNotePDF,
    shareDebitNoteEmail,
    shareDebitNoteWhatsApp,
    generateDebitNotePublicLink,
    viewPublicDebitNote
};
