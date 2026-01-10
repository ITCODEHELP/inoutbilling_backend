const StockReportModel = require('../../models/Report-Model/StockReportModel');

class StockReportController {

    static async generateReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;
            filters.userId = req.user._id;

            const result = await StockReportModel.getStockReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Stock Report generated successfully'
            });

        } catch (error) {
            console.error('Stock Report Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async printReport(req, res) {
        // Reuse generation logic
        await StockReportController.generateReport(req, res);
    }

    static async emailReport(req, res) {
        await StockReportController.generateReport(req, res);
    }

    static async exportReport(req, res) {
        await StockReportController.generateReport(req, res);
    }

    static async downloadReport(req, res) {
        await StockReportController.generateReport(req, res);
    }
}

module.exports = StockReportController;
