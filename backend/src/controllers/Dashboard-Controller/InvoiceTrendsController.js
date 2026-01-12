const InvoiceTrendsModel = require('../../models/Dashboard-Model/InvoiceTrendsModel');
const { getCacheManager } = require('../../utils/cacheManager');

class InvoiceTrendsController {
    /**
     * GET /api/dashboard/invoice-trends
     */
    static async getTrends(req, res) {
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
            const cacheKey = cacheManager.generateKey('dashboard:invoice-trends', filters, req.user._id);

            let trends = null;
            if (!isRefresh) {
                trends = await cacheManager.get(cacheKey);
            }

            if (!trends) {
                trends = await InvoiceTrendsModel.getTrends(filters);
                await cacheManager.set(cacheKey, trends, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data: trends
            });
        } catch (error) {
            console.error('InvoiceTrendsController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = InvoiceTrendsController;
