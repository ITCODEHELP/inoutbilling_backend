const BankDetails = require('../../models/Other-Document-Model/BankDetail');
const { v4: uuidv4 } = require('uuid');

/**
 * @desc    Save bank details (supports multiple accounts per user)
 * @route   POST /api/bank-details
 * @access  Private (JWT Protected)
 */
const saveBankDetails = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            bankId,
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

        // Validate required fields
        if (!accountName || accountName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Account name is required'
            });
        }

        if (!bankName || bankName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Bank name is required'
            });
        }

        if (!accountNumber || accountNumber.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Account number is required'
            });
        }

        // Validate IFSC code format if provided
        if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid IFSC code format'
            });
        }

        // Validate UPI ID format if provided
        if (upiId && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid UPI ID format'
            });
        }

        // Validate SWIFT code format if provided
        if (swiftCode && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swiftCode.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid SWIFT code format'
            });
        }

        // Validate MICR code format if provided
        if (micrCode && !/^[0-9]{9}$/.test(micrCode)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid MICR code format (must be 9 digits)'
            });
        }

        // Check if updating existing bank or creating new
        if (bankId) {
            // Update existing bank details
            const existingBank = await BankDetails.findOne({ bankId, userId });

            if (!existingBank) {
                return res.status(404).json({
                    success: false,
                    message: 'Bank details not found'
                });
            }

            // Update fields
            existingBank.accountName = accountName.trim();
            existingBank.bankName = bankName.trim();
            existingBank.ifscCode = ifscCode ? ifscCode.toUpperCase() : '';
            existingBank.swiftCode = swiftCode ? swiftCode.toUpperCase() : '';
            existingBank.micrCode = micrCode || '';
            existingBank.accountNumber = accountNumber.trim();
            existingBank.branchName = branchName ? branchName.trim() : '';
            existingBank.upiId = upiId ? upiId.toLowerCase() : '';
            existingBank.printUpiQrOnInvoice = printUpiQrOnInvoice || false;
            existingBank.upiQrOnInvoiceWithAmount = upiQrOnInvoiceWithAmount || false;

            await existingBank.save();

            return res.status(200).json({
                success: true,
                message: 'Bank details updated successfully'
            });
        } else {
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

            return res.status(201).json({
                success: true,
                message: 'Bank details updated successfully',
                data: {
                    bankId: bankDetails.bankId
                }
            });
        }
    } catch (error) {
        console.error('Error saving bank details:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: errors[0] || 'Validation error',
                errors
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to save bank details',
            error: error.message
        });
    }
};

module.exports = {
    saveBankDetails
};
