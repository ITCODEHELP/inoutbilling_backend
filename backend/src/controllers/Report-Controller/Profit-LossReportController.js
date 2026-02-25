const ProfitLossReportModel = require('../../models/Report-Model/Profit-LossReportModel');

class ProfitLossReportController {

    static async generateReport(req, res) {
        try {
            const filters = {};
            const options = {};

            if (req.body.fromDate) filters.fromDate = req.body.fromDate;
            if (req.body.toDate) filters.toDate = req.body.toDate;
            if (req.body.page) options.page = req.body.page;
            if (req.body.limit) options.limit = req.body.limit;

            filters.userId = req.user._id;

            const result = await ProfitLossReportModel.getProfitLossReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Profit & Loss Report generated successfully'
            });

        } catch (error) {
            console.error('Profit & Loss Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async getProfitLossDetails(req, res) {
        try {
            const filters = {};
            const options = {};

            if (req.body.name) filters.name = req.body.name;
            if (req.body.fromDate) filters.fromDate = req.body.fromDate;
            if (req.body.toDate) filters.toDate = req.body.toDate;
            if (req.body.page) options.page = req.body.page;
            if (req.body.limit) options.limit = req.body.limit;

            filters.userId = req.user._id;

            const result = await ProfitLossReportModel.getProfitLossDetails(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Profit & Loss Details Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
}

module.exports = ProfitLossReportController;
