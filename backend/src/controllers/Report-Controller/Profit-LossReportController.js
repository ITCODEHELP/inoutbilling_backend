const ProfitLossReportModel = require('../../models/Report-Model/Profit-LossReportModel');

class ProfitLossReportController {

    static async generateReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;
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
}

module.exports = ProfitLossReportController;
