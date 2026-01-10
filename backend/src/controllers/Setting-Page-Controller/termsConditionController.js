const TermsConditions = require('../../models/Setting-Model/TermsConditions');

/**
 * @desc    Save or Update terms and conditions for document types
 * @route   POST /api/terms-conditions
 * @access  Private (JWT Protected)
 */
const saveTermsConditions = async (req, res) => {
    try {
        const userId = req.user._id;
        const termsData = req.body;

        // Allow empty payload
        if (!termsData || typeof termsData !== 'object') {
            return res.status(200).json({
                success: true,
                message: 'Terms and conditions saved successfully'
            });
        }

        // Find existing terms
        let termsConditions = await TermsConditions.findOne({ userId });

        if (termsConditions) {
            // Update only provided fields
            const validKeys = [
                'sale_invoice',
                'delivery_challan',
                'quotation',
                'proforma',
                'purchase_order',
                'sale_order',
                'job_work',
                'credit_note',
                'debit_note',
                'multi_currency_invoice',
                'payment_receipt'
            ];

            validKeys.forEach(key => {
                if (termsData[key] !== undefined) {
                    termsConditions.terms[key] = termsData[key] || '';
                }
            });

            // Mark modified for nested object
            termsConditions.markModified('terms');
            await termsConditions.save();
        } else {
            // Create new terms with provided values
            const newTerms = {
                sale_invoice: termsData.sale_invoice || '',
                delivery_challan: termsData.delivery_challan || '',
                quotation: termsData.quotation || '',
                proforma: termsData.proforma || '',
                purchase_order: termsData.purchase_order || '',
                sale_order: termsData.sale_order || '',
                job_work: termsData.job_work || '',
                credit_note: termsData.credit_note || '',
                debit_note: termsData.debit_note || '',
                multi_currency_invoice: termsData.multi_currency_invoice || '',
                payment_receipt: termsData.payment_receipt || ''
            };

            termsConditions = await TermsConditions.create({
                userId,
                terms: newTerms
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Terms and conditions saved successfully'
        });
    } catch (error) {
        console.error('Error saving terms and conditions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save terms and conditions',
            error: error.message
        });
    }
};

/**
 * @desc    Get terms and conditions for all document types
 * @route   GET /api/terms-conditions
 * @access  Private (JWT Protected)
 */
const getTermsConditions = async (req, res) => {
    try {
        const userId = req.user._id;

        const termsConditions = await TermsConditions.findOne({ userId });

        if (!termsConditions) {
            // Return empty terms for all document types
            return res.status(200).json({
                success: true,
                message: 'Terms and conditions retrieved successfully',
                data: {
                    sale_invoice: '',
                    delivery_challan: '',
                    quotation: '',
                    proforma: '',
                    purchase_order: '',
                    sale_order: '',
                    job_work: '',
                    credit_note: '',
                    debit_note: '',
                    multi_currency_invoice: '',
                    payment_receipt: ''
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Terms and conditions retrieved successfully',
            data: termsConditions.terms
        });
    } catch (error) {
        console.error('Error fetching terms and conditions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch terms and conditions',
            error: error.message
        });
    }
};

module.exports = {
    saveTermsConditions,
    getTermsConditions
};
