const PurchaseReportModel = require('../../models/Report-Model/PurchaseReportModel');

class PurchaseReportController {
    /**
     * Generate purchase report with filters
     * @param {Object} req 
     * @param {Object} res 
     */
    static async generatePurchaseReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            // Validate Basic Filters
            const errors = PurchaseReportController.validateFilters(filters);
            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validation Failed', errors });
            }

            // User Isolation
            filters.userId = req.user._id;

            const result = await PurchaseReportModel.getPurchaseReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Purchase report generated successfully'
            });

        } catch (error) {
            console.error('Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const metadata = PurchaseReportModel.getFilterMetadata();
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }

    static validateFilters(filters) {
        const errors = [];
        if (filters.fromDate && isNaN(Date.parse(filters.fromDate))) errors.push('Invalid fromDate');
        if (filters.toDate && isNaN(Date.parse(filters.toDate))) errors.push('Invalid toDate');
        // Add more enum validations if needed
        return errors;
    }
}

module.exports = PurchaseReportController;
