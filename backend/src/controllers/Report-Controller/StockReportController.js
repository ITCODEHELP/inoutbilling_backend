const StockReportModel = require('../../models/Report-Model/StockReportModel');

class StockReportController {

    static async generateReport(req, res) {
        try {
            const filters = req.body.filters || req.body; // fallback to body if not nested
            const options = req.body;
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

    static async getStockDetails(req, res) {
        try {
            const filters = req.body;
            filters.userId = req.user._id;
            const options = {
                page: req.body.page || 1,
                limit: req.body.limit || 10
            };

            const result = await StockReportModel.getStockDetails(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Stock Details Controller Error:', error);
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
