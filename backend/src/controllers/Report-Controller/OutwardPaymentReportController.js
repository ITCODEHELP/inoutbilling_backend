const OutwardPaymentReportModel = require('../../models/Report-Model/OutwardPaymentReportModel');
const mongoose = require('mongoose');

class OutwardPaymentReportController {

    static async generateReport(req, res) {
        try {
            const { filters = {}, options = {} } = req.body;

            // Security: Scope to logged-in user
            filters.userId = req.user._id;

            // Validate filters (Optional)
            if (filters.paymentType && !OutwardPaymentReportController.validateFilters(filters)) {
                return res.json({
                    success: true,
                    data: { docs: [], totalDocs: 0, totalPages: 0, page: 1 },
                    message: 'Invalid payment type filtered'
                });
            }

            // Note: selectedColumns should be part of filters object from frontend request
            // filters.selectedColumns = req.body.selectedColumns || filters.selectedColumns; (If passed separately)

            const result = await OutwardPaymentReportModel.getOutwardPaymentReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Report generated successfully'
            });

        } catch (error) {
            console.error('Outward Report Controller Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static validateFilters(filters) {
        const validTypes = ['ALL', 'CASH', 'CHEQUE', 'ONLINE', 'BANK', 'TDS', 'BAD_DEBTS_KASAR',
            'cash', 'cheque', 'online', 'bank', 'tds', 'bad_debit', 'currency_exchange_loss'];

        if (filters.paymentType) {
            const types = Array.isArray(filters.paymentType) ? filters.paymentType : [filters.paymentType];
            return types.every(t => validTypes.includes(t));
        }
        return true;
    }

    static async getFilterMetadata(req, res) {
        try {
            const metadata = OutwardPaymentReportModel.getFilterMetadata();
            res.json({ success: true, data: metadata });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
}

module.exports = OutwardPaymentReportController;
