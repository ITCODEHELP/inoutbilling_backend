const PurchaseSummaryModel = require('../../models/Dashboard-Model/PurchaseSummaryModel');
const { getCacheManager } = require('../../utils/cacheManager');

class PurchaseSummaryController {
    /**
     * GET /api/dashboard/purchase-summary
     */
    static async getPurchaseSummary(req, res) {
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
            const cacheKey = cacheManager.generateKey('dashboard:purchase-summary', filters, req.user._id);

            let summary = null;
            if (!isRefresh) {
                summary = await cacheManager.get(cacheKey);
            }

            if (!summary) {
                summary = await PurchaseSummaryModel.getSummary(filters);
                await cacheManager.set(cacheKey, summary, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data: summary
            });
        } catch (error) {
            console.error('PurchaseSummaryController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = PurchaseSummaryController;
