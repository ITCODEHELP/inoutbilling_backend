const CustomerTrendModel = require('../../models/Dashboard-Model/CustomerTrendModel');
const { getCacheManager } = require('../../utils/cacheManager');

class CustomerTrendController {
    /**
     * GET /api/dashboard/customer-trend
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
            const cacheKey = cacheManager.generateKey('dashboard:customer-trend', filters, req.user._id);

            let data = null;
            if (!isRefresh) {
                data = await cacheManager.get(cacheKey);
            }

            if (!data) {
                data = await CustomerTrendModel.getTrend(filters);
                await cacheManager.set(cacheKey, data, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('CustomerTrendController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = CustomerTrendController;
