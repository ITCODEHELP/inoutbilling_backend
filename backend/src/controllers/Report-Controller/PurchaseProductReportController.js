const PurchaseProductReportModel = require('../../models/Report-Model/PurchaseProductReportModel');

class PurchaseProductReportController {
    /**
     * Generate product-wise purchase report
     */
    static async generateProductReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            // Security: Enforce User Scope
            filters.userId = req.user._id;

            const result = await PurchaseProductReportModel.getPurchaseProductReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Purchase product report generated successfully'
            });

        } catch (error) {
            console.error('Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const metadata = PurchaseProductReportModel.getFilterMetadata();
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
}

module.exports = PurchaseProductReportController;
