const OtherDocumentReportModel = require('../../models/Report-Model/OtherDocumentReportModel');

class OtherDocumentReportController {
    /**
     * Generate generic document report
     */
    static async generateReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            // Security
            filters.userId = req.user._id;

            const validDocumentTypes = [
                'quotation', 'jobWork', 'proforma', 'deliveryChallan',
                'purchaseOrder', 'saleOrder', 'creditNote', 'debitNote'
            ];

            if (!filters.documentType || !validDocumentTypes.includes(filters.documentType)) {
                return res.status(400).json({ success: false, message: 'Invalid or missing filters.documentType' });
            }

            const result = await OtherDocumentReportModel.getOtherDocumentReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Report generated successfully'
            });

        } catch (error) {
            console.error('Other Document Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async getFilterMetadata(req, res) {
        try {
            const documentType = req.query.documentType || 'quotation';
            const metadata = OtherDocumentReportModel.getFilterMetadata(documentType);
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
}

module.exports = OtherDocumentReportController;
