const InwardPaymentReportModel = require('../../models/Report-Model/InwardPaymentReportModel');

class InwardPaymentReportController {
    /**
     * Generate inward payment report
     */
    static async generateInwardPaymentReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            // Basic Validation
            const validationErrors = InwardPaymentReportController.validateFilters(filters);
            if (validationErrors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
            }

            filters.userId = req.user._id;

            // Fetch Data
            const result = await InwardPaymentReportModel.getInwardPaymentReport(filters, options);
            if (!result.success) {
                return res.status(500).json({ success: false, message: result.message, error: result.error });
            }

            // Get Metadata (Columns)
            const metadata = InwardPaymentReportModel.getFilterMetadata();

            // NEW RESPONSE STRUCTURE
            res.json({
                success: true,
                data: result.data.docs, // Array of records directly in data
                columns: metadata.columns,
                pagination: {
                    totalDocs: result.data.totalDocs,
                    page: result.data.page,
                    totalPages: result.data.totalPages,
                    limit: result.data.limit
                },
                message: 'Inward payment report generated successfully'
            });

        } catch (error) {
            console.error('Inward Payment Report Error:', error);
            res.status(500).json({ success: false, message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
        }
    }

    /**
     * Get metadata and records (GET request)
     */
    static async getFilterMetadata(req, res) {
        try {
            const metadata = InwardPaymentReportModel.getFilterMetadata();

            const filters = {
                userId: req.user._id,
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
                paymentType: req.query.paymentType,
                customerVendor: req.query.customerVendor,
                staffId: req.query.staffId,
                invoiceSeries: req.query.invoiceSeries
            };

            const options = {
                page: req.query.page ? Number(req.query.page) : 1,
                limit: req.query.limit ? Number(req.query.limit) : 5000,
                sortBy: req.query.sortBy || 'paymentDate',
                sortOrder: req.query.sortOrder || 'desc'
            };

            const result = await InwardPaymentReportModel.getInwardPaymentReport(filters, options);

            if (!result.success) {
                return res.status(500).json({ success: false, message: result.message });
            }

            res.json({
                success: true,
                data: result.data.docs, // Array of Records
                columns: metadata.columns,
                paymentTypes: metadata.paymentTypes, // Keep specific metadata like paymentTypes
                sortFields: metadata.sortFields,
                pagination: {
                    totalDocs: result.data.totalDocs,
                    page: result.data.page,
                    totalPages: result.data.totalPages,
                    limit: result.data.limit
                },
                message: 'Data retrieved successfully'
            });

        } catch (error) {
            console.error('Metadata Error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    static validateFilters(filters) {
        const errors = [];
        if (filters.fromDate && isNaN(Date.parse(filters.fromDate))) errors.push('Invalid fromDate');
        if (filters.toDate && isNaN(Date.parse(filters.toDate))) errors.push('Invalid toDate');
        if (filters.fromDate && filters.toDate && new Date(filters.fromDate) > new Date(filters.toDate)) {
            errors.push('fromDate cannot be after toDate');
        }
        return errors;
    }
}

module.exports = InwardPaymentReportController;
