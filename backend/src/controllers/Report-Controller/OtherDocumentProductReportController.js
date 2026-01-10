const OtherDocumentProductReportModel = require('../../models/Report-Model/OtherDocumentProductReportModel');

class OtherDocumentProductReportController {

    static async generateReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            // Security
            filters.userId = req.user._id;

            if (!filters.reportType) {
                return res.status(400).json({ success: false, message: 'Report Type is required' });
            }

            const result = await OtherDocumentProductReportModel.getOtherDocumentProductReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Report generated successfully'
            });

        } catch (error) {
            console.error('Other Document Product Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const metadata = OtherDocumentProductReportModel.getFilterMetadata();
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
}

module.exports = OtherDocumentProductReportController;
