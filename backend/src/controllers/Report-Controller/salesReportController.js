const SalesReportModel = require('../../models/Report-Model/salesReportModel');
const SaleInvoice = require('../../models/Sales-Invoice-Model/SaleInvoice');
const { generateSalesReportHtml: generateNewSalesReportHtml } = require('../../utils/salesReportTemplate');
const {
    generateSalesReportPdf: generateNewSalesReportPdf,
    generateSalesReportExcel: generateNewSalesReportExcel
} = require('../../utils/salesReportExportHelper');
const { sendExportSalesReportEmail } = require('../../utils/emailHelper');


class SalesReportController {
    /**
     * Generate sales report with filters and customization
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async generateSalesReport(req, res) {
        try {
            // Validate request body
            const {
                filters = {},
                options = {},
                selectedFields = [],
                groupByCustomer = false,
                groupByCurrency = false,
                includeCancelled = false
            } = req.body;

            // Merge top-level parameters into filters for backward compatibility and model structure
            filters.selectedFields = selectedFields;
            filters.groupByCustomer = groupByCustomer;
            filters.groupByCurrency = groupByCurrency;
            filters.includeCancelled = includeCancelled;

            // Validate filters
            const validationErrors = SalesReportController.validateFilters(filters);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            // Validate options
            const optionsValidationErrors = SalesReportController.validateOptions(options);
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
            const result = await SalesReportModel.getSalesReport(filters, options);

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
                message: 'Sales report generated successfully'
            });

        } catch (error) {
            console.error('Sales Report Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get available filter fields and column options
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getFilterMetadata(req, res) {
        try {
            const metadata = SalesReportModel.getFilterMetadata();

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
     * Validate filter parameters
     * @param {Object} filters - Filter object
     * @returns {Array} Array of validation errors
     */
    static validateFilters(filters) {
        const errors = [];

        // Validate date range
        if (filters.dateRange) {
            const { from, to } = filters.dateRange;

            if (from && !this.isValidDate(from)) {
                errors.push('Invalid date range "from" value');
            }

            if (to && !this.isValidDate(to)) {
                errors.push('Invalid date range "to" value');
            }

            if (from && to && new Date(from) > new Date(to)) {
                errors.push('Date range "from" cannot be after "to"');
            }
        }

        // Validate arrays
        if (filters.products && !Array.isArray(filters.products)) {
            errors.push('Products must be an array');
        }

        if (filters.productGroup && !Array.isArray(filters.productGroup)) {
            errors.push('Product group must be an array');
        }

        // Validate advance filters
        if (filters.advanceFilters && Array.isArray(filters.advanceFilters)) {
            filters.advanceFilters.forEach((filter, index) => {
                const filterErrors = this.validateAdvanceFilter(filter, index);
                errors.push(...filterErrors);
            });
        }

        // Validate selected columns
        if (filters.selectedColumns && !Array.isArray(filters.selectedColumns)) {
            errors.push('Selected columns must be an array');
        }

        return errors;
    }

    /**
     * Validate options parameters
     * @param {Object} options - Options object
     * @returns {Array} Array of validation errors
     */
    static validateOptions(options) {
        const errors = [];

        // Validate pagination
        if (options.page && (!Number.isInteger(options.page) || options.page < 1)) {
            errors.push('Page must be a positive integer');
        }

        if (options.limit && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000)) {
            errors.push('Limit must be a positive integer (max 1000)');
        }

        // Validate sort order
        if (options.sortOrder && !['asc', 'desc'].includes(options.sortOrder.toLowerCase())) {
            errors.push('Sort order must be either "asc" or "desc"');
        }

        // Validate sort by field
        if (options.sortBy) {
            const allowedSortFields = [
                'invoiceDetails.date',
                'invoiceDetails.invoiceNumber',
                'customerInformation.ms',
                'totals.grandTotal',
                'totals.totalTaxable',
                'createdAt',
                'updatedAt'
            ];

            if (!allowedSortFields.includes(options.sortBy)) {
                errors.push(`Invalid sort field. Allowed fields: ${allowedSortFields.join(', ')}`);
            }
        }

        return errors;
    }

    /**
     * Validate individual advance filter
     * @param {Object} filter - Advance filter object
     * @param {number} index - Filter index for error messaging
     * @returns {Array} Array of validation errors
     */
    static validateAdvanceFilter(filter, index) {
        const errors = [];
        const filterPrefix = `Advance filter ${index + 1}`;

        // Check required fields
        if (!filter.field) {
            errors.push(`${filterPrefix}: field is required`);
        }

        if (!filter.operator) {
            errors.push(`${filterPrefix}: operator is required`);
        }

        if (filter.value === undefined || filter.value === null) {
            errors.push(`${filterPrefix}: value is required`);
        }

        // Validate operator
        const validOperators = ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'between'];
        if (filter.operator && !validOperators.includes(filter.operator)) {
            errors.push(`${filterPrefix}: invalid operator. Valid operators: ${validOperators.join(', ')}`);
        }

        // Validate between operator
        if (filter.operator === 'between') {
            if (!Array.isArray(filter.value) || filter.value.length !== 2) {
                errors.push(`${filterPrefix}: between operator requires an array with exactly 2 values`);
            }
        }

        // Validate field format
        if (filter.field && !this.isValidField(filter.field)) {
            errors.push(`${filterPrefix}: invalid field format`);
        }

        return errors;
    }

    /**
     * Check if date string is valid
     * @param {string} dateString - Date string to validate
     * @returns {boolean}
     */
    static isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    /**
     * Check if field name is valid (basic validation)
     * @param {string} field - Field name to validate
     * @returns {boolean}
     */
    static isValidField(field) {
        // Basic field validation - allow alphanumeric, dots, and underscores
        const fieldPattern = /^[a-zA-Z][a-zA-Z0-9._]*$/;
        return fieldPattern.test(field);
    }

    /**
     * Sanitize and normalize filter values
     * @param {Object} filters - Raw filters object
     * @returns {Object} Sanitized filters
     */
    static sanitizeFilters(filters) {
        const sanitized = { ...filters };

        // Trim string values
        Object.keys(sanitized).forEach(key => {
            const value = sanitized[key];
            if (typeof value === 'string') {
                sanitized[key] = value.trim();
            }
        });

        // Normalize arrays
        if (sanitized.products && Array.isArray(sanitized.products)) {
            sanitized.products = sanitized.products.map(p => p.trim()).filter(p => p);
        }

        if (sanitized.productGroup && Array.isArray(sanitized.productGroup)) {
            sanitized.productGroup = sanitized.productGroup.map(g => g.trim()).filter(g => g);
        }

        return sanitized;
    }

    /**
     * Get report statistics (optional endpoint for dashboard)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getReportStatistics(req, res) {
        try {
            const { filters = {} } = req.body;

            // Add user ID to filters
            filters.userId = req.user._id;

            // Get basic statistics
            const statsPipeline = [
                { $match: { userId: filters.userId } },
                {
                    $group: {
                        _id: null,
                        totalInvoices: { $sum: 1 },
                        totalGrandTotal: { $sum: '$totals.grandTotal' },
                        totalTaxable: { $sum: '$totals.totalTaxable' },
                        totalTax: { $sum: '$totals.totalTax' },
                        avgInvoiceValue: { $avg: '$totals.grandTotal' }
                    }
                }
            ];

            // Apply date filter if provided
            if (filters.dateRange) {
                const dateMatch = {};
                if (filters.dateRange.from) {
                    dateMatch.$gte = new Date(filters.dateRange.from);
                }
                if (filters.dateRange.to) {
                    dateMatch.$lte = new Date(filters.dateRange.to);
                }
                if (Object.keys(dateMatch).length > 0) {
                    statsPipeline.unshift({
                        $match: {
                            userId: filters.userId,
                            'invoiceDetails.date': dateMatch
                        }
                    });
                    statsPipeline.splice(1, 1); // Remove the general userId match
                }
            }

            const result = await SaleInvoice.aggregate(statsPipeline);

            res.json({
                success: true,
                data: result.length > 0 ? result[0] : {
                    totalInvoices: 0,
                    totalGrandTotal: 0,
                    totalTaxable: 0,
                    totalTax: 0,
                    avgInvoiceValue: 0
                },
                message: 'Report statistics retrieved successfully'
            });

        } catch (error) {
            console.error('Report Statistics Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Generate HTML for printing
     */
    static async printSalesReport(req, res) {
        try {
            const { filters = {}, options = {}, selectedFields = [], groupByCustomer = false, groupByCurrency = false, includeCancelled = false } = req.body;

            // Setup filters (same as generateSalesReport)
            filters.selectedColumns = selectedFields; // Map frontend field
            filters.groupByCustomer = groupByCustomer;
            filters.groupByCurrency = groupByCurrency;
            filters.includeCancelled = includeCancelled;
            filters.userId = req.user._id;

            // Fetch all data for print
            const reportOptions = { ...options, limit: 1000000, page: 1 };

            const result = await SalesReportModel.getSalesReport(filters, reportOptions);

            if (!result.success || !result.data.reports || result.data.reports.length === 0) {
                return res.status(400).json({ success: false, message: 'No data available to generate report' });
            }

            const html = generateNewSalesReportHtml(result.data, filters, req.user);
            res.send(html);

        } catch (error) {
            console.error('Print Report Error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Download PDF
     */
    static async downloadSalesReportPdf(req, res) {
        try {
            const { filters = {}, options = {}, selectedFields = [], groupByCustomer = false, groupByCurrency = false, includeCancelled = false } = req.body;

            filters.selectedColumns = selectedFields;
            filters.groupByCustomer = groupByCustomer;
            filters.groupByCurrency = groupByCurrency;
            filters.includeCancelled = includeCancelled;
            filters.userId = req.user._id;

            const reportOptions = { ...options, limit: 1000000, page: 1 };

            const result = await SalesReportModel.getSalesReport(filters, reportOptions);

            if (!result.success || !result.data.reports || result.data.reports.length === 0) {
                return res.status(400).json({ success: false, message: 'No data available to generate report' });
            }

            const pdfBuffer = await generateNewSalesReportPdf(result.data, filters, req.user);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Sales_Report.pdf"`,
                'Content-Length': pdfBuffer.length
            });
            res.send(pdfBuffer);

        } catch (error) {
            console.error('PDF Download Error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Export Excel
     */
    static async exportSalesReportExcel(req, res) {
        try {
            const { filters = {}, options = {}, selectedFields = [], groupByCustomer = false, groupByCurrency = false, includeCancelled = false } = req.body;

            filters.selectedColumns = selectedFields;
            filters.groupByCustomer = groupByCustomer;
            filters.groupByCurrency = groupByCurrency;
            filters.includeCancelled = includeCancelled;
            filters.userId = req.user._id;

            const reportOptions = { ...options, limit: 1000000, page: 1 };

            const result = await SalesReportModel.getSalesReport(filters, reportOptions);

            if (!result.success || !result.data.reports || result.data.reports.length === 0) {
                return res.status(400).json({ success: false, message: 'No data available to generate report' });
            }

            const buffer = await generateNewSalesReportExcel(result.data, filters, req.user);

            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Sales_Report.xlsx"`,
                'Content-Length': buffer.length
            });
            res.send(buffer);

        } catch (error) {
            console.error('Excel Export Error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Email Report
     */
    static async emailSalesReport(req, res) {
        try {
            const {
                to, cc, bcc, subject, body,
                filters = {}, options = {}, selectedFields = [],
                groupByCustomer = false, groupByCurrency = false, includeCancelled = false
            } = req.body;

            // Validation
            if (!to) {
                return res.status(400).json({ success: false, message: 'Recipient email (to) is required' });
            }
            if (!subject) {
                return res.status(400).json({ success: false, message: 'Email subject is required' });
            }
            if (!body) {
                return res.status(400).json({ success: false, message: 'Email body is required' });
            }

            filters.selectedColumns = selectedFields;
            filters.groupByCustomer = groupByCustomer;
            filters.groupByCurrency = groupByCurrency;
            filters.includeCancelled = includeCancelled;
            filters.userId = req.user._id;

            const reportOptions = { ...options, limit: 1000000, page: 1 };

            const result = await SalesReportModel.getSalesReport(filters, reportOptions);

            if (!result.success || !result.data.reports || result.data.reports.length === 0) {
                return res.status(400).json({ success: false, message: 'No data available to generate report' });
            }

            // Prepare email params
            const emailParams = { to, cc, bcc, subject, body };

            await sendExportSalesReportEmail(result.data, filters, req.user, emailParams);

            res.json({ success: true, message: 'Email sent successfully' });

        } catch (error) {
            console.error('Email Report Error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}


module.exports = SalesReportController;
