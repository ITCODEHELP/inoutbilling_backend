const SalesOutstandingReportModel = require('../../models/Report-Model/SalesOutstandingReportModel');

class SalesOutstandingReportController {
    /**
     * Generate sales outstanding report with filters and customization
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async generateOutstandingReport(req, res) {
        try {
            // Validate request body
            const {
                filters = {},
                options = {}
            } = req.body;

            // Validate filters
            const validationErrors = SalesOutstandingReportController.validateFilters(filters);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            // Validate options
            const optionsValidationErrors = SalesOutstandingReportController.validateOptions(options);
            if (optionsValidationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Options validation failed',
                    errors: optionsValidationErrors
                });
            }

            // Add user ID to filters for data isolation
            filters.userId = req.user._id;

            // Generate report
            const result = await SalesOutstandingReportModel.getSalesOutstandingReport(filters, options);

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
                message: 'Sales outstanding report generated successfully'
            });

        } catch (error) {
            console.error('Sales Outstanding Report Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get available filter fields and column options for outstanding report
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getFilterMetadata(req, res) {
        try {
            const metadata = SalesOutstandingReportModel.getFilterMetadata();

            res.json({
                success: true,
                data: metadata,
                message: 'Filter metadata retrieved successfully'
            });

        } catch (error) {
            console.error('Filter Metadata Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get outstanding report statistics for dashboard
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getOutstandingStatistics(req, res) {
        try {
            const { filters = {} } = req.body;

            // Validate filters
            const validationErrors = SalesOutstandingReportController.validateFilters(filters);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            // Add user ID to filters for data isolation
            filters.userId = req.user._id;

            // Generate statistics
            const result = await SalesOutstandingReportModel.getOutstandingStatistics(filters);

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
                message: result.message
            });

        } catch (error) {
            console.error('Outstanding Statistics Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Validate filter parameters for outstanding report
     * @param {Object} filters - Filter object
     * @returns {Array} Array of validation errors
     */
    static validateFilters(filters) {
        const errors = [];

        // Validate date range
        if (filters.dueDateRange) {
            const { from, to } = filters.dueDateRange;
            if (from && isNaN(Date.parse(from))) {
                errors.push('Invalid due date range start date');
            }
            if (to && isNaN(Date.parse(to))) {
                errors.push('Invalid due date range end date');
            }
            if (from && to && new Date(from) > new Date(to)) {
                errors.push('Due date range start date must be before end date');
            }
        }

        // Validate due days range
        if (filters.dueDaysRange) {
            const { from, to } = filters.dueDaysRange;
            if (from !== undefined && (isNaN(from) || from < 0)) {
                errors.push('Due days range start must be a non-negative number');
            }
            if (to !== undefined && (isNaN(to) || to < 0)) {
                errors.push('Due days range end must be a non-negative number');
            }
            if (from !== undefined && to !== undefined && from > to) {
                errors.push('Due days range start must be less than or equal to end');
            }
        }

        // Validate product group array
        if (filters.productGroup && !Array.isArray(filters.productGroup)) {
            errors.push('Product group must be an array');
        }

        // Validate advance filters
        if (filters.advanceFilters && Array.isArray(filters.advanceFilters)) {
            filters.advanceFilters.forEach((filter, index) => {
                if (!filter.field || !filter.operator || filter.value === undefined) {
                    errors.push(`Advanced filter at index ${index} is missing required fields`);
                }
            });
        }

        // Validate selected columns
        if (filters.selectedColumns && !Array.isArray(filters.selectedColumns)) {
            errors.push('Selected columns must be an array');
        }

        return errors;
    }

    /**
     * Validate options parameters for outstanding report
     * @param {Object} options - Options object
     * @returns {Array} Array of validation errors
     */
    static validateOptions(options) {
        const errors = [];

        // Validate pagination
        if (options.page && (isNaN(options.page) || options.page < 1)) {
            errors.push('Page must be a positive integer');
        }
        if (options.limit && (isNaN(options.limit) || options.limit < 1 || options.limit > 1000)) {
            errors.push('Limit must be between 1 and 1000');
        }

        // Validate sort order
        if (options.sortOrder && !['asc', 'desc'].includes(options.sortOrder)) {
            errors.push('Sort order must be either "asc" or "desc"');
        }

        // Validate sort field (basic validation)
        const allowedSortFields = [
            'invoiceDetails.date',
            'dueDate',
            'daysOverdue',
            'outstandingAmount',
            'totals.grandTotal',
            'customerInformation.ms',
            'invoiceDetails.invoiceNumber',
            'createdAt'
        ];
        
        if (options.sortBy && !allowedSortFields.includes(options.sortBy)) {
            errors.push('Invalid sort field');
        }

        return errors;
    }
}

module.exports = SalesOutstandingReportController;
