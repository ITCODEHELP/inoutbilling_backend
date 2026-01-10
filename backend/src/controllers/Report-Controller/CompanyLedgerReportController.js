const CompanyLedgerReportModel = require('../../models/Report-Model/CompanyLedgerReportModel');

class CompanyLedgerReportController {

    static async generateReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            // Security
            filters.userId = req.user._id;

            const result = await CompanyLedgerReportModel.getCompanyLedgerReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Report generated successfully'
            });

        } catch (error) {
            console.error('Company Ledger Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const metadata = CompanyLedgerReportModel.getFilterMetadata();
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
}

module.exports = CompanyLedgerReportController;
