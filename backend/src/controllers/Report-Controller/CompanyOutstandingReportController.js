const CompanyOutstandingReportModel = require('../../models/Report-Model/CompanyOutstandingReportModel');

class CompanyOutstandingReportController {

    static async generateReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;
            filters.userId = req.user._id;

            const result = await CompanyOutstandingReportModel.getCompanyOutstandingReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Report generated successfully'
            });

        } catch (error) {
            console.error('Company Outstanding Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const metadata = CompanyOutstandingReportModel.getFilterMetadata();
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
}

module.exports = CompanyOutstandingReportController;
