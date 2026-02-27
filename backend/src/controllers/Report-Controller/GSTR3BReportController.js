const GSTR3BReportModel = require('../../models/Report-Model/GSTR3BReportModel');

class GSTR3BReportController {
    static async searchReport(req, res) {
        try {
            const { fromDate, toDate } = req.body;
            const userId = req.user._id;

            if (!fromDate || !toDate) {
                return res.status(400).json({
                    success: false,
                    message: "fromDate and toDate are required."
                });
            }

            const result = await GSTR3BReportModel.searchReport(userId, fromDate, toDate);

            if (!result.success) {
                return res.status(500).json(result);
            }

            return res.status(200).json(result);

        } catch (error) {
            console.error("GSTR3BReportController Error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch GSTR-3B Report",
                error: error.message
            });
        }
    }
}

module.exports = GSTR3BReportController;
