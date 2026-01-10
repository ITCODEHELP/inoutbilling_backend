const SalesProductReportModel = require('../../models/Report-Model/SalesProductReportModel');

class SalesProductReportController {
    static async searchSalesProductReport(req, res) {
        try {
            // Handle both POST (req.body) and GET (req.query) requests
            const source = req.method === 'POST' ? req.body : req.query;
            
            const {
                customerVendor,
                products,
                productGroup,
                staffName,
                invoiceNumber,
                invoiceSeries,
                groupProductBy,
                fromDate,
                toDate,
                showPrimaryUOM,
                advanceFilters,
                limit
            } = source;

            // Build filters object
            const filters = {
                userId: req.user._id,
                customerVendor,
                products,
                productGroup,
                staffName,
                invoiceNumber,
                invoiceSeries,
                groupProductBy,
                fromDate,
                toDate,
                showPrimaryUOM,
                advanceFilters,
                limit
            };

            // Remove undefined values
            Object.keys(filters).forEach(key => {
                if (filters[key] === undefined || filters[key] === '') {
                    delete filters[key];
                }
            });

            // Get report data
            const result = await SalesProductReportModel.getSalesProductReport(filters);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch sales product report',
                    error: result.message
                });
            }

            res.json({
                success: true,
                data: result.data,
                count: result.count,
                message: 'Sales product report retrieved successfully'
            });

        } catch (error) {
            console.error('Sales Product Report Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const result = await SalesProductReportModel.getFilterMetadata();

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch filter metadata',
                    error: result.message
                });
            }

            res.json({
                success: true,
                data: result.data,
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
}

module.exports = SalesProductReportController;
