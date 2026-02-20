const OtherDocumentProductReportModel = require('../../models/Report-Model/OtherDocumentProductReportModel');

class OtherDocumentProductReportController {

    static async generateReport(req, res) {
        try {
            const { reportType, filters = {}, options = {} } = req.body;

            // Security
            filters.userId = req.user._id;

            if (!reportType) {
                return res.status(400).json({ success: false, message: 'Report Type is required' });
            }

            const validDocumentTypes = [
                'quotation', 'jobWork', 'proforma', 'deliveryChallan',
                'purchaseOrder', 'saleOrder', 'creditNote', 'debitNote', 'exportInvoice'
            ];

            if (!filters.documentType || !validDocumentTypes.includes(filters.documentType)) {
                return res.status(400).json({ success: false, message: 'Invalid or missing filters.documentType' });
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
