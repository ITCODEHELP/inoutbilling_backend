const StockDashboardModel = require('../../models/Dashboard-Model/StockDashboardModel');
const { getCacheManager } = require('../../utils/cacheManager');

class StockDashboardController {
    /**
     * GET /api/dashboard/low-stock
     */
    static async getLowStock(req, res) {
        try {
            const { fromDate, toDate, branchId, limit, refresh } = req.query;
            const isRefresh = refresh === 'true' || req.headers['x-refresh'] === 'true';

            const filters = {
                userId: req.user._id,
                fromDate,
                toDate,
                branchId,
                limit: limit || 10
            };

            const cacheManager = getCacheManager();
            const cacheKey = cacheManager.generateKey('dashboard:low-stock', filters, req.user._id);

            let result = null;
            if (!isRefresh) {
                result = await cacheManager.get(cacheKey);
            }

            if (!result) {
                const { data, count } = await StockDashboardModel.getLowStockProducts(filters);
                result = { data, count };
                await cacheManager.set(cacheKey, result, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                count: result.count,
                data: result.data
            });
        } catch (error) {
            console.error('StockDashboardController Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
}

module.exports = StockDashboardController;
