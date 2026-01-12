const PaymentSummaryModel = require('../../models/Dashboard-Model/PaymentSummaryModel');
const { getCacheManager } = require('../../utils/cacheManager');

class PaymentSummaryController {
    /**
     * GET /api/dashboard/payment-summary
     */
    static async getPaymentSummary(req, res) {
        try {
            const { fromDate, toDate, branchId, refresh } = req.query;
            const isRefresh = refresh === 'true' || req.headers['x-refresh'] === 'true';

            const filters = {
                userId: req.user._id,
                fromDate,
                toDate,
                branchId
            };

            const cacheManager = getCacheManager();
            const cacheKey = cacheManager.generateKey('dashboard:payment-summary', filters, req.user._id);

            let data = null;
            if (!isRefresh) {
                data = await cacheManager.get(cacheKey);
            }

            if (!data) {
                data = await PaymentSummaryModel.getPaymentSummary(filters);
                await cacheManager.set(cacheKey, data, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('PaymentSummaryController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error'
            });
        }
    }
}

module.exports = PaymentSummaryController;
