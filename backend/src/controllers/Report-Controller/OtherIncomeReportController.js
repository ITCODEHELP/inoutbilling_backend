const OtherIncomeReportModel = require('../../models/Report-Model/OtherIncomeReportModel');

class OtherIncomeReportController {
    static async searchOtherIncomes(req, res) {
        try {
            const {
                category,
                title,
                paymentType,
                fromDate,
                toDate,
                advancedFilters,
                selectedColumns
                // staffName - Not applicable for OtherIncome as per schema
            } = req.body;

            const { page, limit } = req.query;

            const filters = {
                userId: req.user._id,
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

            const result = await OtherIncomeReportModel.getOtherIncomeReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.status(200).json(result);

        } catch (error) {
            console.error('OtherIncomeReportController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = OtherIncomeReportController;
