const BankDetails = require('../../models/Other-Document-Model/BankDetail');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const InwardPayment = require('../../models/Payment-Model/InwardPayment');
const OutwardPayment = require('../../models/Payment-Model/OutwardPayment');

/**
 * Helper to get bank logo URL
 */
const getBankLogoUrl = (req, bankName) => {
    const baseUrl = `${req.protocol}://${req.get('host')}/bank-logos/`;
    const logoDir = path.join(__dirname, '../../bank-logos');

    // Normalize bank name for logo (lowercase, replace spaces with hyphens)
    const normalizedBankName = bankName.toLowerCase().replace(/\s+/g, '-');
    const logoFilename = `${normalizedBankName}.png`;
    const logoPath = path.join(logoDir, logoFilename);

    // Check if logo exists, otherwise use default
    const hasLogo = fs.existsSync(logoPath);
    return hasLogo ? `${baseUrl}${logoFilename}` : `${baseUrl}default.png`;
};

/**
 * @desc    Create new bank details
 * @route   POST /api/bank-details
 * @access  Private (JWT Protected)
 */
const createBankDetails = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            bankId,
            _id,
            accountName,
            bankName,
            ifscCode,
            swiftCode,
            micrCode,
            accountNumber,
            branchName,
            upiId,
            printUpiQrOnInvoice,
            upiQrOnInvoiceWithAmount
        } = req.body;

        // Strict validation: Ensure no ID is provided for creation
        if (bankId || _id) {
            return res.status(400).json({
                success: false,
                message: 'Do not supply bankId or _id for creation. Use POST for new records only.'
            });
        }

        // Validate required fields
        if (!accountName || accountName.trim() === '') {
            return res.status(400).json({ success: false, message: 'Account name is required' });
        }
        if (!bankName || bankName.trim() === '') {
            return res.status(400).json({ success: false, message: 'Bank name is required' });
        }
        if (!accountNumber || accountNumber.trim() === '') {
            return res.status(400).json({ success: false, message: 'Account number is required' });
        }

        // Validate formats
        if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid IFSC code format' });
        }
        if (upiId && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
            return res.status(400).json({ success: false, message: 'Invalid UPI ID format' });
        }
        if (swiftCode && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swiftCode.toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid SWIFT code format' });
        }
        if (micrCode && !/^[0-9]{9}$/.test(micrCode)) {
            return res.status(400).json({ success: false, message: 'Invalid MICR code format (must be 9 digits)' });
        }

        // Create new bank account
        const newBankId = uuidv4();

        const bankDetails = await BankDetails.create({
            bankId: newBankId,
            userId,
            accountName: accountName.trim(),
            bankName: bankName.trim(),
            ifscCode: ifscCode ? ifscCode.toUpperCase() : '',
            swiftCode: swiftCode ? swiftCode.toUpperCase() : '',
            micrCode: micrCode || '',
            accountNumber: accountNumber.trim(),
            branchName: branchName ? branchName.trim() : '',
            upiId: upiId ? upiId.toLowerCase() : '',
            printUpiQrOnInvoice: printUpiQrOnInvoice || false,
            upiQrOnInvoiceWithAmount: upiQrOnInvoiceWithAmount || false
        });

        // Enrich response with logo
        const bankLogo = getBankLogoUrl(req, bankDetails.bankName);
        const responseData = {
            ...bankDetails.toObject(),
            bankLogo
        };

        return res.status(201).json({
            success: true,
            message: 'Bank details created successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Error creating bank details:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors[0] || 'Validation error', errors });
        }
        return res.status(500).json({ success: false, message: 'Failed to create bank details', error: error.message });
    }
};

/**
 * @desc    Update existing bank details
 * @route   PUT /api/bank-details/:id
 * @access  Private (JWT Protected)
 */
const updateBankDetails = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        const {
            accountName,
            bankName,
            ifscCode,
            swiftCode,
            micrCode,
            accountNumber,
            branchName,
            upiId,
            printUpiQrOnInvoice,
            upiQrOnInvoiceWithAmount
        } = req.body;



        if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid IFSC code format' });
        }
        if (upiId && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
            return res.status(400).json({ success: false, message: 'Invalid UPI ID format' });
        }
        if (swiftCode && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swiftCode.toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid SWIFT code format' });
        }
        if (micrCode && !/^[0-9]{9}$/.test(micrCode)) {
            return res.status(400).json({ success: false, message: 'Invalid MICR code format (must be 9 digits)' });
        }

        // Find bank logic: try by bankId (UUID) first, else _id
        let existingBank = await BankDetails.findOne({ bankId: id, userId });
        if (!existingBank && mongoose.isValidObjectId(id)) {
            existingBank = await BankDetails.findOne({ _id: id, userId });
        }

        if (!existingBank) {
            return res.status(404).json({ success: false, message: 'Bank details not found' });
        }

        // Update fields - strictly partial (only update if field is present in payload)
        if (accountName !== undefined) existingBank.accountName = accountName.trim();
        if (bankName !== undefined) existingBank.bankName = bankName.trim();
        if (accountNumber !== undefined) existingBank.accountNumber = accountNumber.trim();

        if (ifscCode !== undefined) existingBank.ifscCode = ifscCode ? ifscCode.toUpperCase() : '';
        if (swiftCode !== undefined) existingBank.swiftCode = swiftCode ? swiftCode.toUpperCase() : '';
        if (micrCode !== undefined) existingBank.micrCode = micrCode || '';

        if (branchName !== undefined) existingBank.branchName = branchName ? branchName.trim() : '';
        if (upiId !== undefined) existingBank.upiId = upiId ? upiId.toLowerCase() : '';

        if (printUpiQrOnInvoice !== undefined) existingBank.printUpiQrOnInvoice = printUpiQrOnInvoice;
        if (upiQrOnInvoiceWithAmount !== undefined) existingBank.upiQrOnInvoiceWithAmount = upiQrOnInvoiceWithAmount;

        await existingBank.save();

        // Enrich response with logo
        const bankLogo = getBankLogoUrl(req, existingBank.bankName);
        const responseData = {
            ...existingBank.toObject(),
            bankLogo
        };

        return res.status(200).json({
            success: true,
            message: 'Bank details updated successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Error updating bank details:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors[0] || 'Validation error', errors });
        }
        return res.status(500).json({ success: false, message: 'Failed to update bank details', error: error.message });
    }
};

/**
 * @desc    Get all bank details for the logged-in user
 * @route   GET /api/bank-details
 * @access  Private (JWT Protected)
 */
const getAllBankDetails = async (req, res) => {
    try {
        const userId = req.user._id;
        const banks = await BankDetails.find({ userId }).sort({ createdAt: -1 });

        const bankList = banks.map(bank => {
            const logoUrl = getBankLogoUrl(req, bank.bankName);

            return {
                _id: bank._id,
                bankId: bank.bankId,
                bankName: bank.bankName,
                accountName: bank.accountName,
                accountNumber: bank.accountNumber,
                ifscCode: bank.ifscCode,
                branchName: bank.branchName,
                amount: bank.amount || 0, // Fallback if not tracked
                // As per requirement: "returning stored ... last transaction date, import date"
                // Using updatedAt as proxy for last transaction if strict transaction tracking isn't linked
                lastTransactionDate: bank.updatedAt,
                importDate: bank.createdAt,
                bankLogo: logoUrl
            };
        });

        return res.status(200).json({
            success: true,
            count: bankList.length,
            data: bankList
        });
    } catch (error) {
        console.error('Error fetching bank details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch bank details',
            error: error.message
        });
    }
};

/**
 * @desc    Search bank transactions (Inward & Outward)
 * @route   GET /api/bank-details/transactions/search
 * @access  Private (JWT Protected)
 */
/**
 * @desc    Search bank transactions (Embedded in BankDetail)
 * @route   GET /api/bank-details/transactions/search/:id
 * @access  Private (JWT Protected)
 */
const searchBankTransactions = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params; // Bank Detail ID

        const {
            page = 1,
            limit = 10,
            dateFrom,
            dateTo,
            description,
            type, // 'Credit' or 'Debit'
            amount,
            minAmount,
            maxAmount,
            status, // paymentStatus
            sort // custom sort? default latest first
        } = req.query;

        // 1. Initial Match (Find the correct BankDetail Document)
        const initialMatch = {
            userId: new mongoose.Types.ObjectId(userId)
        };
        if (mongoose.isValidObjectId(id)) {
            initialMatch._id = new mongoose.Types.ObjectId(id);
        } else {
            initialMatch.bankId = id;
        }

        const pipeline = [
            { $match: initialMatch },
            // 2. Unwind the transactions array to filter individual transactions
            { $unwind: "$transactions" }
        ];

        // 3. Build Filter for specific transactions
        const transactionMatch = {};

        // Date Range
        if (dateFrom || dateTo) {
            transactionMatch["transactions.date"] = {};
            if (dateFrom) transactionMatch["transactions.date"].$gte = new Date(dateFrom);
            if (dateTo) transactionMatch["transactions.date"].$lte = new Date(dateTo);
        }

        // Description/Remarks Search
        if (description) {
            transactionMatch.$or = [
                { "transactions.description": { $regex: description, $options: 'i' } },
                { "transactions.remarks": { $regex: description, $options: 'i' } }
            ];
        }

        // Type
        if (type) {
            // Check case sensitivity. Schema uses 'Credit'/'Debit'. Query might be 'credit'.
            // Let's make it case-insensitive regex
            transactionMatch["transactions.transactionType"] = { $regex: new RegExp(`^${type}$`, 'i') };
        }

        // Amount
        if (amount) {
            transactionMatch["transactions.amount"] = Number(amount);
        } else if (minAmount || maxAmount) {
            transactionMatch["transactions.amount"] = {};
            if (minAmount) transactionMatch["transactions.amount"].$gte = Number(minAmount);
            if (maxAmount) transactionMatch["transactions.amount"].$lte = Number(maxAmount);
        }

        // Payment Status
        if (status) {
            transactionMatch["transactions.paymentStatus"] = status;
        }

        // Apply transaction filters
        if (Object.keys(transactionMatch).length > 0) {
            pipeline.push({ $match: transactionMatch });
        }

        // 4. Sort
        pipeline.push({ $sort: { "transactions.date": -1 } });

        // 5. Facet for Pagination
        const skip = (Number(page) - 1) * Number(limit);
        const limitVal = Number(limit);

        pipeline.push({
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $skip: skip },
                    { $limit: limitVal },
                    // Project to flatten structure if desired, or keep as is
                    {
                        $project: {
                            _id: "$transactions._id",
                            date: "$transactions.date",
                            amount: "$transactions.amount",
                            transactionType: "$transactions.transactionType",
                            description: "$transactions.description",
                            remarks: "$transactions.remarks",
                            paymentStatus: "$transactions.paymentStatus"
                        }
                    }
                ]
            }
        });

        const result = await BankDetails.aggregate(pipeline);

        const metadata = result[0].metadata[0] || { total: 0 };
        const transactions = result[0].data;

        return res.status(200).json({
            success: true,
            count: transactions.length,
            total: metadata.total,
            currentPage: Number(page),
            totalPages: Math.ceil(metadata.total / limitVal),
            data: transactions
        });

    } catch (error) {
        console.error('Error searching bank transactions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to search bank transactions',
            error: error.message
        });
    }
};

/**
 * @desc    Add a new bank transaction (Credit/Debit)
 * @route   POST /api/bank-details/transactions/:id
 * @access  Private (JWT Protected)
 */
const addBankTransaction = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params; // Bank Detail ID
        const {
            date,
            transactionType, // 'Credit' or 'Debit'
            amount,
            description,
            remarks,
            paymentStatus
        } = req.body;

        // Validation
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }
        if (!transactionType || !['Credit', 'Debit'].includes(transactionType)) {
            return res.status(400).json({ success: false, message: 'Transaction Type must be Credit or Debit' });
        }
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid amount is required' });
        }
        if (!description || description.trim() === '') {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }

        const validStatuses = ['auto-match', 'unmatched', 'matched', 'not-active', 'inactive'];
        if (paymentStatus && !validStatuses.includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid paymentStatus' });
        }

        // Find BankDetail by ID
        let bankDetail = await BankDetails.findOne({ bankId: id, userId });
        if (!bankDetail && mongoose.isValidObjectId(id)) {
            bankDetail = await BankDetails.findOne({ _id: id, userId });
        }

        if (!bankDetail) {
            return res.status(404).json({ success: false, message: 'Bank details not found' });
        }

        // Add to transactions array
        const newTransaction = {
            date: new Date(date),
            amount: Number(amount),
            transactionType,
            description,
            remarks: remarks || '',
            paymentStatus: paymentStatus || 'unmatched'
        };

        bankDetail.transactions.push(newTransaction);
        await bankDetail.save();

        // Return the newly added transaction (which now has an _id)
        const addedTransaction = bankDetail.transactions[bankDetail.transactions.length - 1];

        return res.status(201).json({
            success: true,
            message: 'Transaction added successfully',
            data: addedTransaction
        });

    } catch (error) {
        console.error('Error adding bank transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add transaction',
            error: error.message
        });
    }
};

/**
 * @desc    Update a bank transaction
 * @route   PUT /api/bank-details/transactions/:id
 * @access  Private
 */
const updateBankTransaction = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        const updates = req.body;

        // Try finding in InwardPayment
        let transaction = await InwardPayment.findOne({ _id: id, userId });
        let model = InwardPayment;

        if (!transaction) {
            // Try OutwardPayment
            transaction = await OutwardPayment.findOne({ _id: id, userId });
            model = OutwardPayment;
        }

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        const validStatuses = ['auto-match', 'unmatched', 'matched', 'not-active', 'inactive'];
        if (updates.paymentStatus && !validStatuses.includes(updates.paymentStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid paymentStatus' });
        }

        // Apply updates
        // Prevent updating immutable fields if necessary, but generally allow defined updates
        if (updates.date) transaction.paymentDate = new Date(updates.date);
        if (updates.amount) transaction.amount = Number(updates.amount);
        if (updates.description) transaction.companyName = updates.description;
        if (updates.remarks) transaction.remarks = updates.remarks; // Note: this might overwrite the "(Bank: ...)" suffix if user edits it fully. Accepting user input as truth.
        if (updates.paymentStatus) transaction.paymentStatus = updates.paymentStatus;
        if (updates.transactionType) {
            // Changing type is complex (move collections). For now, assume simple field updates. 
            // If user wants to change Credit <-> Debit, they should probably delete and recreate.
            // We will ignore transactionType update here to ensure data integrity.
        }

        await transaction.save();

        return res.status(200).json({
            success: true,
            message: 'Transaction updated successfully',
            data: transaction
        });

    } catch (error) {
        console.error('Error updating transaction:', error);
        return res.status(500).json({ success: false, message: 'Failed to update transaction', error: error.message });
    }
};

/**
 * @desc    Delete (Soft Delete) a bank transaction
 * @route   DELETE /api/bank-details/transactions/:id
 * @access  Private
 */
const deleteBankTransaction = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        // Try finding in InwardPayment
        let transaction = await InwardPayment.findOne({ _id: id, userId });
        let model = InwardPayment;

        if (!transaction) {
            transaction = await OutwardPayment.findOne({ _id: id, userId });
            model = OutwardPayment;
        }

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        // Hard delete or Soft delete?
        // User said "delete their transactions". Usually means removal.
        // But system uses 'status'. Let's do Soft Delete (CANCELLED) to be safe with existing patterns, 
        // OR Hard Delete if "Delete" implies removal.
        // Given "paymentStatus: inactive" was requested, maybe that's soft delete?
        // Let's stick to Hard Delete for a clean "Delete" API, or specific Soft Delete if configured.
        // Looking at schema, `status` enum has `CANCELLED`.
        // Let's set status to CANCELLED.

        transaction.status = 'CANCELLED';
        // Also update paymentStatus to 'inactive' if relevant?
        transaction.paymentStatus = 'inactive';

        await transaction.save();

        // OR if hard delete is expected:
        // await model.deleteOne({ _id: id });

        // I will stick to Soft Delete (CANCELLED/inactive) as it's safer and reversible.

        return res.status(200).json({
            success: true,
            message: 'Transaction deleted successfully',
            data: { _id: id }
        });

    } catch (error) {
        console.error('Error deleting transaction:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete transaction', error: error.message });
    }
};

module.exports = {
    createBankDetails,
    updateBankDetails,
    getAllBankDetails,
    searchBankTransactions,
    addBankTransaction,
    updateBankTransaction,
    deleteBankTransaction
};
