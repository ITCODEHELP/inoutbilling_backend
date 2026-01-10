const PurchaseOutstandingReportModel = require('../../models/Report-Model/PurchaseOutstandingReportModel');

class PurchaseOutstandingReportController {
    /**
     * Generate purchase outstanding report
     */
    static async generateOutstandingReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            filters.userId = req.user._id;

            const result = await PurchaseOutstandingReportModel.getPurchaseOutstandingReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Purchase outstanding report generated successfully'
            });

        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const metadata = PurchaseOutstandingReportModel.getFilterMetadata();
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
}

module.exports = PurchaseOutstandingReportController;
