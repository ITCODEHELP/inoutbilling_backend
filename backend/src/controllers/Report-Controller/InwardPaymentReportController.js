const InwardPaymentReportModel = require('../../models/Report-Model/InwardPaymentReportModel');

class InwardPaymentReportController {
    /**
     * Generate inward payment report
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async generateInwardPaymentReport(req, res) {
        try {
            // Validate request body
            const {
                filters = {},
                options = {}
            } = req.body;

            // Basic Validation
            const validationErrors = InwardPaymentReportController.validateFilters(filters);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            // Add user ID to filters for data isolation
            filters.userId = req.user._id;

            // Generate report
            const result = await InwardPaymentReportModel.getInwardPaymentReport(filters, options);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: result.message,
                    error: result.error
                });
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Inward payment report generated successfully'
            });

        } catch (error) {
            console.error('Inward Payment Report Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get metadata for filters and columns
     */
    static async getFilterMetadata(req, res) {
        try {
            const metadata = InwardPaymentReportModel.getFilterMetadata();
            res.json({
                success: true,
                data: metadata,
                message: 'Metadata retrieved successfully'
            });
        } catch (error) {
            console.error('Metadata Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Validate filter parameters
     * @param {Object} filters 
     */
    static validateFilters(filters) {
        const errors = [];

        // Date Validations
        if (filters.fromDate && isNaN(Date.parse(filters.fromDate))) {
            errors.push('Invalid fromDate');
        }
        if (filters.toDate && isNaN(Date.parse(filters.toDate))) {
            errors.push('Invalid toDate');
        }
        if (filters.fromDate && filters.toDate && new Date(filters.fromDate) > new Date(filters.toDate)) {
            errors.push('fromDate cannot be after toDate');
        }

        // Payment Type Validation
        const validTypes = ['cash', 'cheque', 'online', 'bank', 'tds', 'bad_debit', 'currency_exchange_loss'];
        if (filters.paymentType) {
            const types = Array.isArray(filters.paymentType) ? filters.paymentType : [filters.paymentType];
            const invalid = types.filter(t => !validTypes.includes(t));
            if (invalid.length > 0) {
                errors.push(`Invalid paymentType: ${invalid.join(', ')}`);
            }
        }

        return errors;
    }
}

module.exports = InwardPaymentReportController;
