const DailyExpensesReportModel = require('../../models/Report-Model/DailyExpensesReportModel');

class DailyExpensesReportController {
    static async searchDailyExpenses(req, res) {
        try {
            const {
                staffName,
                category,
                title,
                paymentType,
                fromDate,
                toDate,
                advancedFilters,
                selectedColumns
            } = req.body;

            const { page, limit } = req.query;

            const filters = {
                userId: req.user._id,
                staffName,
                category,
                title,
                paymentType,
                fromDate,
                toDate,
                advancedFilters
            };

            const options = {
                page,
                limit,
                selectedColumns
            };

            const result = await DailyExpensesReportModel.getDailyExpensesReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.status(200).json(result);

        } catch (error) {
            console.error('DailyExpensesReportController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = DailyExpensesReportController;
